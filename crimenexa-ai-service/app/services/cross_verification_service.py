from datetime import datetime
from app.services.geo_service import haversine_distance
from app.services.alert_notifier_service import notify_alert

PROXIMITY_THRESHOLD_KM = 2.0
TIME_WINDOW_MINUTES = 30


def cross_verify_location_claims(claims: list, case_id: str = None):
    """
    claims: list of dicts, each like:
    {"source_type": "WITNESS", "source_id": "W-01", "entity_name": "Person A",
     "latitude": 28.61, "longitude": 77.20, "timestamp": "2026-04-12T21:30:00", "excerpt": "..."}
    """
    results = []
    entity_groups = {}

    for claim in claims:
        entity_groups.setdefault(claim["entity_name"], []).append(claim)

    for entity_name, entity_claims in entity_groups.items():
        if len(entity_claims) < 2:
            results.append({
                "claim": f"Location of {entity_name}",
                "status": "UNVERIFIED",
                "supporting_sources": [],
                "conflicting_sources": [],
                "explanation": "Only one source reports this entity's location; no cross-verification possible."
            })
            continue

        base = entity_claims[0]
        supporting = []
        conflicting = []

        for other in entity_claims[1:]:
            distance = haversine_distance(base["latitude"], base["longitude"], other["latitude"], other["longitude"])
            t1 = datetime.fromisoformat(base["timestamp"])
            t2 = datetime.fromisoformat(other["timestamp"])
            time_diff_minutes = abs((t2 - t1).total_seconds()) / 60.0

            source_ref = {
                "source_type": other["source_type"],
                "source_id": other["source_id"],
                "excerpt": other.get("excerpt", "")
            }

            if distance <= PROXIMITY_THRESHOLD_KM and time_diff_minutes <= TIME_WINDOW_MINUTES:
                supporting.append(source_ref)
            else:
                conflicting.append(source_ref)

        if conflicting and not supporting:
            status = "CONFLICT"
            explanation = f"Sources disagree on {entity_name}'s location within the expected time/distance window."
        elif supporting and not conflicting:
            status = "CORROBORATED"
            explanation = f"{len(supporting) + 1} independent sources corroborate {entity_name}'s location."
        elif supporting and conflicting:
            status = "PARTIAL"
            explanation = f"Some sources corroborate {entity_name}'s location while others conflict."
        else:
            status = "UNVERIFIED"
            explanation = "Insufficient data to verify."

        results.append({
            "claim": f"Location of {entity_name}",
            "status": status,
            "supporting_sources": supporting,
            "conflicting_sources": conflicting,
            "explanation": explanation
        })

        if status == "CONFLICT" and case_id:
            notify_alert(
                case_id=case_id,
                severity="HIGH",
                category="LOCATION",
                title=f"Conflicting location claims for {entity_name}",
                description=explanation
            )

    return results