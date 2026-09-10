from app.services.geo_service import haversine_distance


def calculate_evidence_strength(entity_id: str, entity_extraction_count: int, domain_entity_count: int,
                                 forensic_findings_count: int = 0):
    raw_score = (entity_extraction_count * 3) + (domain_entity_count * 5) + (forensic_findings_count * 15)
    return min(raw_score, 100)


def calculate_communication_relevance(entity_name: str, cdr_analysis: dict):
    if not cdr_analysis or not cdr_analysis.get("call_frequency"):
        return 0.0

    entity_calls = [
        count for pair, count in cdr_analysis["call_frequency"].items()
        if entity_name in pair
    ]

    if not entity_calls:
        return 0.0

    total_calls = sum(entity_calls)
    unusual_flags = cdr_analysis.get("unusual_frequency_flags", [])
    is_flagged = any(entity_name in flag["pair"] for flag in unusual_flags)

    base_score = min(total_calls * 4, 80)
    if is_flagged:
        base_score += 20

    return min(base_score, 100)


def calculate_location_correlation(entity_name: str, location_points: list, incident_lat: float,
                                    incident_lon: float, proximity_threshold_km: float = 2.0):
    if not location_points:
        return 0.0

    entity_points = [p for p in location_points if p.get("entity_name") == entity_name]
    if not entity_points:
        return 0.0

    close_points = 0
    for point in entity_points:
        distance = haversine_distance(point["latitude"], point["longitude"], incident_lat, incident_lon)
        if distance <= proximity_threshold_km:
            close_points += 1

    proximity_ratio = close_points / len(entity_points)
    return round(proximity_ratio * 100, 2)


def calculate_witness_corroboration(entity_name: str, cross_verification_results: list):
    if not cross_verification_results:
        return 0.0

    relevant_results = [
        r for r in cross_verification_results
        if entity_name in r.get("claim", "")
    ]

    if not relevant_results:
        return 0.0

    corroborated = sum(1 for r in relevant_results if r["status"] == "CORROBORATED")
    conflicted = sum(1 for r in relevant_results if r["status"] == "CONFLICT")

    score = (corroborated * 40) - (conflicted * 20)
    return max(0.0, min(score, 100))


def calculate_forensic_relevance(forensic_findings: list, entity_name: str = None):
    if not forensic_findings:
        return 0.0

    relevant_findings = forensic_findings
    if entity_name:
        relevant_findings = [f for f in forensic_findings if entity_name.lower() in str(f).lower()]

    match_findings = [f for f in relevant_findings if f.get("type") == "match_confidence"]
    base_score = len(relevant_findings) * 15

    for finding in match_findings:
        if "full" in str(finding.get("value", "")).lower():
            base_score += 40
        elif "partial" in str(finding.get("value", "")).lower():
            base_score += 20

    return min(base_score, 100)


def calculate_timeline_consistency(entity_name: str, timeline_events: list, gaps_detected: list):
    if not timeline_events:
        return 0.0

    entity_events = [e for e in timeline_events if entity_name in e.get("entities_involved", [])]
    if not entity_events:
        return 0.0

    event_density_score = min(len(entity_events) * 8, 70)
    gap_penalty = min(len(gaps_detected) * 5, 30)

    score = event_density_score - gap_penalty
    return max(0.0, min(score, 100))


def calculate_network_relevance(entity_name: str, graph_connections: list):
    if not graph_connections:
        return 0.0

    connection_count = sum(
        1 for edge in graph_connections
        if edge.get("source") == entity_name or edge.get("target") == entity_name
    )

    return min(connection_count * 12, 100)