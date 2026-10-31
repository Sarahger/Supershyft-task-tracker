from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models import Announcement, Department, User
from app.utils.week_periods import monday_of, today_local


def auth_header(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': user.id})}"}


def setup_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    def _override():
        yield session

    app.dependency_overrides[get_db] = _override
    client = TestClient(app)
    return client, session, engine


def make_users(session):
    dept = Department(name="Tech", description="Engineering")
    session.add(dept)
    session.flush()
    employee = User(
        first_name="Emp",
        last_name="Loyee",
        email="emp@test.com",
        hashed_password=get_password_hash("x"),
        role="employee",
        status="active",
    )
    other = User(
        first_name="Other",
        last_name="Person",
        email="other@test.com",
        hashed_password=get_password_hash("x"),
        role="employee",
        status="active",
    )
    employee.departments = [dept]
    other.departments = [dept]
    session.add_all([employee, other])
    session.commit()
    session.refresh(employee)
    session.refresh(other)
    return employee, other


def test_create_list_react_and_unread():
    client, session, engine = setup_client()
    try:
        emp, other = make_users(session)
        created = client.post(
            "/api/announcements",
            json={"body": "Shipped the tracker @Other Person", "mentioned_user_ids": [other.id]},
            headers=auth_header(emp),
        )
        assert created.status_code == 200, created.text
        item = created.json()["data"]
        assert "Shipped the tracker" in item["body"]
        assert item["reaction_count"] == 0

        unread = client.get("/api/announcements/unread-count", headers=auth_header(other))
        assert unread.status_code == 200
        assert unread.json()["data"]["count"] == 1

        seen = client.post("/api/announcements/seen", headers=auth_header(other))
        assert seen.status_code == 200
        unread_after = client.get("/api/announcements/unread-count", headers=auth_header(other))
        assert unread_after.json()["data"]["count"] == 0

        reacted = client.post(f"/api/announcements/{item['id']}/reactions", headers=auth_header(other))
        assert reacted.status_code == 200
        assert reacted.json()["data"]["reaction_count"] == 1
        assert reacted.json()["data"]["reacted"] is True

        listed = client.get("/api/announcements", headers=auth_header(emp))
        assert listed.status_code == 200
        assert len(listed.json()["data"]["items"]) == 1
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_week_view_hides_previous_week():
    client, session, engine = setup_client()
    try:
        emp, _other = make_users(session)
        last_monday = monday_of(today_local()) - timedelta(days=7)
        old = Announcement(
            author_id=emp.id,
            body="Last week win",
            week_start=last_monday,
            created_at=datetime.now(timezone.utc) - timedelta(days=8),
        )
        session.add(old)
        session.commit()

        created = client.post(
            "/api/announcements",
            json={"body": "This week win"},
            headers=auth_header(emp),
        )
        assert created.status_code == 200, created.text

        current = client.get("/api/announcements", headers=auth_header(emp))
        titles = [row["body"] for row in current.json()["data"]["items"]]
        assert "This week win" in titles
        assert "Last week win" not in titles

        previous = client.get(
            "/api/announcements",
            params={"week_start": last_monday.isoformat()},
            headers=auth_header(emp),
        )
        prev_titles = [row["body"] for row in previous.json()["data"]["items"]]
        assert "Last week win" in prev_titles
        assert "This week win" not in prev_titles
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_author_filter_and_invalid_link():
    client, session, engine = setup_client()
    try:
        emp, other = make_users(session)
        client.post("/api/announcements", json={"body": "Emp note"}, headers=auth_header(emp))
        client.post("/api/announcements", json={"body": "Other note"}, headers=auth_header(other))
        filtered = client.get(
            "/api/announcements",
            params={"author_id": other.id},
            headers=auth_header(emp),
        )
        bodies = [row["body"] for row in filtered.json()["data"]["items"]]
        assert bodies == ["Other note"]

        bad = client.post(
            "/api/announcements",
            json={"body": "With a bad link", "links": [{"url": "not-a-url"}]},
            headers=auth_header(emp),
        )
        assert bad.status_code == 400
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
