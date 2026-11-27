from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.kra_scorecard import overall_score
from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models import Attendance, Department, EmployeeEvaluationRevision, Task, TaskAssignee, User
from app.utils.week_periods import due_at_noon


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
    manager = User(
        first_name="Maya",
        last_name="Manager",
        email="maya@test.com",
        hashed_password=get_password_hash("x"),
        role="manager",
        status="active",
    )
    employee = User(
        first_name="Emp",
        last_name="Loyee",
        email="emp@test.com",
        hashed_password=get_password_hash("x"),
        role="employee",
        status="active",
    )
    manager.departments = [dept]
    employee.departments = [dept]
    db_session.add_all([manager, employee])
    db_session.commit()
    return {"manager": manager, "employee": employee, "dept": dept}


def auth_header(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': user.id})}"}


OFFICIAL = {
    "deadline_adherence": 4,
    "quality_of_work": 3,
    "discipline_process": 4,
    "ownership_accountability": 4,
    "teamwork_collaboration": 5,
    "punctuality": 4,
}


def score_payload(
    ratings: dict[str, int] | None = None,
    user_id: int = 1,
    period_start: str = "2026-11-01",
    period_end: str | None = "2026-11-30",
):
    chosen = ratings or OFFICIAL
    body = {
        "user_id": user_id,
        "period_start": period_start,
        "overall_comment": "Solid period",
        "scores": [
            {"parameter_key": key, "rating": rating, "remarks": "Noted"}
            for key, rating in chosen.items()
        ],
    }
    if period_end is not None:
        body["period_end"] = period_end
    return body


def test_official_example_is_77():
    assert overall_score(OFFICIAL) == 77


def test_employee_cannot_read_evaluations(client, users):
    res = client.get(
        "/api/reports/evaluations",
        params={"period_start": "2026-11-01"},
        headers=auth_header(users["employee"]),
    )
    assert res.status_code == 403
    analytics = client.get(
        "/api/reports/analytics",
        params={"start_date": "2026-11-01", "end_date": "2026-11-30"},
        headers=auth_header(users["employee"]),
    )
    assert analytics.status_code == 403


def test_draft_is_hidden_until_submit_and_score_is_server_owned(client, users, db_session):
    manager = users["manager"]
    employee = users["employee"]
    created = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id),
        headers=auth_header(manager),
    )
    assert created.status_code == 200, created.text
    body = created.json()["data"]
    assert body["status"] == "draft"
    assert body["overall_score"] == 77
    assert body["period_end"] == "2026-11-30"
    evaluation_id = body["id"]

    duplicate = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id),
        headers=auth_header(manager),
    )
    assert duplicate.status_code == 409

    hidden = client.get(
        "/api/reports/analytics",
        params={"start_date": "2026-11-01", "end_date": "2026-11-30"},
        headers=auth_header(manager),
    )
    assert hidden.status_code == 200
    assert hidden.json()["data"]["top_performers"] == []

    submitted = client.post(
        f"/api/reports/evaluations/{evaluation_id}/submit",
        json=score_payload(user_id=employee.id),
        headers=auth_header(manager),
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["data"]["overall_score"] == 77
    assert submitted.json()["data"]["status"] == "submitted"

    ranked = client.get(
        "/api/reports/analytics",
        params={"start_date": "2026-11-01", "end_date": "2026-11-30"},
        headers=auth_header(manager),
    )
    performers = ranked.json()["data"]["top_performers"]
    assert len(performers) == 1
    assert performers[0]["evaluation_id"] == evaluation_id
    assert performers[0]["score"] == 77

    edited = dict(OFFICIAL)
    edited["punctuality"] = 2
    changed = client.post(
        f"/api/reports/evaluations/{evaluation_id}/submit",
        json=score_payload(ratings=edited, user_id=employee.id),
        headers=auth_header(manager),
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["data"]["overall_score"] == 75
    db_session.expire_all()
    revisions = db_session.query(EmployeeEvaluationRevision).all()
    assert len(revisions) == 1
    assert "77" in revisions[0].snapshot_json


def test_weekly_periods_average_for_month(client, users):
    manager = users["manager"]
    employee = users["employee"]
    headers = auth_header(manager)

    week1 = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id, period_start="2026-11-01", period_end="2026-11-07"),
        headers=headers,
    )
    assert week1.status_code == 200, week1.text
    week1_id = week1.json()["data"]["id"]
    submit1 = client.post(
        f"/api/reports/evaluations/{week1_id}/submit",
        json=score_payload(user_id=employee.id, period_start="2026-11-01", period_end="2026-11-07"),
        headers=headers,
    )
    assert submit1.status_code == 200

    weaker = dict(OFFICIAL)
    weaker["deadline_adherence"] = 2
    weaker["quality_of_work"] = 2
    week2 = client.post(
        "/api/reports/evaluations",
        json=score_payload(
            ratings=weaker,
            user_id=employee.id,
            period_start="2026-11-08",
            period_end="2026-11-14",
        ),
        headers=headers,
    )
    assert week2.status_code == 200, week2.text
    week2_id = week2.json()["data"]["id"]
    submit2 = client.post(
        f"/api/reports/evaluations/{week2_id}/submit",
        json=score_payload(
            ratings=weaker,
            user_id=employee.id,
            period_start="2026-11-08",
            period_end="2026-11-14",
        ),
        headers=headers,
    )
    assert submit2.status_code == 200
    score1 = submit1.json()["data"]["overall_score"]
    score2 = submit2.json()["data"]["overall_score"]
    expected_avg = round((score1 + score2) / 2, 2)

    listing = client.get(
        "/api/reports/evaluations",
        params={"period_start": "2026-11-01"},
        headers=headers,
    )
    assert listing.status_code == 200
    item = next(row for row in listing.json()["data"]["items"] if row["user_id"] == employee.id)
    assert item["submitted_count"] == 2
    assert item["evaluation_count"] == 2
    assert item["monthly_average"] == expected_avg
    assert len(item["evaluations"]) == 2

    ranked = client.get(
        "/api/reports/analytics",
        params={"start_date": "2026-11-01", "end_date": "2026-11-30"},
        headers=headers,
    )
    performers = ranked.json()["data"]["top_performers"]
    assert len(performers) == 1
    assert performers[0]["score"] == expected_avg
    assert performers[0]["evaluation_count"] == 2


