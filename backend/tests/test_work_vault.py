from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models import Department, User, WorkVaultResource


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
    admin = User(
        first_name="Ada",
        last_name="Admin",
        email="admin@test.com",
        hashed_password=get_password_hash("x"),
        role="administrator",
        status="active",
    )
    employee.departments = [dept]
    other.departments = [dept]
    admin.departments = [dept]
    session.add_all([employee, other, admin])
    session.commit()
    session.refresh(employee)
    session.refresh(other)
    session.refresh(admin)
    return employee, other, admin


def create_link(client, user, **overrides):
    payload = {
        "title": "Figma kit",
        "description": "Shared design system",
        "category": "Designs & Creative Assets",
        "url": "https://www.figma.com/file/abc",
        "tags": "design, tokens",
    }
    payload.update(overrides)
    return client.post("/api/work-vault/resources", data=payload, headers=auth_header(user))


def test_unauthenticated_access_rejected():
    client, session, engine = setup_client()
    try:
        listed = client.get("/api/work-vault/resources")
        assert listed.status_code == 401
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_employee_upload_is_company_wide_and_searchable():
    client, session, engine = setup_client()
    try:
        emp, other, _admin = make_users(session)
        created = create_link(client, emp)
        assert created.status_code == 200, created.text
        item = created.json()["data"]
        assert item["title"] == "Figma kit"
        assert item["uploaded_by"]["first_name"] == "Emp"
        assert item["url"] == "https://www.figma.com/file/abc"
        assert "file_path" not in item
        assert item["tags"] == ["design", "tokens"]

        listed = client.get("/api/work-vault/resources", headers=auth_header(other))
        assert listed.status_code == 200
        assert listed.json()["data"]["total"] == 1
        assert listed.json()["data"]["items"][0]["id"] == item["id"]

        for query in ("Figma", "figma.com", "Shared design", "tokens", "Designs & Creative", "Emp"):
            found = client.get("/api/work-vault/resources", params={"q": query}, headers=auth_header(other))
            assert found.status_code == 200, query
            assert found.json()["data"]["total"] == 1, query

        missed = client.get("/api/work-vault/resources", params={"q": "payroll"}, headers=auth_header(other))
        assert missed.json()["data"]["total"] == 0
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_validation_filters_sort_and_permissions():
    client, session, engine = setup_client()
    try:
        emp, other, admin = make_users(session)
        missing = client.post(
            "/api/work-vault/resources",
            data={"title": "No body", "category": "Other"},
            headers=auth_header(emp),
        )
        assert missing.status_code == 422

        invalid = create_link(client, emp, url="notaurl", description="Useful notes")
        assert invalid.status_code == 400

        first = create_link(client, emp, title="API docs", category="Technical Documentation", url="https://docs.example.com")
        second = create_link(
            client,
            other,
            title="Brand deck",
            description="Q3 report slides",
            category="Reports & Analytics",
            url="https://docs.google.com/presentation/d/1",
            tags="report",
        )
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text

        upload = client.post(
            "/api/work-vault/resources",
            data={
                "title": "OpenAPI spec",
                "description": "Current REST contract",
                "category": "Technical Documentation",
                "tags": "api",
            },
            files={"file": ("openapi.json", b'{"openapi":"3.0.0"}', "application/json")},
            headers=auth_header(emp),
        )
        assert upload.status_code == 200, upload.text
        file_item = upload.json()["data"]
        assert file_item["resource_type"] == "file"
        assert file_item["file_kind"] == "code"
        assert file_item["filename"] == "openapi.json"
        assert file_item["url"] is None

        filtered = client.get(
            "/api/work-vault/resources",
            params={"q": "API", "category": "Technical Documentation", "uploaded_by_id": emp.id, "sort": "title"},
            headers=auth_header(other),
        )
        assert filtered.status_code == 200
        titles = [row["title"] for row in filtered.json()["data"]["items"]]
        assert titles == ["API docs", "OpenAPI spec"]

        kinds = client.get(
            "/api/work-vault/resources",
            params={"file_kind": "link", "sort": "recent"},
            headers=auth_header(emp),
        )
        assert {row["title"] for row in kinds.json()["data"]["items"]} == {"API docs", "Brand deck"}

        paged = client.get(
            "/api/work-vault/resources",
            params={"page": 1, "page_size": 1, "sort": "title"},
            headers=auth_header(emp),
        )
        assert paged.json()["data"]["total"] == 3
        assert paged.json()["data"]["total_pages"] == 3
        assert len(paged.json()["data"]["items"]) == 1

        facets = client.get("/api/work-vault/facets", headers=auth_header(other))
        assert facets.status_code == 200
        uploaders = {row["id"]: row["count"] for row in facets.json()["data"]["uploaders"]}
        assert uploaders[emp.id] == 2
        assert uploaders[other.id] == 1

        forbidden = client.patch(
            f"/api/work-vault/resources/{first.json()['data']['id']}",
            json={"title": "Hijacked"},
            headers=auth_header(other),
        )
        assert forbidden.status_code == 403

        updated = client.patch(
            f"/api/work-vault/resources/{first.json()['data']['id']}",
            json={"title": "Public API docs", "tags": ["rest", "http"]},
            headers=auth_header(emp),
        )
        assert updated.status_code == 200
        assert updated.json()["data"]["title"] == "Public API docs"
        assert updated.json()["data"]["tags"] == ["rest", "http"]

        other_delete = client.delete(
            f"/api/work-vault/resources/{first.json()['data']['id']}",
            headers=auth_header(other),
        )
        assert other_delete.status_code == 403

        admin_delete = client.delete(
            f"/api/work-vault/resources/{first.json()['data']['id']}",
            headers=auth_header(admin),
        )
        assert admin_delete.status_code == 200
        remaining = client.get("/api/work-vault/resources", headers=auth_header(emp))
        assert remaining.json()["data"]["total"] == 2

        own_delete = client.delete(
            f"/api/work-vault/resources/{file_item['id']}",
            headers=auth_header(emp),
        )
        assert own_delete.status_code == 200
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_api_integration_method_and_path():
    client, session, engine = setup_client()
    try:
        emp, other, _admin = make_users(session)
        created = client.post(
            "/api/work-vault/resources",
            data={
                "title": "Users endpoint",
                "description": "Fetch a user by id",
                "category": "API Integration",
                "http_method": "GET",
                "url": "/users/{id}",
                "tags": "@Tech / @Other Person",
            },
            headers=auth_header(emp),
        )
        assert created.status_code == 200, created.text
        item = created.json()["data"]
        assert item["category"] == "API Integration"
        assert item["file_kind"] == "api"
        assert item["http_method"] == "GET"
        assert item["url"] == "/users/{id}"
        assert item["tags"] == ["@Tech", "@Other Person"]

        listed = client.get(
            "/api/work-vault/resources",
            params={"category": "API Integration", "file_kind": "api"},
            headers=auth_header(other),
        )
        assert listed.status_code == 200
        assert listed.json()["data"]["total"] == 1

        rejected = client.post(
            "/api/work-vault/resources",
            data={
                "title": "Bad spec",
                "description": "Should not upload a file here",
                "category": "API Integration",
            },
            files={"file": ("openapi.json", b'{"openapi":"3.0.0"}', "application/json")},
            headers=auth_header(emp),
        )
        assert rejected.status_code == 400
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_title_folders_and_date_filter():
    client, session, engine = setup_client()
    try:
        emp, other, _admin = make_users(session)
        first = create_link(client, emp, title="App screens", url="https://www.figma.com/file/one")
        second = create_link(client, emp, title="App screens", url="https://www.figma.com/file/two")
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert first.json()["data"]["folder_id"]
        assert first.json()["data"]["folder_id"] == second.json()["data"]["folder_id"]
        assert first.json()["data"]["folder_name"] == "App screens"

        empty = client.post(
            "/api/work-vault/folders",
            json={"name": "Later uploads"},
            headers=auth_header(emp),
        )
        assert empty.status_code == 200, empty.text
        folders = client.get("/api/work-vault/folders", params={"owner_id": emp.id}, headers=auth_header(other))
        names = {row["name"] for row in folders.json()["data"]["items"]}
        assert names == {"App screens", "Later uploads"}

        old = session.query(WorkVaultResource).filter(WorkVaultResource.id == first.json()["data"]["id"]).one()
        old.created_at = datetime.now(timezone.utc) - timedelta(days=40)
        session.commit()
        today = datetime.now(timezone.utc).date()
        month_start = today.replace(day=1).isoformat()
        listed = client.get(
            "/api/work-vault/resources",
            params={"created_from": month_start, "created_to": today.isoformat(), "uploaded_by_id": emp.id},
            headers=auth_header(other),
        )
        assert listed.status_code == 200
        assert listed.json()["data"]["total"] == 1
        assert listed.json()["data"]["items"][0]["id"] == second.json()["data"]["id"]
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_department_unread_and_people_folders():
    client, session, engine = setup_client()
    try:
        emp, other, admin = make_users(session)
        design = Department(name="Design", description="Creative")
        sales = Department(name="Sales", description="Revenue")
        session.add_all([design, sales])
        session.flush()
        designer = User(
            first_name="Dana",
            last_name="Design",
            email="dana@test.com",
            hashed_password=get_password_hash("x"),
            role="employee",
            status="active",
        )
        teammate = User(
            first_name="Sam",
            last_name="Studio",
            email="sam@test.com",
            hashed_password=get_password_hash("x"),
            role="employee",
            status="active",
        )
        seller = User(
            first_name="Lee",
            last_name="Sales",
            email="lee@test.com",
            hashed_password=get_password_hash("x"),
            role="employee",
            status="active",
        )
        designer.departments = [design]
        teammate.departments = [design]
        seller.departments = [sales]
        session.add_all([designer, teammate, seller])
        session.commit()
        session.refresh(designer)
        session.refresh(teammate)
        session.refresh(seller)

        created = create_link(client, designer, title="Brand kit", category="Designs & Creative Assets")
        assert created.status_code == 200, created.text

        unread_teammate = client.get("/api/work-vault/unread-count", headers=auth_header(teammate))
        assert unread_teammate.status_code == 200
        assert unread_teammate.json()["data"]["count"] == 1

        unread_uploader = client.get("/api/work-vault/unread-count", headers=auth_header(designer))
        assert unread_uploader.json()["data"]["count"] == 0

        unread_other_dept = client.get("/api/work-vault/unread-count", headers=auth_header(emp))
        assert unread_other_dept.json()["data"]["count"] == 0

        unread_sales = client.get("/api/work-vault/unread-count", headers=auth_header(seller))
        assert unread_sales.json()["data"]["count"] == 0

        before_seen = client.get("/api/work-vault/people", headers=auth_header(teammate))
        dana_before = next(row for row in before_seen.json()["data"]["items"] if row["id"] == designer.id)
        assert dana_before["has_new"] is True

        seen = client.post("/api/work-vault/seen", headers=auth_header(teammate))
        assert seen.status_code == 200
        assert seen.json()["data"]["count"] == 0
        after = client.get("/api/work-vault/unread-count", headers=auth_header(teammate))
        assert after.json()["data"]["count"] == 0

        folders = client.get("/api/work-vault/people", headers=auth_header(teammate))
        assert folders.status_code == 200
        items = folders.json()["data"]["items"]
        names = {f"{row['first_name']} {row['last_name']}" for row in items}
        assert "Dana Design" in names
        assert "Sam Studio" in names
        assert "Emp Loyee" in names
        dana = next(row for row in items if row["id"] == designer.id)
        assert dana["count"] == 1
        assert dana["has_new"] is False
        sam = next(row for row in items if row["id"] == teammate.id)
        assert sam["count"] == 0
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
