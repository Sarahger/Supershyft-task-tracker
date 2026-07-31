import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models import Attendance, Department, User


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
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def users(db_session):
    dept = Department(name="Engineering", description="Eng")
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

    manager = User(
        first_name="Man",
        last_name="Ager",
        email="mgr@test.com",
        hashed_password=get_password_hash("x"),
        role="manager",
        status="active",
        job_title="Lead",
    )
    manager.departments = [dept]

    other = User(
        first_name="Other",
        last_name="Person",
        email="other@test.com",
        hashed_password=get_password_hash("x"),
        role="employee",
        status="active",
    )

    db_session.add_all([employee, manager, other])
    db_session.commit()
    db_session.refresh(employee)
    db_session.refresh(manager)
    db_session.refresh(other)
    return {"employee": employee, "manager": manager, "other": other, "dept": dept}


def auth_header(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.id})
    return {"Authorization": f"Bearer {token}"}


def test_unauthenticated_rejected(client):
    assert client.get("/api/attendance/me").status_code == 401
    assert client.post("/api/attendance", json={"status": "WFO"}).status_code == 401


def test_employee_can_mark_and_edit(client, users):
    headers = auth_header(users["employee"])
    r1 = client.post("/api/attendance", json={"status": "WFO"}, headers=headers)
    assert r1.status_code == 200
    assert r1.json()["data"]["status"] == "WFO"
    assert r1.json()["data"]["editable"] is True

    r2 = client.post("/api/attendance", json={"status": "WFH"}, headers=headers)
    assert r2.status_code == 200
    assert r2.json()["data"]["status"] == "WFH"


def test_employee_can_mark_past_day(client, users):
    from datetime import timedelta

    from app.services.attendance_service import today_local

    headers = auth_header(users["employee"])
    yesterday = (today_local() - timedelta(days=1)).isoformat()
    r = client.post(
        "/api/attendance",
        json={"status": "HALF_DAY", "attendance_date": yesterday},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "HALF_DAY"
    assert r.json()["data"]["attendance_date"] == yesterday

    r2 = client.post(
        "/api/attendance",
        json={"status": "CAMP", "attendance_date": yesterday},
        headers=headers,
    )
    assert r2.status_code == 200
    assert r2.json()["data"]["status"] == "CAMP"


def test_future_date_rejected(client, users):
    from datetime import timedelta

    from app.services.attendance_service import today_local

    headers = auth_header(users["employee"])
    tomorrow = (today_local() + timedelta(days=1)).isoformat()
    r = client.post(
        "/api/attendance",
        json={"status": "WFO", "attendance_date": tomorrow},
        headers=headers,
    )
    assert r.status_code == 400


def test_invalid_status_rejected(client, users):
    headers = auth_header(users["employee"])
    # Pydantic rejects unknown literal
    r = client.post("/api/attendance", json={"status": "HACK<script>"}, headers=headers)
    assert r.status_code == 422


def test_employee_cannot_access_hr_endpoints(client, users):
    headers = auth_header(users["employee"])
    assert client.get("/api/attendance", headers=headers).status_code == 403
    assert client.get("/api/attendance/week", headers=headers).status_code == 403
    assert client.get(f"/api/attendance/users/{users['other'].id}", headers=headers).status_code == 403
    assert client.post("/api/attendance/export/csv", json={}, headers=headers).status_code == 403


def test_employee_me_only_own_records(client, users, db_session):
    from app.services.attendance_service import today_local, now_utc

    other_rec = Attendance(
        user_id=users["other"].id,
        attendance_date=today_local(),
        status="WFH",
        recorded_at=now_utc(),
    )
    db_session.add(other_rec)
    db_session.commit()

    headers = auth_header(users["employee"])
    client.post("/api/attendance", json={"status": "WFO"}, headers=headers)
    me = client.get("/api/attendance/me", headers=headers)
    assert me.status_code == 200
    records = me.json()["data"]["records"]
    assert all(r["user_id"] == users["employee"].id for r in records)
    assert me.json()["data"]["today_record"]["status"] == "WFO"


def test_manager_can_list_and_export(client, users):
    emp_headers = auth_header(users["employee"])
    client.post("/api/attendance", json={"status": "LEAVE"}, headers=emp_headers)

    mgr = auth_header(users["manager"])
    listed = client.get("/api/attendance", headers=mgr)
    assert listed.status_code == 200
    stats = listed.json()["data"]["today_stats"]
    assert stats["on_leave"] >= 1
    assert len(stats["people"]["on_leave"]) == stats["on_leave"]
    assert any(p["id"] == users["employee"].id for p in stats["people"]["on_leave"])

    week = client.get("/api/attendance/week", headers=mgr)
    assert week.status_code == 200
    assert len(week.json()["data"]["rows"]) >= 2

    detail = client.get(f"/api/attendance/users/{users['employee'].id}", headers=mgr)
    assert detail.status_code == 200
    assert detail.json()["data"]["user"]["id"] == users["employee"].id

    export = client.post(
        "/api/attendance/export/csv",
        json={"status": "ALL"},
        headers=mgr,
    )
    assert export.status_code == 200
    assert "text/csv" in export.headers["content-type"]
    assert "Employee" in export.text
    assert "attachment; filename=attendance_export.csv" in export.headers["content-disposition"]


def test_injection_status_filter_rejected(client, users):
    mgr = auth_header(users["manager"])
    r = client.get("/api/attendance", params={"status": "WFO; DROP TABLE"}, headers=mgr)
    assert r.status_code == 400
