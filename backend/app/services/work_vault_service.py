import math
import os
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.constants import (
    WORK_VAULT_ALLOWED_EXTENSIONS,
    WORK_VAULT_API_CATEGORY,
    WORK_VAULT_CATEGORIES,
    WORK_VAULT_FILE_KINDS,
    WORK_VAULT_HTTP_METHODS,
    UserRole,
)
from app.core.datetime_utils import utcnow
from app.models import Project, User, WorkVaultResource, user_departments
from app.repositories.base import user_to_brief_dict

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp"}
PDF_EXT = {".pdf"}
DOC_EXT = {".doc", ".docx", ".txt", ".md", ".rtf"}
SHEET_EXT = {".xls", ".xlsx", ".csv"}
PRES_EXT = {".ppt", ".pptx"}
CODE_EXT = {".json", ".xml", ".yml", ".yaml", ".html", ".css", ".js", ".ts", ".tsx", ".jsx", ".py", ".sql"}


def parse_tags(raw: list[str] | str | None) -> str | None:
    values: list[str] = []
    if isinstance(raw, list):
        values = raw
    elif isinstance(raw, str):
        values = raw.replace(";", ",").replace("/", ",").split(",")
    cleaned = []
    seen: set[str] = set()
    for tag in values:
        name = " ".join(str(tag).split())[:50]
        key = name.lower()
        if name and key not in seen:
            seen.add(key)
            cleaned.append(name)
        if len(cleaned) >= 20:
            break
    return ", ".join(cleaned) if cleaned else None


def tags_to_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def infer_file_kind(resource_type: str, filename: str | None, mime_type: str | None) -> str:
    if resource_type == "link":
        return "link"
    ext = os.path.splitext(filename or "")[1].lower()
    mime = (mime_type or "").lower()
    if mime.startswith("image/") or ext in IMAGE_EXT:
        return "image"
    if "pdf" in mime or ext in PDF_EXT:
        return "pdf"
    if ext in SHEET_EXT or "spreadsheet" in mime or "excel" in mime:
        return "spreadsheet"
    if ext in PRES_EXT or "presentation" in mime or "powerpoint" in mime:
        return "presentation"
    if ext in CODE_EXT or mime.startswith("text/") or mime in {"application/json", "application/xml"}:
        if ext in DOC_EXT:
            return "document"
        return "code"
    if ext in DOC_EXT or "word" in mime or mime == "application/msword":
        return "document"
    return "other"


def validate_category(category: str) -> str:
    value = (category or "").strip()
    if value == "API Documentation":
        value = WORK_VAULT_API_CATEGORY
    if value not in WORK_VAULT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Choose a valid category")
    return value


def validate_http_method(method: str | None) -> str:
    value = (method or "").strip().upper()
    if value not in WORK_VAULT_HTTP_METHODS:
        raise HTTPException(status_code=400, detail="Choose a valid HTTP method")
    return value


def validate_api_path(url: str) -> str:
    value = (url or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Enter the API path")
    return value[:2000]


def validate_external_url(url: str) -> str:
    value = (url or "").strip()
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Enter a valid http(s) URL")
    return value


def validate_upload_filename(filename: str | None) -> str:
    name = (filename or "file").strip() or "file"
    ext = os.path.splitext(name)[1].lower()
    if ext not in WORK_VAULT_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="That file type is not supported. Upload a document, image, or common text/code file.",
        )
    return name


def can_manage(user: User, resource: WorkVaultResource) -> bool:
    return user.id == resource.uploaded_by_id or user.role == UserRole.ADMIN.value


