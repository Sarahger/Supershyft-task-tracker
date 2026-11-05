"""Official individual performance scorecard. Weights and meanings are fixed."""

from __future__ import annotations

KRA_PARAMETERS: tuple[dict, ...] = (
    {"key": "deadline_adherence", "name": "Deadline Adherence", "weight": 30},
    {"key": "quality_of_work", "name": "Quality of Work", "weight": 25},
    {"key": "discipline_process", "name": "Discipline & Process Adherence", "weight": 15},
    {"key": "ownership_accountability", "name": "Ownership & Accountability", "weight": 15},
    {"key": "teamwork_collaboration", "name": "Teamwork & Collaboration", "weight": 10},
    {"key": "punctuality", "name": "Punctuality", "weight": 5},
)

RATING_SCALE: tuple[dict, ...] = (
    {"rating": 5, "meaning": "Exceptional", "interpretation": "Consistently exceeds agreed expectations"},
    {"rating": 4, "meaning": "Very Good", "interpretation": "Frequently exceeds expectations"},
    {"rating": 3, "meaning": "Meets Expectations", "interpretation": "Reliably delivers what is expected"},
    {"rating": 2, "meaning": "Needs Improvement", "interpretation": "Inconsistently meets expectations"},
    {"rating": 1, "meaning": "Unsatisfactory", "interpretation": "Frequently falls significantly short of expectations"},
)

PARAMETER_BY_KEY = {row["key"]: row for row in KRA_PARAMETERS}


def weighted_score(rating: int, weight: float) -> float:
    return round((rating / 5) * weight, 2)


def overall_score(ratings: dict[str, int]) -> float:
    total = 0.0
    for row in KRA_PARAMETERS:
        total += weighted_score(ratings[row["key"]], row["weight"])
    return round(total, 2)
