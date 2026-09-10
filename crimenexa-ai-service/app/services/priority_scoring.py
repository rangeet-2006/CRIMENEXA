from app.services.priority_factor_calculator import (
    calculate_evidence_strength,
    calculate_communication_relevance,
    calculate_location_correlation,
    calculate_witness_corroboration,
    calculate_forensic_relevance,
    calculate_timeline_consistency,
    calculate_network_relevance,
)

WEIGHTS = {
    "evidence_strength": 0.20,
    "communication_relevance": 0.15,
    "location_correlation": 0.15,
    "witness_corroboration": 0.15,
    "forensic_relevance": 0.15,
    "timeline_consistency": 0.10,
    "network_relevance": 0.10,
}


def compute_priority_score_from_evidence(
    case_id: str,
    entity_id: str,
    entity_name: str,
    entity_extraction_count: int = 0,
    domain_entity_count: int = 0,
    forensic_findings: list = None,
    cdr_analysis: dict = None,
    location_points: list = None,
    incident_lat: float = None,
    incident_lon: float = None,
    cross_verification_results: list = None,
    timeline_events: list = None,
    gaps_detected: list = None,
    graph_connections: list = None,
    transaction_records: list = None,
):
    forensic_findings = forensic_findings or []
    cross_verification_results = cross_verification_results or []
    timeline_events = timeline_events or []
    gaps_detected = gaps_detected or []
    graph_connections = graph_connections or []
    location_points = location_points or []
    transaction_records = transaction_records or []

    relevant_transactions = [
        t for t in transaction_records
        if entity_name in t.get("sender", "") or entity_name in t.get("receiver", "")
    ]

    computed_factors = {
        "evidence_strength": calculate_evidence_strength(
            entity_id,
            entity_extraction_count,
            domain_entity_count,
            len(forensic_findings) + len(relevant_transactions)
        ),
        "communication_relevance": calculate_communication_relevance(entity_name, cdr_analysis or {}),
        "location_correlation": (
            calculate_location_correlation(entity_name, location_points, incident_lat, incident_lon)
            if incident_lat is not None and incident_lon is not None else 0.0
        ),
        "witness_corroboration": calculate_witness_corroboration(entity_name, cross_verification_results),
        "forensic_relevance": calculate_forensic_relevance(forensic_findings, entity_name),
        "timeline_consistency": calculate_timeline_consistency(entity_name, timeline_events, gaps_detected),
        "network_relevance": calculate_network_relevance(entity_name, graph_connections),
    }

    return _score_from_factors(case_id, entity_id, computed_factors)


def compute_priority_score(case_id: str, entity_id: str, factor_inputs: dict):
    """
    Manual-override path: accepts pre-computed 0-100 factor values directly.
    """
    return _score_from_factors(case_id, entity_id, factor_inputs)


def discover_person_names(evidence: dict) -> list:
    """
    Scans all accumulated evidence for a case and returns a list of unique
    person names found — from NER-extracted entities, CDR caller/receiver
    fields, transaction sender/receiver fields, and witness statement entities.
    """
    names = set()

    for entity in evidence.get("entities", []):
        if entity.get("label") == "PERSON":
            names.add(entity["text"].strip())

    for record in evidence.get("cdr_records", []):
        if record.get("caller"):
            names.add(record["caller"].strip())
        if record.get("receiver"):
            names.add(record["receiver"].strip())

    for record in evidence.get("transaction_records", []):
        if record.get("sender"):
            names.add(record["sender"].strip())
        if record.get("receiver"):
            names.add(record["receiver"].strip())

    for statement in evidence.get("witness_statements", []):
        for entity in statement.get("entities", []):
            if entity.get("label") == "PERSON":
                names.add(entity["text"].strip())

    for point in evidence.get("location_points", []):
        if point.get("entity_name"):
            names.add(point["entity_name"].strip())

    names.discard("")
    return sorted(names)


def rank_suspects_for_case(case_id: str, evidence: dict, cdr_analysis: dict,
                            graph_connections: list, incident_lat: float = None,
                            incident_lon: float = None) -> list:
    """
    Discovers every person mentioned across a case's accumulated evidence
    and computes a priority score for each, returning a ranked list
    (highest priority first).
    """
    person_names = discover_person_names(evidence)
    domain_count = sum(len(v) for v in evidence.get("domain_entities", {}).values())

    ranked = []
    for idx, name in enumerate(person_names):
        entity_id = f"AUTO-{idx+1}"

        entity_extraction_count = sum(
            1 for e in evidence.get("entities", [])
            if e.get("label") == "PERSON" and e.get("text", "").strip() == name
        )

        result = compute_priority_score_from_evidence(
            case_id=case_id,
            entity_id=entity_id,
            entity_name=name,
            entity_extraction_count=entity_extraction_count,
            domain_entity_count=domain_count,
            forensic_findings=evidence.get("forensic_findings", []),
            cdr_analysis=cdr_analysis,
            location_points=evidence.get("location_points", []),
            incident_lat=incident_lat,
            incident_lon=incident_lon,
            cross_verification_results=evidence.get("cross_verification_results", []),
            timeline_events=evidence.get("timeline_events", []),
            gaps_detected=evidence.get("gaps_detected", []),
            graph_connections=graph_connections,
            transaction_records=evidence.get("transaction_records", []),
        )

        ranked.append({
            "entity_id": entity_id,
            "entity_name": name,
            "priority_score": result["priority_score"],
            "factors": result["factors"],
            "explanation": result["explanation"]
        })

    ranked.sort(key=lambda r: r["priority_score"], reverse=True)
    return ranked


def _score_from_factors(case_id: str, entity_id: str, factor_values: dict):
    factors = []
    total_score = 0.0

    for factor_name, weight in WEIGHTS.items():
        raw_value = factor_values.get(factor_name, 0)
        contribution = round(weight * raw_value, 2)
        total_score += contribution
        factors.append({
            "factor_name": factor_name,
            "weight": weight,
            "raw_value": round(raw_value, 2),
            "contribution": contribution
        })

    explanation_parts = [
        f"{f['factor_name'].replace('_', ' ').title()} scored {f['raw_value']}/100, contributing {f['contribution']} points"
        for f in factors if f["contribution"] > 0
    ]
    explanation = "; ".join(explanation_parts) if explanation_parts else "No significant contributing factors found in available evidence."

    return {
        "case_id": case_id,
        "entity_id": entity_id,
        "priority_score": round(total_score, 2),
        "factors": factors,
        "explanation": explanation
    }