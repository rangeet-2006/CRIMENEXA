from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, List, Any, Optional

from app.services.priority_scoring import (
    compute_priority_score,
    compute_priority_score_from_evidence,
    rank_suspects_for_case
)
from app.services.cdr_analysis_service import analyze_cdr
from app.services.case_evidence_store import get_case_evidence
from app.graph.neo4j_client import get_case_graph

router = APIRouter()


class PriorityRequest(BaseModel):
    case_id: str
    entity_id: str
    factor_inputs: Dict[str, float]


class EvidenceBasedPriorityRequest(BaseModel):
    case_id: str
    entity_id: str
    entity_name: str
    entity_extraction_count: int = 0
    domain_entity_count: int = 0
    forensic_findings: List[Dict[str, Any]] = []
    cdr_analysis: Optional[Dict[str, Any]] = None
    location_points: List[Dict[str, Any]] = []
    incident_lat: Optional[float] = None
    incident_lon: Optional[float] = None
    cross_verification_results: List[Dict[str, Any]] = []
    timeline_events: List[Dict[str, Any]] = []
    gaps_detected: List[Dict[str, Any]] = []
    graph_connections: List[Dict[str, Any]] = []
    transaction_records: List[Dict[str, Any]] = []


class CasePriorityRequest(BaseModel):
    case_id: str
    entity_id: str
    entity_name: str
    incident_lat: Optional[float] = None
    incident_lon: Optional[float] = None


class RankSuspectsRequest(BaseModel):
    case_id: str
    incident_lat: Optional[float] = None
    incident_lon: Optional[float] = None


@router.post("/score")
async def score(request: PriorityRequest):
    """Manual override path — accepts pre-computed factor values (0-100 each)."""
    result = compute_priority_score(request.case_id, request.entity_id, request.factor_inputs)
    return result


@router.post("/score-from-evidence")
async def score_from_evidence(request: EvidenceBasedPriorityRequest):
    """Direct evidence path — accepts all evidence explicitly in the request body."""
    result = compute_priority_score_from_evidence(
        case_id=request.case_id,
        entity_id=request.entity_id,
        entity_name=request.entity_name,
        entity_extraction_count=request.entity_extraction_count,
        domain_entity_count=request.domain_entity_count,
        forensic_findings=request.forensic_findings,
        cdr_analysis=request.cdr_analysis,
        location_points=request.location_points,
        incident_lat=request.incident_lat,
        incident_lon=request.incident_lon,
        cross_verification_results=request.cross_verification_results,
        timeline_events=request.timeline_events,
        gaps_detected=request.gaps_detected,
        graph_connections=request.graph_connections,
        transaction_records=request.transaction_records,
    )
    return result


@router.post("/score-for-case")
async def score_for_case(request: CasePriorityRequest):
    """
    Automatic path — pulls all previously ingested evidence for this case
    and recomputes the priority score for the named entity using everything
    accumulated so far.
    """
    evidence = get_case_evidence(request.case_id)

    cdr_analysis = analyze_cdr(evidence["cdr_records"]) if evidence["cdr_records"] else None
    domain_count = sum(len(v) for v in evidence["domain_entities"].values())

    graph_connections = []
    try:
        graph_connections = get_case_graph(request.case_id)
    except RuntimeError:
        pass

    result = compute_priority_score_from_evidence(
        case_id=request.case_id,
        entity_id=request.entity_id,
        entity_name=request.entity_name,
        entity_extraction_count=len(evidence["entities"]),
        domain_entity_count=domain_count,
        forensic_findings=evidence["forensic_findings"],
        cdr_analysis=cdr_analysis,
        location_points=evidence["location_points"],
        incident_lat=request.incident_lat,
        incident_lon=request.incident_lon,
        cross_verification_results=evidence["cross_verification_results"],
        timeline_events=evidence["timeline_events"],
        gaps_detected=evidence["gaps_detected"],
        graph_connections=graph_connections,
        transaction_records=evidence["transaction_records"],
    )
    return result


@router.post("/rank-suspects-for-case")
async def rank_suspects(request: RankSuspectsRequest):
    """
    Fully automatic suspect discovery and ranking. Scans all evidence
    accumulated for this case (FIR entities, CDR caller/receiver, transaction
    sender/receiver, witness statement entities, GPS entity names), identifies
    every unique person mentioned, computes a priority score for each, and
    returns them ranked highest-priority first.

    This does not determine guilt — it surfaces where evidence currently
    concentrates, for investigator review.
    """
    evidence = get_case_evidence(request.case_id)

    cdr_analysis = analyze_cdr(evidence["cdr_records"]) if evidence["cdr_records"] else None

    graph_connections = []
    try:
        graph_connections = get_case_graph(request.case_id)
    except RuntimeError:
        pass

    ranked = rank_suspects_for_case(
        case_id=request.case_id,
        evidence=evidence,
        cdr_analysis=cdr_analysis,
        graph_connections=graph_connections,
        incident_lat=request.incident_lat,
        incident_lon=request.incident_lon,
    )

    return {
        "case_id": request.case_id,
        "total_persons_identified": len(ranked),
        "ranked_suspects": ranked
    }