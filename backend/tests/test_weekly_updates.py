from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models import Department, Task, TaskAssignee, User, WeeklyReport, WeeklyReportCommitment
from app.utils.week_periods import (
    monday_of,
    period_end_for_submit,
    planning_window,
    resolve_period,
)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def users(db_session):
    dept = Department(name="Tech", description="Engineering")
    db_session.add(dept)
    db_session.flush()

    employee = User(
        first_name="Emp",
        last_name="Loyee",
        email="emp@test.com",
        hashed_password=get_password_hash("x"),
        role="employee",
        status="active",
        job_title="Dev",
    )
    employee.departments = [dept]
    other = User(
        first_name="Other",
        last_name="Person",
        email="other@test.com",
        hashed_password=get_password_hash("x"),
        role="employee",
        status="active",
        job_title="Designer",
    )
    other.departments = [dept]
    db_session.add_all([employee, other])
    db_session.commit()
    db_session.refresh(employee)
    db_session.refresh(other)
    return {"employee": employee, "other": other, "dept": dept}


def auth_header(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': user.id})}"}


def test_period_math_friday_and_late_submit():
    monday = date(2026, 10, 26)
    assert monday_of(date(2026, 10, 28)) == monday
    assert period_end_for_submit(monday, date(2026, 10, 30)) == date(2026, 10, 30)
    assert period_end_for_submit(monday, date(2026, 11, 3)) == date(2026, 10, 31)
    plan_start, plan_end = planning_window(monday)
    assert plan_start == date(2026, 11, 2)
    assert plan_end == date(2026, 11, 8)


def test_resolve_period_requires_monday():
    try:
        resolve_period(date(2026, 10, 28))
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_submit_creates_task_and_is_idempotent(client, users, db_session):
    emp = users["employee"]
    monday = monday_of(date.today())
    due = (monday + timedelta(days=9)).isoformat() + "T12:00:00+05:30"
    payload = {
        "period_start": monday.isoformat(),
        "completions": [{"title": "Shipped API", "source": "manual", "included": True}],
        "commitments": [
            {
                "title": "New API integration",
                "estimated_hours": 4,
                "due_date": due,
                "commitment_type": "new",
            }
        ],
    }
    first = client.put("/api/weekly-updates", json=payload, headers=auth_header(emp))
    assert first.status_code == 200, first.text
    data = first.json()["data"]
    assert data["status"] == "submitted"
    assert data["period_start"] == monday.isoformat()
    assert len(data["commitments"]) == 1
    task_id = data["commitments"][0]["task_id"]
    assert task_id

    tasks = db_session.query(Task).filter(Task.title == "New API integration").all()
    assert len(tasks) == 1
    assert any(a.user_id == emp.id for a in tasks[0].assignees)

    second = client.put("/api/weekly-updates", json=payload, headers=auth_header(emp))
    assert second.status_code == 200, second.text
    assert second.json()["data"]["commitments"][0]["task_id"] == task_id
    assert db_session.query(Task).filter(Task.title == "New API integration").count() == 1
    assert db_session.query(WeeklyReport).filter(WeeklyReport.user_id == emp.id).count() == 1

    db_session.refresh(emp)
    assert emp.weekly_updates_adopted_at is not None


def test_suggestions_respect_adoption_and_completed_at(client, users, db_session):
    emp = users["employee"]
    emp.weekly_updates_adopted_at = datetime.now(timezone.utc)
    db_session.commit()

    monday = monday_of(date.today())
    old = Task(
        title="Old work",
        status="completed",
        priority="medium",
        estimated_hours=1,
        created_by_id=emp.id,
        completed_at=datetime.now(timezone.utc) - timedelta(days=30),
    )
    old.assignees.append(TaskAssignee(user_id=emp.id))
    midweek = Task(
        title="Finished this week",
        status="completed",
        priority="medium",
        estimated_hours=2,
        created_by_id=emp.id,
        completed_at=datetime.now(timezone.utc),
    )
    midweek.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add_all([old, midweek])
    db_session.commit()

    res = client.get(
        "/api/weekly-updates/suggestions",
        params={"week_start": monday.isoformat()},
        headers=auth_header(emp),
    )
    assert res.status_code == 200
    titles = [i["title"] for i in res.json()["data"]["items"]]
    assert "Finished this week" in titles
    assert "Old work" not in titles


def test_carry_forward_reuses_task(client, users, db_session):
    emp = users["employee"]
    previous_monday = monday_of(date.today()) - timedelta(days=7)
    task = Task(
        title="Unfinished API",
        status="in_progress",
        priority="medium",
        estimated_hours=4,
        created_by_id=emp.id,
        due_date=datetime.now(timezone.utc) - timedelta(days=2),
        original_due_date=datetime.now(timezone.utc) - timedelta(days=2),
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.flush()
    report = WeeklyReport(
        user_id=emp.id,
        period_start=previous_monday,
        period_end=previous_monday + timedelta(days=4),
        planning_start=previous_monday + timedelta(days=7),
        planning_end=previous_monday + timedelta(days=13),
        status="submitted",
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add(report)
    db_session.flush()
    db_session.add(
        WeeklyReportCommitment(
            weekly_report_id=report.id,
            task_id=task.id,
            title=task.title,
            estimated_hours=4,
            due_date=task.due_date,
            original_due_date=task.original_due_date,
            commitment_type="new",
        )
    )
    db_session.commit()

    res = client.get("/api/weekly-updates/carry-forward", headers=auth_header(emp))
    assert res.status_code == 200
    items = res.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["task_id"] == task.id
    assert items[0]["is_carried_forward"] is True
    assert items[0]["is_overdue"] is True


def test_deadline_revision_keeps_history(client, users, db_session):
    emp = users["employee"]
    original = datetime.now(timezone.utc) - timedelta(days=3)
    task = Task(
        title="Late page",
        status="in_progress",
        priority="medium",
        estimated_hours=2,
        created_by_id=emp.id,
        due_date=original,
        original_due_date=original,
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    new_due = (date.today() + timedelta(days=4)).isoformat() + "T12:00:00+05:30"
    res = client.post(
        f"/api/tasks/{task.id}/deadline-revision",
        json={"reason": "Blocked on copy", "new_due_date": new_due},
        headers=auth_header(emp),
    )
    assert res.status_code == 200, res.text
    body = res.json()["data"]
    assert body["reason"] == "Blocked on copy"
    history = client.get(f"/api/tasks/{task.id}/deadline-revisions", headers=auth_header(emp))
    assert history.status_code == 200
    rows = history.json()["data"]
    assert len(rows) == 1
    db_session.refresh(task)
    assert task.status == "in_progress"
    assert task.original_due_date is not None


def test_leave_context_does_not_change_due_dates(client, users, db_session):
    emp = users["employee"]
    monday = monday_of(date.today())
    res = client.get(
        "/api/weekly-updates/leave-context",
        params={"week_start": monday.isoformat()},
        headers=auth_header(emp),
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert "reporting" in data
    assert "planning" in data
    assert "working_days" in data["reporting"]
    assert db_session.query(Task).count() == 0


def test_history_is_newest_first_and_readable(client, users, db_session):
    emp = users["employee"]
    other = users["other"]
    older = monday_of(date.today()) - timedelta(days=14)
    newer = monday_of(date.today()) - timedelta(days=7)
    for start in (older, newer):
        db_session.add(
            WeeklyReport(
                user_id=emp.id,
                period_start=start,
                period_end=start + timedelta(days=4),
                planning_start=start + timedelta(days=7),
                planning_end=start + timedelta(days=13),
                status="submitted",
                submitted_at=datetime.now(timezone.utc),
            )
        )
    db_session.commit()

    res = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(other))
    assert res.status_code == 200
    reports = res.json()["data"]["reports"]
    assert [r["period_start"] for r in reports] == [newer.isoformat(), older.isoformat()]


def test_overview_uses_real_counts(client, users):
    emp = users["employee"]
    res = client.get("/api/weekly-updates/overview", headers=auth_header(emp))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["employee_count"] >= 2
    assert data["pending"] >= 1
    assert data["submitted"] == 0
