from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.services.timeline_service import build_timeline
from app.services.case_evidence_store import set_timeline

router = APIRouter()


class TimelineRequest(BaseModel):
    case_id: str
    cdr_records: Optional[List[Dict[str, Any]]] = []
    location_points: Optional[List[Dict[str, Any]]] = []
    transaction_records: Optional[List[Dict[str, Any]]] = []


@router.post("/build")
async def build(request: TimelineRequest):
    result = build_timeline(
        cdr_records=request.cdr_records,
        location_points=request.location_points,
        transaction_records=request.transaction_records
    )
    set_timeline(request.case_id, result["events"], result["gaps_detected"])
    return {"case_id": request.case_id, **result}


class BuildTimelineForCaseRequest(BaseModel):
    case_id: str


@router.post("/build-for-case")
async def build_for_case(request: BuildTimelineForCaseRequest):
    from app.services.case_evidence_store import get_case_evidence

    evidence = get_case_evidence(request.case_id)

    result = build_timeline(
        cdr_records=evidence["cdr_records"],
        location_points=evidence["location_points"],
        transaction_records=evidence["transaction_records"]
    )
    set_timeline(request.case_id, result["events"], result["gaps_detected"])
    return {"case_id": request.case_id, **result}