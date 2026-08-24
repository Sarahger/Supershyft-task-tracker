from app.services.geo_service import (
    find_nearest_office,
    haversine_distance_m,
    validate_geofence,
    validate_gps_accuracy,
)


class _FakeOffice:
    def __init__(self, id: int, name: str, lat: float, lng: float, radius: float, max_acc: float):
        self.id = id
        self.name = name
        self.latitude = lat
        self.longitude = lng
        self.radius_meters = radius
        self.max_gps_accuracy_meters = max_acc
        self.is_active = True


def test_haversine_same_point():
    assert haversine_distance_m(19.076, 72.8777, 19.076, 72.8777) == 0.0


def test_haversine_known_distance():
    # ~1.1 km apart in Mumbai area (approximate)
    d = haversine_distance_m(19.0760, 72.8777, 19.0860, 72.8777)
    assert 1000 < d < 1200


def test_find_nearest_office():
    offices = [
        _FakeOffice(1, "Near", 19.076, 72.8777, 150, 100),
        _FakeOffice(2, "Far", 20.0, 73.0, 150, 100),
    ]
    nearest, distance = find_nearest_office(offices, 19.0761, 72.8778)
    assert nearest.name == "Near"
    assert distance is not None
    assert distance < 50


def test_validate_gps_accuracy():
    assert validate_gps_accuracy(50, 100) is True
    assert validate_gps_accuracy(150, 100) is False
    assert validate_gps_accuracy(None, 100) is False


def test_validate_geofence():
    assert validate_geofence(100, 150) is True
    assert validate_geofence(200, 150) is False
