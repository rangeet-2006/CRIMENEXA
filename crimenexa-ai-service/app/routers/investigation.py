from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.orchestration.investigation_engine import run_investigation

router = APIRouter()


class InvestigationRunRequest(BaseModel):
    case_id: str
    entity_id: str
    entity_name: Optional[str] = None
    cdr_records: Optional[List[Dict[str, Any]]] = None
    location_points: Optional[List[Dict[str, Any]]] = None
    transaction_records: Optional[List[Dict[str, Any]]] = None
    cross_verification_claims: Optional[List[Dict[str, Any]]] = None
    entity_extraction_count: int = 0
    domain_entity_count: int = 0
    forensic_findings: Optional[List[Dict[str, Any]]] = None
    incident_lat: Optional[float] = None
    incident_lon: Optional[float] = None


@router.post("/run")
async def run(request: InvestigationRunRequest):
    result = run_investigation(
        case_id=request.case_id,
        entity_id=request.entity_id,
        entity_name=request.entity_name,
        cdr_records=request.cdr_records,
        location_points=request.location_points,
        transaction_records=request.transaction_records,
        cross_verification_claims=request.cross_verification_claims,
        entity_extraction_count=request.entity_extraction_count,
        domain_entity_count=request.domain_entity_count,
        forensic_findings=request.forensic_findings,
        incident_lat=request.incident_lat,
        incident_lon=request.incident_lon,
    )
    return result