def test_rejects_overlap_and_cross_month_and_short_period(client, users):
    manager = users["manager"]
    employee = users["employee"]
    headers = auth_header(manager)

    first = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id, period_start="2026-11-01", period_end="2026-11-14"),
        headers=headers,
    )
    assert first.status_code == 200, first.text

    overlap = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id, period_start="2026-11-10", period_end="2026-11-20"),
        headers=headers,
    )
    assert overlap.status_code == 409

    cross = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id, period_start="2026-11-28", period_end="2026-12-04"),
        headers=headers,
    )
    assert cross.status_code == 400

    short = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id, period_start="2026-11-20", period_end="2026-11-22"),
        headers=headers,
    )
    assert short.status_code == 400


def test_month_start_only_defaults_to_full_month(client, users):
    manager = users["manager"]
    employee = users["employee"]
    created = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id, period_start="2026-11-01", period_end=None),
        headers=auth_header(manager),
    )
    assert created.status_code == 200, created.text
    assert created.json()["data"]["period_start"] == "2026-11-01"
    assert created.json()["data"]["period_end"] == "2026-11-30"


def test_leave_blocks_full_week_and_notes_partial_days(client, users, db_session):
    manager = users["manager"]
    employee = users["employee"]
    headers = auth_header(manager)

    # Working days in 2026-11-01..07 are Mon–Thu (Diwali week).
    for day in (date(2026, 11, 2), date(2026, 11, 3), date(2026, 11, 4), date(2026, 11, 5)):
        db_session.add(Attendance(user_id=employee.id, attendance_date=day, status="LEAVE"))
    db_session.commit()

    blocked = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id, period_start="2026-11-01", period_end="2026-11-07"),
        headers=headers,
    )
    assert blocked.status_code == 400
    assert "on leave" in blocked.json()["detail"].lower()

    leave_ctx = client.get(
        "/api/reports/evaluations/leave-context",
        params={
            "user_id": employee.id,
            "period_start": "2026-11-01",
            "period_end": "2026-11-07",
        },
        headers=headers,
    )
    assert leave_ctx.status_code == 200
    assert leave_ctx.json()["data"]["fully_on_leave"] is True

    db_session.query(Attendance).delete()
    db_session.add(Attendance(user_id=employee.id, attendance_date=date(2026, 11, 3), status="LEAVE"))
    db_session.add(Attendance(user_id=employee.id, attendance_date=date(2026, 11, 4), status="HALF_DAY"))
    db_session.commit()

    partial = client.get(
        "/api/reports/evaluations/leave-context",
        params={
            "user_id": employee.id,
            "period_start": "2026-11-01",
            "period_end": "2026-11-07",
        },
        headers=headers,
    )
    assert partial.status_code == 200
    body = partial.json()["data"]
    assert body["fully_on_leave"] is False
    assert body["suggested_comment"].startswith("Leave / half days in this period:")
    assert "3 Nov (leave)" in body["suggested_comment"]
    assert "4 Nov (half day)" in body["suggested_comment"]

    created = client.post(
        "/api/reports/evaluations",
        json=score_payload(user_id=employee.id, period_start="2026-11-01", period_end="2026-11-07"),
        headers=headers,
    )
    assert created.status_code == 200, created.text

    listing = client.get(
        "/api/reports/evaluations",
        params={"period_start": "2026-11-01"},
        headers=headers,
    )
    assert listing.status_code == 200
    item = next(row for row in listing.json()["data"]["items"] if row["user_id"] == employee.id)
    statuses = {row["date"]: row["status"] for row in item["leave_days"]}
    assert statuses["2026-11-03"] == "LEAVE"
    assert statuses["2026-11-04"] == "HALF_DAY"


def test_status_counts_and_completion_trend(client, users, db_session):
    manager = users["manager"]
    employee = users["employee"]
    due = due_at_noon(date(2026, 11, 12))
    done = Task(
        title="Finished screens",
        status="completed",
        priority="medium",
        created_by_id=employee.id,
        due_date=due,
        completed_at=due,
    )
    open_task = Task(
        title="Still open",
        status="in_progress",
        priority="medium",
        created_by_id=employee.id,
        due_date=due,
    )
    done.assignees.append(TaskAssignee(user_id=employee.id))
    open_task.assignees.append(TaskAssignee(user_id=employee.id))
    db_session.add_all([done, open_task])
    db_session.commit()

    res = client.get(
        "/api/reports/analytics",
        params={"start_date": "2026-11-01", "end_date": "2026-11-30"},
        headers=auth_header(manager),
    )
    assert res.status_code == 200, res.text
    body = res.json()["data"]
    counts = {row["status"]: row["count"] for row in body["by_status"]}
    assert counts["completed"] == 1
    assert counts["in_progress"] == 1
    assert "on_time" not in body
    assert "overdue_ageing" not in body
    trend = body["completion_trend"]
    assert sum(point["due"] for point in trend) == 2
    assert sum(point["completed"] for point in trend) == 1
