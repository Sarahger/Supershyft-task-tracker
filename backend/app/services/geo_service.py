"""Geographic distance and office geofence validation."""

from __future__ import annotations

import math
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Office

EARTH_RADIUS_M = 6_371_000.0


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in meters between two WGS84 coordinates."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_M * c


def get_active_offices(db: Session) -> list[Office]:
    return (
        db.query(Office)
        .filter(Office.is_active.is_(True))
        .order_by(Office.name.asc())
        .all()
    )


def find_nearest_office(
    offices: list[Office],
    latitude: float,
    longitude: float,
) -> tuple[Office | None, float | None]:
    """Return the nearest office and distance in meters, or (None, None) if no offices."""
    if not offices:
        return None, None
    nearest: Office | None = None
    nearest_distance: float | None = None
    for office in offices:
        distance = haversine_distance_m(latitude, longitude, office.latitude, office.longitude)
        if nearest_distance is None or distance < nearest_distance:
            nearest = office
            nearest_distance = distance
    return nearest, nearest_distance


def validate_gps_accuracy(accuracy_meters: float | None, max_accuracy_meters: float) -> bool:
    if accuracy_meters is None:
        return False
    if accuracy_meters < 0:
        return False
    return accuracy_meters <= max_accuracy_meters


def validate_geofence(distance_meters: float | None, radius_meters: float) -> bool:
    if distance_meters is None:
        return False
    return distance_meters <= radius_meters


@dataclass(frozen=True)
class GeofenceValidationResult:
    office: Office | None
    distance_meters: float | None
    location_verified: bool
    verification_method: str
    failure_reason: str | None = None


def validate_wfo_location(
    db: Session,
    latitude: float,
    longitude: float,
    gps_accuracy: float | None,
) -> GeofenceValidationResult:
    """
    Determine nearest active office and whether the user is within its geofence
    with acceptable GPS accuracy. All verification is computed server-side.
    """
    offices = get_active_offices(db)
    if not offices:
        return GeofenceValidationResult(
            office=None,
            distance_meters=None,
            location_verified=False,
            verification_method="gps",
            failure_reason="no_active_offices",
        )

    office, distance = find_nearest_office(offices, latitude, longitude)
    if office is None or distance is None:
        return GeofenceValidationResult(
            office=None,
            distance_meters=None,
            location_verified=False,
            verification_method="gps",
            failure_reason="no_office_match",
        )

    max_accuracy = office.max_gps_accuracy_meters or settings.DEFAULT_MAX_GPS_ACCURACY_METERS
    if not validate_gps_accuracy(gps_accuracy, max_accuracy):
        return GeofenceValidationResult(
            office=office,
            distance_meters=round(distance, 1),
            location_verified=False,
            verification_method="gps_poor_accuracy",
            failure_reason="poor_gps_accuracy",
        )

    if not validate_geofence(distance, office.radius_meters):
        return GeofenceValidationResult(
            office=office,
            distance_meters=round(distance, 1),
            location_verified=False,
            verification_method="gps_outside_radius",
            failure_reason="outside_radius",
        )

    return GeofenceValidationResult(
        office=office,
        distance_meters=round(distance, 1),
        location_verified=True,
        verification_method="gps",
        failure_reason=None,
    )
