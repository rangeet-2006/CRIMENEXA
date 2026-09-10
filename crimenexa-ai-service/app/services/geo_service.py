from math import radians, sin, cos, sqrt, atan2
from datetime import datetime

EARTH_RADIUS_KM = 6371.0
MAX_PLAUSIBLE_SPEED_KMH = 150.0


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = radians(lat1), radians(lat2)
    delta_phi = radians(lat2 - lat1)
    delta_lambda = radians(lon2 - lon1)

    a = sin(delta_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(delta_lambda / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return EARTH_RADIUS_KM * c


def check_movement_plausibility(lat1: float, lon1: float, time1: str,
                                 lat2: float, lon2: float, time2: str):
    distance_km = haversine_distance(lat1, lon1, lat2, lon2)

    t1 = datetime.fromisoformat(time1)
    t2 = datetime.fromisoformat(time2)
    time_elapsed_minutes = abs((t2 - t1).total_seconds()) / 60.0

    if time_elapsed_minutes == 0:
        required_speed_kmh = float("inf") if distance_km > 0 else 0.0
    else:
        required_speed_kmh = distance_km / (time_elapsed_minutes / 60.0)

    is_plausible = required_speed_kmh <= MAX_PLAUSIBLE_SPEED_KMH

    if is_plausible:
        explanation = f"Movement of {round(distance_km, 2)} km in {round(time_elapsed_minutes, 1)} min is physically plausible."
    else:
        explanation = (
            f"Movement of {round(distance_km, 2)} km in {round(time_elapsed_minutes, 1)} min "
            f"requires {round(required_speed_kmh, 1)} km/h, which exceeds plausible travel speed."
        )

    return {
        "distance_km": round(distance_km, 3),
        "time_elapsed_minutes": round(time_elapsed_minutes, 2),
        "required_speed_kmh": round(required_speed_kmh, 2) if required_speed_kmh != float("inf") else -1,
        "is_plausible": is_plausible,
        "explanation": explanation
    }


def compute_location_correlation(location_points: list, incident_lat: float, incident_lon: float,
                                  proximity_threshold_km: float = 2.0):
    correlated_points = []
    for point in location_points:
        distance = haversine_distance(point["latitude"], point["longitude"], incident_lat, incident_lon)
        if distance <= proximity_threshold_km:
            correlated_points.append({**point, "distance_from_incident_km": round(distance, 3)})

    return correlated_points