class WorkVaultService:
    def __init__(self, db: Session):
        self.db = db

    def _base_query(self):
        return (
            self.db.query(WorkVaultResource)
            .options(
                joinedload(WorkVaultResource.uploader),
                joinedload(WorkVaultResource.project),
            )
            .join(User, WorkVaultResource.uploaded_by_id == User.id)
        )

    def _apply_filters(
        self,
        query,
        *,
        q: str | None = None,
        category: str | None = None,
        file_kind: str | None = None,
        uploaded_by_id: int | None = None,
        project_id: int | None = None,
    ):
        term = (q or "").strip()
        if term:
            like = f"%{term}%"
            query = query.filter(
                or_(
                    WorkVaultResource.title.ilike(like),
                    WorkVaultResource.filename.ilike(like),
                    WorkVaultResource.description.ilike(like),
                    WorkVaultResource.tags.ilike(like),
                    WorkVaultResource.category.ilike(like),
                    WorkVaultResource.url.ilike(like),
                    User.first_name.ilike(like),
                    User.last_name.ilike(like),
                    User.first_name.concat(" ").concat(User.last_name).ilike(like),
                )
            )
        if category:
            query = query.filter(WorkVaultResource.category == category)
        if file_kind:
            if file_kind not in WORK_VAULT_FILE_KINDS:
                raise HTTPException(status_code=400, detail="Invalid file type filter")
            query = query.filter(WorkVaultResource.file_kind == file_kind)
        if uploaded_by_id:
            query = query.filter(WorkVaultResource.uploaded_by_id == uploaded_by_id)
        if project_id:
            query = query.filter(WorkVaultResource.project_id == project_id)
        return query

    def _apply_sort(self, query, sort: str | None):
        key = (sort or "recent").strip()
        if key == "title":
            return query.order_by(func.lower(WorkVaultResource.title).asc(), WorkVaultResource.id.asc())
        if key == "oldest":
            return query.order_by(WorkVaultResource.created_at.asc(), WorkVaultResource.id.asc())
        return query.order_by(WorkVaultResource.created_at.desc(), WorkVaultResource.id.desc())

    def to_dict(self, resource: WorkVaultResource, viewer: User) -> dict:
        manage = can_manage(viewer, resource)
        return {
            "id": resource.id,
            "title": resource.title,
            "description": resource.description,
            "category": resource.category,
            "tags": tags_to_list(resource.tags),
            "project_id": resource.project_id,
            "project_name": resource.project.name if resource.project else None,
            "resource_type": resource.resource_type,
            "file_kind": resource.file_kind,
            "filename": resource.filename,
            "file_size": resource.file_size,
            "mime_type": resource.mime_type,
            "url": resource.url if resource.resource_type == "link" else None,
            "http_method": resource.http_method,
            "uploaded_by": user_to_brief_dict(resource.uploader),
            "created_at": resource.created_at,
            "updated_at": resource.updated_at,
            "can_edit": manage,
            "can_delete": manage,
        }

    def list_resources(
        self,
        viewer: User,
        *,
        q: str | None = None,
        category: str | None = None,
        file_kind: str | None = None,
        uploaded_by_id: int | None = None,
        project_id: int | None = None,
        sort: str | None = "recent",
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        query = self._apply_filters(
            self._base_query(),
            q=q,
            category=category,
            file_kind=file_kind,
            uploaded_by_id=uploaded_by_id,
            project_id=project_id,
        )
        total = query.order_by(None).count()
        query = self._apply_sort(query, sort)
        items = query.offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": [self.to_dict(row, viewer) for row in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": math.ceil(total / page_size) if total else 0,
        }

    def facets(
        self,
        *,
        q: str | None = None,
        category: str | None = None,
        file_kind: str | None = None,
        uploaded_by_id: int | None = None,
        project_id: int | None = None,
    ) -> dict:
        filtered = self._apply_filters(
            self.db.query(WorkVaultResource).join(User, WorkVaultResource.uploaded_by_id == User.id),
            q=q,
            category=category,
            file_kind=file_kind,
            uploaded_by_id=uploaded_by_id,
            project_id=project_id,
        )
        category_rows = (
            filtered.with_entities(WorkVaultResource.category, func.count(WorkVaultResource.id))
            .group_by(WorkVaultResource.category)
            .all()
        )
        kind_rows = (
            filtered.with_entities(WorkVaultResource.file_kind, func.count(WorkVaultResource.id))
            .group_by(WorkVaultResource.file_kind)
            .all()
        )
        uploader_rows = (
            filtered.with_entities(
                User.id,
                User.first_name,
                User.last_name,
                User.profile_picture,
                func.count(WorkVaultResource.id),
            )
            .group_by(User.id, User.first_name, User.last_name, User.profile_picture)
            .order_by(func.lower(User.first_name), func.lower(User.last_name))
            .all()
        )
        category_counts = {name: count for name, count in category_rows}
        kind_counts = {name: count for name, count in kind_rows}
        return {
            "categories": [
                {"value": name, "label": name, "count": category_counts.get(name, 0)}
                for name in WORK_VAULT_CATEGORIES
            ],
            "file_kinds": [
                {"value": name, "label": name, "count": kind_counts.get(name, 0)}
                for name in WORK_VAULT_FILE_KINDS
            ],
            "uploaders": [
                {
                    "id": user_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "profile_picture": profile_picture,
                    "count": count,
                }
                for user_id, first_name, last_name, profile_picture, count in uploader_rows
            ],
        }

    def _department_ids(self, user_id: int) -> list[int]:
        rows = (
            self.db.query(user_departments.c.department_id)
            .filter(user_departments.c.user_id == user_id)
            .all()
        )
        return [row[0] for row in rows]

    def _teammate_ids(self, user_id: int) -> list[int]:
        dept_ids = self._department_ids(user_id)
        if not dept_ids:
            return []
        rows = (
            self.db.query(user_departments.c.user_id)
            .filter(
                user_departments.c.department_id.in_(dept_ids),
                user_departments.c.user_id != user_id,
            )
            .distinct()
            .all()
        )
        return [row[0] for row in rows]

    def unread_count(self, user: User) -> dict:
        teammate_ids = self._teammate_ids(user.id)
        if not teammate_ids:
            return {"count": 0}
        query = self.db.query(WorkVaultResource).filter(
            WorkVaultResource.uploaded_by_id.in_(teammate_ids),
        )
        if user.last_seen_work_vault_at is not None:
            query = query.filter(WorkVaultResource.created_at > user.last_seen_work_vault_at)
        return {"count": query.count()}

    def mark_seen(self, user: User) -> dict:
        user.last_seen_work_vault_at = utcnow()
        self.db.commit()
        return {"count": 0}

    def list_people(
        self,
        viewer: User,
        *,
        q: str | None = None,
        category: str | None = None,
        file_kind: str | None = None,
        uploaded_by_id: int | None = None,
        project_id: int | None = None,
    ) -> dict:
        filtered = self._apply_filters(
            self.db.query(WorkVaultResource).join(User, WorkVaultResource.uploaded_by_id == User.id),
            q=q,
            category=category,
            file_kind=file_kind,
            uploaded_by_id=uploaded_by_id,
            project_id=project_id,
        )
        count_rows = (
            filtered.with_entities(WorkVaultResource.uploaded_by_id, func.count(WorkVaultResource.id))
            .group_by(WorkVaultResource.uploaded_by_id)
            .all()
        )
        counts = {user_id: count for user_id, count in count_rows}

        unread_ids: set[int] = set()
        teammate_ids = self._teammate_ids(viewer.id)
        if teammate_ids:
            unread_query = self.db.query(WorkVaultResource.uploaded_by_id).filter(
                WorkVaultResource.uploaded_by_id.in_(teammate_ids),
            )
            if viewer.last_seen_work_vault_at is not None:
                unread_query = unread_query.filter(WorkVaultResource.created_at > viewer.last_seen_work_vault_at)
            unread_ids = {row[0] for row in unread_query.distinct().all()}

        people_query = self.db.query(User).filter(User.status != "inactive")
        term = (q or "").strip()
        if term:
            like = f"%{term}%"
            matching_uploaders = list(counts.keys())
            name_match = or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                User.first_name.concat(" ").concat(User.last_name).ilike(like),
            )
            if matching_uploaders:
                people_query = people_query.filter(or_(name_match, User.id.in_(matching_uploaders)))
            else:
                people_query = people_query.filter(name_match)
        people = people_query.order_by(func.lower(User.first_name), func.lower(User.last_name)).all()
        return {
            "items": [
                {
                    "id": person.id,
                    "first_name": person.first_name,
                    "last_name": person.last_name,
                    "profile_picture": person.profile_picture,
                    "job_title": person.job_title,
                    "count": counts.get(person.id, 0),
                    "has_new": person.id in unread_ids,
                }
                for person in people
            ]
        }

    def get(self, resource_id: int) -> WorkVaultResource:
        resource = (
            self.db.query(WorkVaultResource)
            .options(
                joinedload(WorkVaultResource.uploader),
                joinedload(WorkVaultResource.project),
            )
            .filter(WorkVaultResource.id == resource_id)
            .first()
        )
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found")
        return resource

    def _require_project(self, project_id: int | None) -> int | None:
        if project_id is None:
            return None
        project = self.db.query(Project).filter(Project.id == project_id, Project.is_archived == False).first()  # noqa: E712
        if not project:
            raise HTTPException(status_code=400, detail="Project not found")
        return project_id

    def create(
        self,
        user: User,
        *,
        title: str,
        description: str,
        category: str,
        tags: list[str] | str | None = None,
        project_id: int | None = None,
        url: str | None = None,
        http_method: str | None = None,
        filename: str | None = None,
        file_path: str | None = None,
        file_size: int | None = None,
        mime_type: str | None = None,
        stored_url: str | None = None,
    ) -> WorkVaultResource:
        title_value = " ".join((title or "").split())
        description_value = (description or "").strip()
        if not title_value:
            raise HTTPException(status_code=400, detail="Title is required")
        if not description_value:
            raise HTTPException(status_code=400, detail="Description is required")
        category_value = validate_category(category)
        has_file = bool(file_path)
        has_url = bool((url or "").strip())

        if category_value == WORK_VAULT_API_CATEGORY:
            if has_file or not has_url:
                raise HTTPException(status_code=400, detail="Add an API method and path")
            method = validate_http_method(http_method)
            resource = WorkVaultResource(
                title=title_value[:300],
                description=description_value,
                category=category_value,
                tags=parse_tags(tags),
                project_id=None,
                resource_type="link",
                file_kind="api",
                http_method=method,
                url=validate_api_path(url or ""),
                uploaded_by_id=user.id,
            )
            self.db.add(resource)
            self.db.commit()
            self.db.refresh(resource)
            return self.get(resource.id)

        if has_file == has_url:
            raise HTTPException(status_code=400, detail="Upload a file or add a valid URL")

        if has_url:
            resource_type = "link"
            external_url = validate_external_url(url or "")
            resource = WorkVaultResource(
                title=title_value[:300],
                description=description_value,
                category=category_value,
                tags=parse_tags(tags),
                project_id=self._require_project(project_id),
                resource_type=resource_type,
                file_kind="link",
                url=external_url,
                uploaded_by_id=user.id,
            )
        else:
            safe_name = validate_upload_filename(filename)
            resource = WorkVaultResource(
                title=title_value[:300],
                description=description_value,
                category=category_value,
                tags=parse_tags(tags),
                project_id=self._require_project(project_id),
                resource_type="file",
                file_kind=infer_file_kind("file", safe_name, mime_type),
                filename=safe_name,
                file_path=file_path,
                file_size=file_size,
                mime_type=mime_type,
                url=stored_url,
                uploaded_by_id=user.id,
            )
        self.db.add(resource)
        self.db.commit()
        self.db.refresh(resource)
        return self.get(resource.id)

    def update(self, user: User, resource_id: int, data: dict) -> WorkVaultResource:
        resource = self.get(resource_id)
        if not can_manage(user, resource):
            raise HTTPException(status_code=403, detail="You can only edit your own resources")
        if "title" in data and data["title"] is not None:
            title_value = " ".join(str(data["title"]).split())
            if not title_value:
                raise HTTPException(status_code=400, detail="Title is required")
            resource.title = title_value[:300]
        if "description" in data and data["description"] is not None:
            description_value = str(data["description"]).strip()
            if not description_value:
                raise HTTPException(status_code=400, detail="Description is required")
            resource.description = description_value
        if "category" in data and data["category"] is not None:
            resource.category = validate_category(str(data["category"]))
        if "tags" in data:
            resource.tags = parse_tags(data["tags"])
        if data.get("clear_project"):
            resource.project_id = None
        elif "project_id" in data:
            resource.project_id = self._require_project(data["project_id"])
        if "http_method" in data and data["http_method"] is not None:
            if resource.file_kind != "api" and resource.category != WORK_VAULT_API_CATEGORY:
                raise HTTPException(status_code=400, detail="Only API Integration resources can set a method")
            resource.http_method = validate_http_method(str(data["http_method"]))
            resource.file_kind = "api"
            resource.resource_type = "link"
        if "url" in data and data["url"] is not None:
            if resource.resource_type != "link":
                raise HTTPException(status_code=400, detail="Only link resources can update a URL")
            if resource.file_kind == "api" or resource.category == WORK_VAULT_API_CATEGORY:
                resource.url = validate_api_path(str(data["url"]))
            else:
                resource.url = validate_external_url(str(data["url"]))
        self.db.commit()
        return self.get(resource.id)

    def replace_file(
        self,
        user: User,
        resource_id: int,
        *,
        filename: str,
        file_path: str,
        file_size: int,
        mime_type: str | None,
        stored_url: str | None,
    ) -> tuple[WorkVaultResource, str | None, str | None]:
        resource = self.get(resource_id)
        if not can_manage(user, resource):
            raise HTTPException(status_code=403, detail="You can only replace your own files")
        old_path = resource.file_path
        old_url = resource.url if resource.resource_type == "file" else None
        safe_name = validate_upload_filename(filename)
        resource.resource_type = "file"
        resource.filename = safe_name
        resource.file_path = file_path
        resource.file_size = file_size
        resource.mime_type = mime_type
        resource.url = stored_url
        resource.file_kind = infer_file_kind("file", safe_name, mime_type)
        self.db.commit()
        return self.get(resource.id), old_path, old_url

    def delete(self, user: User, resource_id: int) -> tuple[str | None, str | None]:
        resource = self.get(resource_id)
        if not can_manage(user, resource):
            raise HTTPException(status_code=403, detail="You can only delete your own resources")
        file_path = resource.file_path
        stored_url = resource.url if resource.resource_type == "file" else None
        self.db.delete(resource)
        self.db.commit()
        return file_path, stored_url
