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
from app.models import Department, EmployeeEvaluationRevision, Task, TaskAssignee, User
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


def score_payload(ratings: dict[str, int] | None = None, user_id: int = 1, period: str = "2026-11-01"):
    chosen = ratings or OFFICIAL
    return {
        "user_id": user_id,
        "period_start": period,
        "overall_comment": "Solid month",
        "scores": [
            {"parameter_key": key, "rating": rating, "remarks": "Noted"}
            for key, rating in chosen.items()
        ],
    }


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
        json=score_payload(user_id=employee.id, ratings={"deadline_adherence": 4, "quality_of_work": 3, "discipline_process": 4, "ownership_accountability": 4, "teamwork_collaboration": 5, "punctuality": 4}),
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
