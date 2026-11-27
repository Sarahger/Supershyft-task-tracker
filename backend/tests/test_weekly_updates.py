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
from app.models import Attendance, Department, Task, TaskAssignee, User, WeeklyReport, WeeklyReportCommitment
from app.utils.month_weeks import get_app_timezone
from app.utils.week_periods import (
    current_week_start,
    due_at_noon,
    editable_until_for,
    is_due_date_overdue,
    is_report_editable,
    week_date_bounds,
    working_week_has_ended,
    writable_period_start,
    monday_of,
    period_end_for_submit,
    planning_window,
    resolve_period,
    today_local,
    working_week_end,
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
    current_monday = date(2026, 11, 2)
    next_monday = date(2026, 11, 9)
    now = datetime(2026, 11, 2, 15, 0, tzinfo=get_app_timezone())
    assert monday_of(date(2026, 10, 28)) == monday
    assert working_week_end(monday) == date(2026, 10, 31)
    assert period_end_for_submit(monday, date(2026, 10, 30)) == date(2026, 10, 31)
    assert period_end_for_submit(current_monday, date(2026, 11, 2)) == date(2026, 11, 5)
    # Planning is always the calendar week after the reporting week.
    plan_start, plan_end = planning_window(monday, now)
    assert plan_start == current_monday
    assert plan_end == date(2026, 11, 5)
    this_start, this_end = planning_window(current_monday, now)
    assert this_start == next_monday
    assert this_end == working_week_end(next_monday)


def test_weekly_edit_window_current_and_future_only():
    previous = date(2026, 10, 26)
    current = date(2026, 11, 2)
    upcoming = date(2026, 11, 9)
    zone = get_app_timezone()
    sunday_night = datetime(2026, 11, 1, 23, 59, tzinfo=zone)
    monday_morning = datetime(2026, 11, 2, 10, 0, tzinfo=zone)

    # Legacy cutoff helper still reports Monday 2PM after the week.
    until = editable_until_for(previous)
    assert until.date() == date(2026, 11, 2)
    assert until.hour == 14

    # Before Monday: previous is still the current week; future weeks are open too.
    assert is_report_editable(previous, "submitted", sunday_night)
    assert is_report_editable(current, "draft", sunday_night)
    assert is_report_editable(upcoming, "draft", sunday_night)
    assert writable_period_start(sunday_night) == previous

    # From Monday 00:00: only current + future weeks stay editable.
    assert not is_report_editable(previous, "submitted", monday_morning)
    assert is_report_editable(current, "draft", monday_morning)
    assert is_report_editable(upcoming, "draft", monday_morning)
    assert writable_period_start(monday_morning) == current
    assert current_week_start(monday_morning) == current


def test_overdue_starts_after_due_calendar_day():
    zone = get_app_timezone()
    due_day = date(2026, 11, 12)
    due = due_at_noon(due_day)
    during_due_day = datetime(2026, 11, 12, 23, 59, tzinfo=zone)
    next_midnight = datetime(2026, 11, 13, 0, 0, tzinfo=zone)
    assert is_due_date_overdue(due, status="in_progress", now=during_due_day) is False
    assert is_due_date_overdue(due, status="in_progress", now=next_midnight) is True
    assert is_due_date_overdue(due, status="completed", now=next_midnight) is False


def test_resolve_period_requires_monday():
    try:
        resolve_period(date(2026, 10, 28))
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_submit_creates_task_and_is_idempotent(client, users, db_session):
    emp = users["employee"]
    monday = writable_period_start()
    due = (monday + timedelta(days=9)).isoformat() + "T12:00:00+05:30"
    payload = {
        "period_start": monday.isoformat(),
        "completions": [{
            "title": "Shipped API",
            "source": "manual",
            "included": True,
            "estimated_hours": 2,
            "completion_date": monday.isoformat(),
        }],
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


def test_extra_completed_item_creates_completed_tracker_task(client, users, db_session):
    emp = users["employee"]
    monday = writable_period_start()
    done_on = monday + timedelta(days=3)
    due = (monday + timedelta(days=9)).isoformat() + "T12:00:00+05:30"
    payload = {
        "period_start": monday.isoformat(),
        "completions": [{
            "title": "New app screens",
            "source": "manual",
            "included": True,
            "estimated_hours": 3,
            "completion_date": done_on.isoformat(),
        }],
        "commitments": [
            {
                "title": "Follow-up polish",
                "estimated_hours": 2,
                "due_date": due,
                "commitment_type": "new",
            }
        ],
    }
    first = client.put("/api/weekly-updates", json=payload, headers=auth_header(emp))
    assert first.status_code == 200, first.text
    completion = first.json()["data"]["completions"][0]
    task_id = completion["task_id"]
    assert task_id
    assert completion["title"] == "New app screens"
    assert completion["completion_date"] == done_on.isoformat()

    db_session.expire_all()
    task = db_session.query(Task).filter(Task.id == task_id).first()
    assert task is not None
    assert task.status == "completed"
    assert task.estimated_hours == 3
    assert task.completed_at is not None
    assert any(a.user_id == emp.id and a.is_completed for a in task.assignees)

    second = client.put("/api/weekly-updates", json=payload, headers=auth_header(emp))
    assert second.status_code == 200, second.text
    assert second.json()["data"]["completions"][0]["task_id"] == task_id
    assert db_session.query(Task).filter(Task.title == "New app screens").count() == 1


def test_weekly_due_date_can_change_for_24_hours_then_needs_revision(client, users, db_session):
    emp = users["employee"]
    monday = writable_period_start()
    due = (monday + timedelta(days=9)).isoformat() + "T12:00:00+05:30"
    later = (monday + timedelta(days=11)).isoformat() + "T12:00:00+05:30"
    payload = {
        "period_start": monday.isoformat(),
        "completions": [{
            "title": "Shipped API",
            "source": "manual",
            "included": True,
            "estimated_hours": 2,
            "completion_date": monday.isoformat(),
        }],
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
    assert data["commitments"][0]["due_date_locked"] is False
    task_id = data["commitments"][0]["task_id"]

    changed = client.put(
        "/api/weekly-updates",
        json={
            **payload,
            "commitments": [
                {
                    "title": "New API integration",
                    "estimated_hours": 4,
                    "due_date": later,
                    "commitment_type": "new",
                    "task_id": task_id,
                }
            ],
        },
        headers=auth_header(emp),
    )
    assert changed.status_code == 200, changed.text
    assert not changed.json()["data"].get("create_errors")
    db_session.expire_all()
    task = db_session.query(Task).filter(Task.id == task_id).first()
    assert task is not None
    assert task.due_date is not None

    task.created_at = datetime.now(timezone.utc) - timedelta(hours=25)
    db_session.commit()

    too_late = (monday + timedelta(days=13)).isoformat() + "T12:00:00+05:30"
    blocked = client.put(
        "/api/weekly-updates",
        json={
            **payload,
            "commitments": [
                {
                    "title": "New API integration",
                    "estimated_hours": 4,
                    "due_date": too_late,
                    "commitment_type": "new",
                    "task_id": task_id,
                }
            ],
        },
        headers=auth_header(emp),
    )
    assert blocked.status_code == 200, blocked.text
    errors = blocked.json()["data"].get("create_errors") or []
    assert errors
    assert "reason" in errors[0]["error"].lower()

    revised = client.put(
        "/api/weekly-updates",
        json={
            **payload,
            "commitments": [
                {
                    "title": "New API integration",
                    "estimated_hours": 4,
                    "due_date": too_late,
                    "commitment_type": "new",
                    "task_id": task_id,
                    "revision_reason": "Scope grew",
                }
            ],
        },
        headers=auth_header(emp),
    )
    assert revised.status_code == 200, revised.text
    assert not revised.json()["data"].get("create_errors")


def test_current_and_previous_week_both_writable_on_monday_morning(client, users):
    emp = users["employee"]
    current = current_week_start()
    previous = current - timedelta(days=7)
    due = (previous + timedelta(days=9)).isoformat() + "T12:00:00+05:30"

    current_payload = {
        "period_start": current.isoformat(),
        "completions": [{
            "title": "Starting this week early",
            "source": "manual",
            "included": True,
            "estimated_hours": 1,
            "completion_date": current.isoformat(),
        }],
        "commitments": [],
    }
    previous_payload = {
        "period_start": previous.isoformat(),
        "completions": [{
            "title": "Wrapped last week",
            "source": "manual",
            "included": True,
            "estimated_hours": 2,
            "completion_date": previous.isoformat(),
        }],
        "commitments": [
            {
                "title": "Next week work",
                "estimated_hours": 2,
                "due_date": due,
                "commitment_type": "new",
            }
        ],
    }

    if is_report_editable(current, "draft"):
        allowed_current = client.put("/api/weekly-updates", json=current_payload, headers=auth_header(emp))
        assert allowed_current.status_code == 200, allowed_current.text

    if is_report_editable(previous, "draft"):
        allowed_prev = client.put("/api/weekly-updates", json=previous_payload, headers=auth_header(emp))
        assert allowed_prev.status_code == 200, allowed_prev.text
        data = allowed_prev.json()["data"]
        assert data["period_start"] == previous.isoformat()
        assert data["editable"] is True
    elif is_report_editable(current, "draft"):
        # Previous week is locked once the new week starts; current remains writable.
        locked = client.put("/api/weekly-updates", json=previous_payload, headers=auth_header(emp))
        assert locked.status_code == 403
        detail = locked.json()["detail"]
        assert "current week" in detail.lower() or "future" in detail.lower()


def test_suggestions_only_include_this_weeks_completed_tasks(client, users, db_session):
    emp = users["employee"]
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


def test_completing_task_adds_it_to_this_weeks_draft(client, users, db_session):
    emp = users["employee"]
    task = Task(
        title="Ship weekly auto-complete",
        status="in_progress",
        priority="medium",
        estimated_hours=2,
        created_by_id=emp.id,
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    res = client.patch(
        f"/api/tasks/{task.id}/status",
        json={"status": "completed"},
        headers=auth_header(emp),
    )
    assert res.status_code == 200, res.text

    history = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(emp))
    assert history.status_code == 200, history.text
    reports = history.json()["data"]["reports"]
    monday = current_week_start()
    if is_report_editable(monday, "draft"):
        assert len(reports) == 1
        assert reports[0]["status"] == "draft"
        titles = [item["title"] for item in reports[0]["completions"]]
        assert "Ship weekly auto-complete" in titles
        assert reports[0]["completions"][0]["task_id"] == task.id
    else:
        assert all(row["period_start"] != monday.isoformat() for row in reports)


def test_history_backfills_this_weeks_completed_tasks(client, users, db_session):
    emp = users["employee"]
    task = Task(
        title="Already done",
        status="completed",
        priority="medium",
        estimated_hours=1,
        created_by_id=emp.id,
        completed_at=datetime.now(timezone.utc),
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()

    history = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(emp))
    assert history.status_code == 200, history.text
    reports = history.json()["data"]["reports"]
    monday = current_week_start()
    if is_report_editable(monday, "draft"):
        assert len(reports) == 1
        assert reports[0]["status"] == "draft"
        assert reports[0]["completions"][0]["title"] == "Already done"
    else:
        assert all(row["period_start"] != monday.isoformat() for row in reports)


def test_reopening_task_removes_suggested_completion(client, users, db_session):
    emp = users["employee"]
    task = Task(
        title="Reopen me",
        status="in_progress",
        priority="medium",
        estimated_hours=1,
        created_by_id=emp.id,
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    complete = client.patch(
        f"/api/tasks/{task.id}/status",
        json={"status": "completed"},
        headers=auth_header(emp),
    )
    assert complete.status_code == 200, complete.text
    reopen = client.post(f"/api/tasks/{task.id}/reopen", headers=auth_header(emp))
    assert reopen.status_code == 200, reopen.text

    history = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(emp))
    reports = history.json()["data"]["reports"]
    completions = reports[0]["completions"] if reports else []
    assert all(item["task_id"] != task.id for item in completions)


def test_carry_forward_reuses_task(client, users, db_session):
    emp = users["employee"]
    previous_monday = monday_of(date.today()) - timedelta(days=7)
    prior_due = due_at_noon(previous_monday + timedelta(days=2))
    task = Task(
        title="Unfinished API",
        status="in_progress",
        priority="medium",
        estimated_hours=4,
        created_by_id=emp.id,
        due_date=prior_due,
        original_due_date=prior_due,
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
    assert items[0]["commitment_type"] == "carried_forward"


def test_carry_forward_includes_overdue_without_prior_report(client, users, db_session):
    emp = users["employee"]
    prior_due = due_at_noon(monday_of(date.today()) - timedelta(days=5))
    task = Task(
        title="Overdue without weekly report",
        status="in_progress",
        priority="medium",
        estimated_hours=3,
        created_by_id=emp.id,
        due_date=prior_due,
        original_due_date=prior_due,
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    res = client.get("/api/weekly-updates/carry-forward", headers=auth_header(emp))
    assert res.status_code == 200
    data = res.json()["data"]
    items = data["items"]
    assert any(row["task_id"] == task.id and row["is_carried_forward"] is True and row["is_overdue"] is True for row in items)
    history = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(emp))
    assert history.status_code == 200
    outstanding = history.json()["data"]["outstanding"]
    assert any(row["task_id"] == task.id for row in outstanding)


def test_due_today_is_not_overdue_or_carried(client, users, db_session):
    emp = users["employee"]
    task = Task(
        title="Due today still on track",
        status="in_progress",
        priority="medium",
        estimated_hours=2,
        created_by_id=emp.id,
        due_date=due_at_noon(today_local()),
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    res = client.get("/api/weekly-updates/carry-forward", headers=auth_header(emp))
    assert res.status_code == 200
    data = res.json()["data"]
    items = data.get("items") or []
    due_next = data.get("due_this_week") or []
    current_week = data.get("current_week_tasks") or []
    assert all(row["task_id"] != task.id for row in items)
    assert all(row["task_id"] != task.id for row in due_next)
    # After the working week ends, unfinished this-week work stays in Current Week as CF.
    if data.get("working_week_ended"):
        assert any(row["task_id"] == task.id and row["is_carried_forward"] is True for row in current_week)
    else:
        assert any(row["task_id"] == task.id and row["is_carried_forward"] is False for row in current_week)


def test_due_next_week_from_created_tracker_task(client, users, db_session):
    emp = users["employee"]
    monday = current_week_start()
    next_monday = monday + timedelta(days=7)
    due_day = next_monday + timedelta(days=2)
    task = Task(
        title="Created in tracker for next week",
        status="to_do",
        priority="medium",
        estimated_hours=2,
        created_by_id=emp.id,
        due_date=due_at_noon(due_day),
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    res = client.get("/api/weekly-updates/carry-forward", headers=auth_header(emp))
    assert res.status_code == 200
    data = res.json()["data"]
    due_this_week = data.get("due_this_week") or []
    assert data["planning_start"] == next_monday.isoformat()
    assert any(row["task_id"] == task.id and row["is_carried_forward"] is False for row in due_this_week)
    history = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(emp))
    assert history.status_code == 200
    body = history.json()["data"]
    assert body["current_period_end"] == working_week_end(monday_of(date.fromisoformat(body["current_period_start"]))).isoformat()
    assert body["planning_start"] == next_monday.isoformat()
    assert any(row["task_id"] == task.id for row in (body.get("due_this_week") or []))


def test_undated_tracker_task_buckets_as_next_week(client, users, db_session):
    """Tasks created without a due date stay in next week until a due date is set."""
    emp = users["employee"]
    task = Task(
        title="Forgot due date",
        status="to_do",
        priority="medium",
        estimated_hours=2,
        created_by_id=emp.id,
        due_date=None,
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    res = client.get("/api/weekly-updates/carry-forward", headers=auth_header(emp))
    assert res.status_code == 200
    data = res.json()["data"]
    next_ids = {row["task_id"] for row in (data.get("next_week_tasks") or [])}
    current_ids = {row["task_id"] for row in (data.get("current_week_tasks") or [])}
    assert task.id in next_ids
    assert task.id not in current_ids
    assert any(
        row["task_id"] == task.id and row.get("due_date") in (None, "")
        for row in (data.get("next_week_tasks") or [])
    )


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


def test_completed_task_can_revise_deadline(client, users, db_session):
    emp = users["employee"]
    original = datetime.now(timezone.utc) - timedelta(days=3)
    task = Task(
        title="Done but revised",
        status="completed",
        priority="medium",
        estimated_hours=1,
        created_by_id=emp.id,
        due_date=original,
        original_due_date=original,
        completed_at=datetime.now(timezone.utc),
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    new_due = (date.today() + timedelta(days=2)).isoformat() + "T12:00:00+05:30"
    res = client.post(
        f"/api/tasks/{task.id}/deadline-revision",
        json={"reason": "Cross check was required", "new_due_date": new_due},
        headers=auth_header(emp),
    )
    assert res.status_code == 200, res.text
    assert res.json()["data"]["reason"] == "Cross check was required"
    db_session.refresh(task)
    assert task.status == "completed"
    assert task.due_date is not None


def test_due_date_locks_and_revision_works_before_overdue(client, users, db_session):
    emp = users["employee"]
    first_due = (date.today() + timedelta(days=5)).isoformat() + "T12:00:00+05:30"
    created = client.post(
        "/api/tasks",
        json={
            "title": "Lockable due",
            "priority": "medium",
            "estimated_hours": 2,
            "due_date": first_due,
            "assignee_ids": [emp.id],
        },
        headers=auth_header(emp),
    )
    assert created.status_code == 200, created.text
    body = created.json()["data"]
    task_id = body["id"]
    original = body["due_date"]
    assert body["due_date_locked"] is False

    later = (date.today() + timedelta(days=8)).isoformat() + "T12:00:00+05:30"
    changed = client.put(
        f"/api/tasks/{task_id}",
        json={"due_date": later, "title": "Lockable due"},
        headers=auth_header(emp),
    )
    assert changed.status_code == 200, changed.text
    changed_due = changed.json()["data"]["due_date"]
    assert changed_due != original
    assert changed.json()["data"]["due_date_locked"] is False

    db_session.expire_all()
    task = db_session.query(Task).filter(Task.id == task_id).first()
    assert task is not None
    task.created_at = datetime.now(timezone.utc) - timedelta(hours=25)
    db_session.commit()

    too_late = (date.today() + timedelta(days=12)).isoformat() + "T12:00:00+05:30"
    updated = client.put(
        f"/api/tasks/{task_id}",
        json={"due_date": too_late, "title": "Lockable due"},
        headers=auth_header(emp),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["data"]["due_date"] == changed_due
    assert updated.json()["data"]["due_date_locked"] is True
    db_session.expire_all()
    task = db_session.query(Task).filter(Task.id == task_id).first()
    assert task is not None
    assert task.due_date is not None
    assert task.original_due_date is not None

    revised = client.post(
        f"/api/tasks/{task_id}/deadline-revision",
        json={"reason": "Scope grew", "new_due_date": too_late},
        headers=auth_header(emp),
    )
    assert revised.status_code == 200, revised.text
    assert revised.json()["data"]["reason"] == "Scope grew"
    history = client.get(f"/api/tasks/{task_id}/deadline-revisions", headers=auth_header(emp))
    assert history.status_code == 200
    assert len(history.json()["data"]) == 1
    assert original is not None


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


def test_leave_context_uses_attendance_leave(client, users, db_session):
    emp = users["employee"]
    monday = monday_of(date.today())
    leave_day = monday + timedelta(days=2)
    db_session.add(
        Attendance(user_id=emp.id, attendance_date=leave_day, status="LEAVE")
    )
    db_session.commit()

    res = client.get(
        "/api/weekly-updates/leave-context",
        params={"week_start": monday.isoformat()},
        headers=auth_header(emp),
    )
    assert res.status_code == 200
    days = res.json()["data"]["reporting"]["leave_days"]
    assert any(d["date"] == leave_day.isoformat() and d["label"] == "Annual leave" for d in days)


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
    body = res.json()["data"]
    reports = body["reports"]
    submitted = [r for r in reports if r["status"] == "submitted"]
    assert [r["period_start"] for r in submitted] == [newer.isoformat(), older.isoformat()]
    assert body["writable_period_start"] == writable_period_start().isoformat()
    # Auto-provisioned writable week is always present even with zero tasks.
    assert any(r["period_start"] == body["writable_period_start"] for r in reports)


def test_overview_uses_real_counts(client, users):
    emp = users["employee"]
    res = client.get("/api/weekly-updates/overview", headers=auth_header(emp))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["employee_count"] >= 2
    assert data["pending"] >= 1
    assert data["submitted"] == 0


def test_working_week_bounds_and_sunday_transition():
    working_sat_week = date(2026, 11, 16)  # Sat 21 Nov is working (3rd Saturday)
    off_sat_week = date(2026, 11, 23)  # Sat 28 Nov is 4th Saturday (off)
    assert working_week_end(working_sat_week) == date(2026, 11, 21)
    assert working_week_end(off_sat_week) == date(2026, 11, 27)
    assert week_date_bounds(working_sat_week) == (date(2026, 11, 16), date(2026, 11, 22))
    zone = get_app_timezone()
    assert working_week_has_ended(working_sat_week, datetime(2026, 11, 21, 23, 0, tzinfo=zone)) is False
    assert working_week_has_ended(working_sat_week, datetime(2026, 11, 22, 0, 0, tzinfo=zone)) is True


def test_empty_employee_gets_auto_weekly_update(client, users, db_session):
    emp = users["employee"]
    assert db_session.query(WeeklyReport).filter(WeeklyReport.user_id == emp.id).count() == 0
    history = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(emp))
    assert history.status_code == 200, history.text
    body = history.json()["data"]
    writable = body["writable_period_start"]
    reports = body["reports"]
    assert any(r["period_start"] == writable for r in reports)
    match = next(r for r in reports if r["period_start"] == writable)
    assert match["completions"] == []
    assert "current_week_tasks" in match
    assert "next_week_tasks" in match
    assert match["current_week_tasks"] == [] or isinstance(match["current_week_tasks"], list)
    # Idempotent: second fetch does not duplicate.
    history2 = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(emp))
    assert history2.status_code == 200
    same = [r for r in history2.json()["data"]["reports"] if r["period_start"] == writable]
    assert len(same) == 1
    assert db_session.query(WeeklyReport).filter(
        WeeklyReport.user_id == emp.id, WeeklyReport.period_start == date.fromisoformat(writable)
    ).count() == 1


def test_upcoming_week_gets_open_empty_draft(client, users, db_session):
    emp = users["employee"]
    upcoming = writable_period_start() + timedelta(days=7)
    history = client.get(
        f"/api/weekly-updates/users/{emp.id}",
        params={"week_start": upcoming.isoformat()},
        headers=auth_header(emp),
    )
    assert history.status_code == 200, history.text
    body = history.json()["data"]
    match = next((r for r in body["reports"] if r["period_start"] == upcoming.isoformat()), None)
    assert match is not None
    assert match["editable"] is True
    assert match["completions"] == []
    assert match["current_week_tasks"] == [] or isinstance(match["current_week_tasks"], list)
    assert match["next_week_tasks"] == [] or isinstance(match["next_week_tasks"], list)

    # Can submit a plan for the upcoming week even before it starts.
    due = (upcoming + timedelta(days=2)).isoformat() + "T12:00:00+05:30"
    res = client.put(
        "/api/weekly-updates",
        json={
            "period_start": upcoming.isoformat(),
            "completions": [],
            "commitments": [
                {
                    "title": "Plan ahead task",
                    "due_date": due,
                    "estimated_hours": 2,
                    "commitment_type": "new",
                }
            ],
        },
        headers=auth_header(emp),
    )
    assert res.status_code == 200, res.text
    assert res.json()["data"]["period_start"] == upcoming.isoformat()
    assert res.json()["data"]["editable"] is True


def test_current_week_and_next_week_buckets_by_due_date(client, users, db_session):
    emp = users["employee"]
    monday = writable_period_start()
    current_due = monday + timedelta(days=2)
    next_due = monday + timedelta(days=9)
    older_due = monday - timedelta(days=3)
    tasks = []
    for title, due in (
        ("Due current week", current_due),
        ("Due next week", next_due),
        ("Carried from prior week", older_due),
    ):
        task = Task(
            title=title,
            status="in_progress",
            priority="medium",
            estimated_hours=2,
            created_by_id=emp.id,
            due_date=due_at_noon(due),
            original_due_date=due_at_noon(due),
        )
        task.assignees.append(TaskAssignee(user_id=emp.id))
        tasks.append(task)
    db_session.add_all(tasks)
    db_session.commit()

    res = client.get(
        "/api/weekly-updates/carry-forward",
        params={"week_start": monday.isoformat()},
        headers=auth_header(emp),
    )
    assert res.status_code == 200
    data = res.json()["data"]
    current_ids = {row["task_id"] for row in (data.get("current_week_tasks") or [])}
    next_ids = {row["task_id"] for row in (data.get("next_week_tasks") or [])}
    by_title = {t.title: t.id for t in tasks}
    if data.get("working_week_ended"):
        assert by_title["Due next week"] in next_ids
        assert by_title["Due current week"] in next_ids
        assert by_title["Carried from prior week"] in next_ids
        assert current_ids == set()
    else:
        assert by_title["Due current week"] in current_ids
        assert by_title["Carried from prior week"] in current_ids
        assert by_title["Due next week"] in next_ids
        assert by_title["Due next week"] not in current_ids


def test_delayed_completion_marked_yellow(client, users, db_session):
    emp = users["employee"]
    monday = writable_period_start()
    if not is_report_editable(monday, "draft"):
        pytest.skip("writable week not editable in this window")
    original_due = monday - timedelta(days=4)
    task = Task(
        title="Finished late after carry",
        status="completed",
        priority="medium",
        estimated_hours=2,
        created_by_id=emp.id,
        due_date=due_at_noon(original_due),
        original_due_date=due_at_noon(original_due),
        completed_at=datetime.now(timezone.utc),
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()

    history = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(emp))
    assert history.status_code == 200
    reports = history.json()["data"]["reports"]
    match = next((r for r in reports if r["period_start"] == monday.isoformat()), None)
    assert match is not None
    completions = match["completions"]
    assert any(
        c["task_id"] == task.id and c.get("is_delayed") is True
        for c in completions
    )


def test_revised_completion_uses_current_due_not_original(client, users, db_session):
    """Meeting a revised deadline should show the new due date and not mark delayed."""
    emp = users["employee"]
    monday = writable_period_start()
    if not is_report_editable(monday, "draft"):
        pytest.skip("writable week not editable in this window")
    original_due = monday - timedelta(days=10)
    revised_due = monday
    completed_at = due_at_noon(monday)
    task = Task(
        title="Camp journey design revised on time",
        status="completed",
        priority="medium",
        estimated_hours=3,
        created_by_id=emp.id,
        due_date=due_at_noon(revised_due),
        original_due_date=due_at_noon(original_due),
        completed_at=completed_at,
    )
    task.assignees.append(TaskAssignee(user_id=emp.id))
    db_session.add(task)
    db_session.commit()

    history = client.get(f"/api/weekly-updates/users/{emp.id}", headers=auth_header(emp))
    assert history.status_code == 200
    reports = history.json()["data"]["reports"]
    match = next((r for r in reports if r["period_start"] == monday.isoformat()), None)
    assert match is not None
    row = next((c for c in match["completions"] if c["task_id"] == task.id), None)
    assert row is not None
    assert row.get("is_delayed") is False
    assert row.get("is_carried_forward") is False
    assert date.fromisoformat(row["due_date"][:10]) == revised_due
    assert date.fromisoformat(row["original_due_date"][:10]) == original_due


def test_ensure_all_writable_reports_idempotent(client, users, db_session):
    from app.services.weekly_update_service import WeeklyUpdateService

    service = WeeklyUpdateService(db_session)
    first = service.ensure_all_writable_reports()
    second = service.ensure_all_writable_reports()
    writable = date.fromisoformat(first["writable_period_start"])
    assert first["employee_count"] >= 2
    assert second["created"] == 0
    assert (
        db_session.query(WeeklyReport)
        .filter(WeeklyReport.period_start == writable)
        .count()
        == first["employee_count"]
    )
