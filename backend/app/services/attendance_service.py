import calendar
import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.constants import AttendanceFilterStatus, AttendanceStatus, UserStatus
from app.models import Attendance, User, user_departments
from app.repositories.base import user_to_brief_dict

logger = logging.getLogger(__name__)

_TZ_FALLBACKS: dict[str, timedelta] = {
    "Asia/Kolkata": timedelta(hours=5, minutes=30),
}

VALID_STATUSES = {s.value for s in AttendanceStatus}
VALID_FILTER_STATUSES = {s.value for s in AttendanceFilterStatus}


def _tz() -> ZoneInfo | timezone:
    try:
        return ZoneInfo(settings.MEETING_TIMEZONE)
    except ZoneInfoNotFoundError:
        offset = _TZ_FALLBACKS.get(settings.MEETING_TIMEZONE, timedelta(hours=5, minutes=30))
        return timezone(offset)


def today_local() -> date:
    return datetime.now(timezone.utc).astimezone(_tz()).date()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _user_brief(user: User | None) -> dict | None:
    if not user:
        return None
    brief = user_to_brief_dict(user) or {}
    brief["job_title"] = user.job_title
    brief["role"] = user.role
    brief["departments"] = [d.name for d in (user.departments or [])]
    return brief


def _format_record(record: Attendance, include_user: bool = False) -> dict:
    data = {
        "id": record.id,
        "user_id": record.user_id,
        "attendance_date": record.attendance_date,
        "status": record.status,
        "recorded_at": record.recorded_at,
        "created_at": record.created_at,
        "editable": False,
        "user": None,
    }
    if include_user and record.user:
        data["user"] = _user_brief(record.user)
    return data


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def _working_days_in_month(year: int, month: int, today: date) -> int:
    """Count Mon–Fri up to today (if current month) or full month."""
    start, end = _month_bounds(year, month)
    if year == today.year and month == today.month:
        end = min(end, today)
    count = 0
    d = start
    while d <= end:
        if d.weekday() < 5:
            count += 1
        d += timedelta(days=1)
    return count


def _build_summary(records: list[Attendance], year: int, month: int, today: date) -> dict:
    wfo = sum(1 for r in records if r.status == AttendanceStatus.WFO.value)
    wfh = sum(1 for r in records if r.status == AttendanceStatus.WFH.value)
    leave = sum(1 for r in records if r.status == AttendanceStatus.LEAVE.value)
    half_day = sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY.value)
    camp = sum(1 for r in records if r.status == AttendanceStatus.CAMP.value)
    present = wfo + wfh + half_day + camp
    working = _working_days_in_month(year, month, today)
    percent = round((present / working) * 100, 1) if working > 0 else 0.0
    return {
        "wfo_count": wfo,
        "wfh_count": wfh,
        "leave_count": leave,
        "half_day_count": half_day,
        "camp_count": camp,
        "present_count": present,
        "total_marked": len(records),
        "working_days": working,
        "attendance_percent": percent,
        "late_count": 0,
    }


def _week_bounds(week_start: date | None = None) -> tuple[date, date]:
    today = today_local()
    if week_start is None:
        # Monday of current week
        week_start = today - timedelta(days=today.weekday())
    else:
        week_start = week_start - timedelta(days=week_start.weekday())
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


