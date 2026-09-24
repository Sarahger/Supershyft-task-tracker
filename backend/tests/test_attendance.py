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


def test_older_than_yesterday_rejected(client, users):
    from datetime import timedelta

    from app.services.attendance_service import today_local

    headers = auth_header(users["employee"])
    two_days_ago = (today_local() - timedelta(days=2)).isoformat()
    r = client.post(
        "/api/attendance",
        json={"status": "WFO", "attendance_date": two_days_ago},
        headers=headers,
    )
    assert r.status_code == 400
    assert "today and yesterday" in r.json()["detail"].lower()


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


def test_employee_cannot_mark_for_other_user(client, users):
    headers = auth_header(users["employee"])
    r = client.post(
        "/api/attendance",
        json={"status": "WFO", "user_id": users["other"].id},
        headers=headers,
    )
    assert r.status_code == 403


def test_manager_can_mark_for_other_user(client, users):
    mgr = auth_header(users["manager"])
    target_id = users["employee"].id
    r = client.post(
        "/api/attendance",
        json={"status": "WFH", "user_id": target_id},
        headers=mgr,
    )
    assert r.status_code == 200
    assert r.json()["data"]["user_id"] == target_id
    assert r.json()["data"]["status"] == "WFH"

    # Edit again
    r2 = client.post(
        "/api/attendance",
        json={"status": "LEAVE", "user_id": target_id},
        headers=mgr,
    )
    assert r2.status_code == 200
    assert r2.json()["data"]["status"] == "LEAVE"


def test_manager_cannot_mark_inactive_user(client, users, db_session):
    inactive = users["other"]
    inactive.status = "inactive"
    db_session.commit()

    mgr = auth_header(users["manager"])
    r = client.post(
        "/api/attendance",
        json={"status": "WFO", "user_id": inactive.id},
        headers=mgr,
    )
    assert r.status_code == 404


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

    day = client.get("/api/attendance/day", headers=mgr)
    assert day.status_code == 200
    day_data = day.json()["data"]
    assert day_data["stats"]["on_leave"] >= 1
    assert any(r["user"]["id"] == users["employee"].id and r["status"] == "LEAVE" for r in day_data["rows"])

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


def test_working_days_exclude_weekends_and_company_holidays():
    from datetime import date

    from app.core.company_holidays import (
        is_listed_company_holiday,
        is_non_working_day,
        is_weekend_off,
        is_working_day,
    )
    from app.services.attendance_service import _is_company_holiday, _working_days_in_month

    # August 2026: Sat 8 = 2nd Sat, Sat 22 = 4th Sat
    assert _is_company_holiday(date(2026, 8, 2))  # Sunday
    assert _is_company_holiday(date(2026, 8, 8))  # 2nd Saturday
    assert _is_company_holiday(date(2026, 8, 22))  # 4th Saturday
    assert is_working_day(date(2026, 8, 1))  # 1st Saturday
    assert is_working_day(date(2026, 8, 3))  # Monday

    # Company holidays
    assert is_listed_company_holiday(date(2026, 8, 15))  # Independence Day (3rd Sat)
    assert is_listed_company_holiday(date(2026, 8, 28))  # Raksha Bandhan (Fri)
    assert is_non_working_day(date(2026, 8, 15))
    assert is_non_working_day(date(2026, 8, 28))
    assert not is_working_day(date(2026, 1, 1))  # New Year
    assert not is_working_day(date(2026, 12, 25))  # Christmas

    # Full August 2026: 31 − 5 Sundays − 2nd Sat − 4th Sat − Independence Day − Raksha Bandhan = 22
    assert _working_days_in_month(2026, 8, date(2026, 8, 31)) == 22

    # Overlap: weekend off without listed holiday still counts once
    sunday = date(2026, 1, 4)
    assert is_weekend_off(sunday)
    assert is_non_working_day(sunday)
    assert not is_listed_company_holiday(sunday)


def test_attendance_percent_excludes_non_working_days(client, users, db_session):
    """Unmarked Sunday/holiday must not reduce attendance %."""
    from datetime import date, timedelta

    from app.core.company_holidays import is_working_day
    from app.services.attendance_service import AttendanceService, now_utc

    employee = users["employee"]
    db_session.add(
        Attendance(
            user_id=employee.id,
            attendance_date=date(2026, 1, 2),  # Friday working day
            status="WFO",
            recorded_at=now_utc(),
        )
    )
    db_session.commit()

    working = 0
    d = date(2026, 1, 1)
    while d <= date(2026, 1, 31):
        if is_working_day(d):
            working += 1
        d += timedelta(days=1)

    summary = AttendanceService(db_session).get_me(employee, month=1, year=2026)["summary"]
    assert summary["working_days"] == working
    assert summary["present_count"] == 1
    assert summary["attendance_percent"] == round((1 / working) * 100, 1)


def test_leave_on_working_day_does_not_count_as_present(client, users, db_session):
    from datetime import date

    from app.services.attendance_service import AttendanceService, now_utc

    employee = users["employee"]
    db_session.add(
        Attendance(
            user_id=employee.id,
            attendance_date=date(2026, 1, 2),
            status="LEAVE",
            recorded_at=now_utc(),
        )
    )
    db_session.commit()
    summary = AttendanceService(db_session).get_me(employee, month=1, year=2026)["summary"]
    assert summary["leave_count"] == 1
    assert summary["present_count"] == 0
    assert summary["attendance_percent"] == 0.0
