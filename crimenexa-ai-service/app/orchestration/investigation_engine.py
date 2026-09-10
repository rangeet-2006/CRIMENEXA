from app.services.priority_scoring import compute_priority_score_from_evidence
from app.services.timeline_service import build_timeline
from app.services.cross_verification_service import cross_verify_location_claims
from app.graph.neo4j_client import get_case_graph, get_top_influencers


def run_investigation(case_id: str, entity_id: str, entity_name: str = None,
                       cdr_records: list = None, location_points: list = None,
                       transaction_records: list = None, cross_verification_claims: list = None,
                       entity_extraction_count: int = 0, domain_entity_count: int = 0,
                       forensic_findings: list = None, incident_lat: float = None,
                       incident_lon: float = None):

    stages_completed = []
    stages_pending = []

    timeline_result = build_timeline(
        cdr_records=cdr_records,
        location_points=location_points,
        transaction_records=transaction_records
    )
    stages_completed.append("TIMELINE")

    cross_verification_results = []
    if cross_verification_claims:
        cross_verification_results = cross_verify_location_claims(cross_verification_claims)
        stages_completed.append("CROSS_VERIFY")
    else:
        stages_pending.append("CROSS_VERIFY")

    graph_connections = []
    try:
        graph_connections = get_case_graph(case_id)
        stages_completed.append("GRAPH")
    except RuntimeError:
        stages_pending.append("GRAPH (Neo4j not configured)")

    from app.services.cdr_analysis_service import analyze_cdr
    cdr_analysis = analyze_cdr(cdr_records) if cdr_records else None

    priority_result = None
    if entity_name:
        priority_result = compute_priority_score_from_evidence(
            case_id=case_id,
            entity_id=entity_id,
            entity_name=entity_name,
            entity_extraction_count=entity_extraction_count,
            domain_entity_count=domain_entity_count,
            forensic_findings=forensic_findings or [],
            cdr_analysis=cdr_analysis,
            location_points=location_points or [],
            incident_lat=incident_lat,
            incident_lon=incident_lon,
            cross_verification_results=cross_verification_results,
            timeline_events=timeline_result["events"],
            gaps_detected=timeline_result["gaps_detected"],
            graph_connections=graph_connections,
        )
        stages_completed.append("PRIORITY")
    else:
        stages_pending.append("PRIORITY (entity_name not provided)")

    stages_pending.append("ANOMALY (run separately via /api/anomaly/detect)")

    explanation_parts = []
    if priority_result:
        explanation_parts.append(priority_result["explanation"])
    if cross_verification_results:
        corroborated = sum(1 for r in cross_verification_results if r["status"] == "CORROBORATED")
        explanation_parts.append(f"{corroborated} claims corroborated across independent sources.")
    if timeline_result["gaps_detected"]:
        explanation_parts.append(f"{len(timeline_result['gaps_detected'])} timeline gaps detected.")

    explanation = " ".join(explanation_parts) if explanation_parts else "Investigation pipeline run with limited inputs."

    return {
        "case_id": case_id,
        "entity_id": entity_id,
        "priority_score": priority_result["priority_score"] if priority_result else 0.0,
        "priority_factors": priority_result["factors"] if priority_result else [],
        "cross_verification_summary": cross_verification_results,
        "timeline_event_count": len(timeline_result["events"]),
        "graph_connections": len(graph_connections),
        "explanation": explanation,
        "stages_completed": stages_completed,
        "stages_pending": stages_pending
    }