class AttendanceService:
    def __init__(self, db: Session):
        self.db = db

    def mark_today(self, user: User, status: str) -> dict:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid attendance status")

        today = today_local()
        existing = (
            self.db.query(Attendance)
            .filter(Attendance.user_id == user.id, Attendance.attendance_date == today)
            .first()
        )
        if existing:
            logger.warning("Duplicate attendance mark attempt user_id=%s date=%s", user.id, today)
            raise HTTPException(status_code=409, detail="Already submitted today.")

        record = Attendance(
            user_id=user.id,
            attendance_date=today,
            status=status,
            recorded_at=now_utc(),
        )
        self.db.add(record)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            logger.warning("IntegrityError on attendance mark user_id=%s", user.id)
            raise HTTPException(status_code=409, detail="Already submitted today.")
        self.db.refresh(record)
        record.user = user
        return _format_record(record, include_user=True)

    def get_today(self, user: User) -> dict | None:
        today = today_local()
        record = (
            self.db.query(Attendance)
            .filter(Attendance.user_id == user.id, Attendance.attendance_date == today)
            .first()
        )
        if not record:
            return None
        return _format_record(record)

    def get_me(self, user: User, month: int | None = None, year: int | None = None) -> dict:
        today = today_local()
        year = year or today.year
        month = month or today.month
        if not (1 <= month <= 12) or not (2000 <= year <= 2100):
            raise HTTPException(status_code=400, detail="Invalid month or year")

        start, end = _month_bounds(year, month)
        records = (
            self.db.query(Attendance)
            .filter(
                Attendance.user_id == user.id,
                Attendance.attendance_date >= start,
                Attendance.attendance_date <= end,
            )
            .order_by(Attendance.attendance_date.asc())
            .all()
        )

        today_record = next((r for r in records if r.attendance_date == today), None)
        if today_record is None and year == today.year and month == today.month:
            today_record_obj = (
                self.db.query(Attendance)
                .filter(Attendance.user_id == user.id, Attendance.attendance_date == today)
                .first()
            )
            today_record = today_record_obj

        week_start, week_end = _week_bounds()
        week_records = (
            self.db.query(Attendance)
            .filter(
                Attendance.user_id == user.id,
                Attendance.attendance_date >= week_start,
                Attendance.attendance_date <= week_end,
            )
            .all()
        )
        by_date = {r.attendance_date: r for r in week_records}
        week: list[dict | None] = []
        for i in range(7):
            d = week_start + timedelta(days=i)
            rec = by_date.get(d)
            week.append(_format_record(rec) if rec else None)

        return {
            "year": year,
            "month": month,
            "today": today,
            "today_record": _format_record(today_record) if today_record else None,
            "records": [_format_record(r) for r in records],
            "summary": _build_summary(records, year, month, today),
            "week": week,
        }

    def _active_users_query(self, department_id: int | None = None, user_id: int | None = None):
        q = (
            self.db.query(User)
            .options(joinedload(User.departments))
            .filter(User.status != UserStatus.INACTIVE.value)
        )
        if user_id is not None:
            q = q.filter(User.id == user_id)
        if department_id is not None:
            q = q.join(user_departments).filter(user_departments.c.department_id == department_id)
        return q.order_by(User.first_name.asc(), User.last_name.asc())

    def get_list(
        self,
        month: int | None = None,
        year: int | None = None,
        user_id: int | None = None,
        department_id: int | None = None,
        status: str = "ALL",
    ) -> dict:
        today = today_local()
        year = year or today.year
        month = month or today.month
        if not (1 <= month <= 12) or not (2000 <= year <= 2100):
            raise HTTPException(status_code=400, detail="Invalid month or year")
        if status not in VALID_FILTER_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status filter")

        start, end = _month_bounds(year, month)
        users = self._active_users_query(department_id=department_id, user_id=user_id).all()
        user_ids = [u.id for u in users]
        user_map = {u.id: u for u in users}

        records: list[Attendance] = []
        if user_ids:
            records = (
                self.db.query(Attendance)
                .options(joinedload(Attendance.user).joinedload(User.departments))
                .filter(
                    Attendance.user_id.in_(user_ids),
                    Attendance.attendance_date >= start,
                    Attendance.attendance_date <= end,
                )
                .order_by(Attendance.attendance_date.desc())
                .all()
            )

        today_by_user = {
            r.user_id: r
            for r in records
            if r.attendance_date == today
        }
        # Also load today if not in month range (edge)
        if year != today.year or month != today.month:
            today_rows = (
                self.db.query(Attendance)
                .filter(Attendance.user_id.in_(user_ids), Attendance.attendance_date == today)
                .all()
                if user_ids
                else []
            )
            today_by_user = {r.user_id: r for r in today_rows}

        present_wfo = sum(1 for r in today_by_user.values() if r.status == AttendanceStatus.WFO.value)
        wfh = sum(1 for r in today_by_user.values() if r.status == AttendanceStatus.WFH.value)
        on_leave = sum(1 for r in today_by_user.values() if r.status == AttendanceStatus.LEAVE.value)
        half_day = sum(1 for r in today_by_user.values() if r.status == AttendanceStatus.HALF_DAY.value)
        camp = sum(1 for r in today_by_user.values() if r.status == AttendanceStatus.CAMP.value)
        not_marked = len(user_ids) - len(today_by_user)

        filtered: list[Attendance] = records
        if status == AttendanceFilterStatus.NOT_MARKED.value:
            # Return empty records list but keep stats; callers use week/today for unmarked
            marked_ids = {r.user_id for r in records}
            filtered = []
            # Synthetic: we don't create fake records; HR table uses week view for unmarked
            _ = marked_ids
        elif status != AttendanceFilterStatus.ALL.value:
            filtered = [r for r in records if r.status == status]

        formatted = []
        for r in filtered:
            if r.user is None and r.user_id in user_map:
                r.user = user_map[r.user_id]
            formatted.append(_format_record(r, include_user=True))

        return {
            "records": formatted,
            "today_stats": {
                "present_wfo": present_wfo,
                "wfh": wfh,
                "on_leave": on_leave,
                "half_day": half_day,
                "camp": camp,
                "not_marked": max(0, not_marked),
                "total_active": len(user_ids),
            },
            "year": year,
            "month": month,
        }

    def get_week(self, week_start: date | None = None, department_id: int | None = None) -> dict:
        start, end = _week_bounds(week_start)
        users = self._active_users_query(department_id=department_id).all()
        user_ids = [u.id for u in users]

        records: list[Attendance] = []
        if user_ids:
            records = (
                self.db.query(Attendance)
                .filter(
                    Attendance.user_id.in_(user_ids),
                    Attendance.attendance_date >= start,
                    Attendance.attendance_date <= end,
                )
                .all()
            )
        by_user: dict[int, dict[date, Attendance]] = {}
        for r in records:
            by_user.setdefault(r.user_id, {})[r.attendance_date] = r

        rows = []
        for u in users:
            days = []
            for i in range(7):
                d = start + timedelta(days=i)
                rec = by_user.get(u.id, {}).get(d)
                days.append(
                    {
                        "date": d,
                        "status": rec.status if rec else None,
                        "recorded_at": rec.recorded_at if rec else None,
                    }
                )
            rows.append({"user": _user_brief(u), "days": days})

        return {"week_start": start, "week_end": end, "rows": rows}

    def get_user_detail(
        self,
        target_user_id: int,
        month: int | None = None,
        year: int | None = None,
    ) -> dict:
        today = today_local()
        year = year or today.year
        month = month or today.month
        if not (1 <= month <= 12) or not (2000 <= year <= 2100):
            raise HTTPException(status_code=400, detail="Invalid month or year")

        user = (
            self.db.query(User)
            .options(joinedload(User.departments))
            .filter(User.id == target_user_id)
            .first()
        )
        if not user or user.status == UserStatus.INACTIVE.value:
            raise HTTPException(status_code=404, detail="User not found")

        start, end = _month_bounds(year, month)
        records = (
            self.db.query(Attendance)
            .filter(
                Attendance.user_id == target_user_id,
                Attendance.attendance_date >= start,
                Attendance.attendance_date <= end,
            )
            .order_by(Attendance.attendance_date.asc())
            .all()
        )
        return {
            "user": _user_brief(user),
            "year": year,
            "month": month,
            "records": [_format_record(r) for r in records],
            "summary": _build_summary(records, year, month, today),
        }

    def export_rows(
        self,
        month: int | None = None,
        year: int | None = None,
        user_id: int | None = None,
        department_id: int | None = None,
        status: str = "ALL",
    ) -> list[list[str]]:
        data = self.get_list(
            month=month,
            year=year,
            user_id=user_id,
            department_id=department_id,
            status=status if status != "NOT_MARKED" else "ALL",
        )
        rows = [["Employee", "Department", "Date", "Status", "Time"]]
        for r in data["records"]:
            if status not in ("ALL", "NOT_MARKED") and r["status"] != status:
                continue
            user = r.get("user") or {}
            name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            depts = ", ".join(user.get("departments") or [])
            recorded = r.get("recorded_at")
            time_str = recorded.astimezone(_tz()).strftime("%H:%M") if recorded else ""
            rows.append(
                [
                    name,
                    depts,
                    str(r["attendance_date"]),
                    r["status"],
                    time_str,
                ]
            )
        return rows
