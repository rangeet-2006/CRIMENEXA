from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any

from app.services.cross_verification_service import cross_verify_location_claims
from app.services.case_evidence_store import get_case_evidence, set_cross_verification_results

router = APIRouter()


class CrossVerificationRequest(BaseModel):
    case_id: str
    claims: List[Dict[str, Any]]


@router.post("/verify")
async def verify(request: CrossVerificationRequest):
    results = cross_verify_location_claims(request.claims, case_id=request.case_id)
    return {"case_id": request.case_id, "results": results}


class ManualClaim(BaseModel):
    source_type: str
    source_id: str
    entity_name: str
    latitude: float
    longitude: float
    timestamp: str
    excerpt: str


class CaseCrossVerificationRequest(BaseModel):
    case_id: str
    manual_claims: List[ManualClaim] = []


@router.post("/verify-for-case")
async def verify_for_case(request: CaseCrossVerificationRequest):
    evidence = get_case_evidence(request.case_id)

    location_claims = [
        {
            "source_type": "GPS",
            "source_id": f"loc-{i}",
            "entity_name": point["entity_name"],
            "latitude": point["latitude"],
            "longitude": point["longitude"],
            "timestamp": point["timestamp"],
            "excerpt": f"GPS location for {point['entity_name']}"
        }
        for i, point in enumerate(evidence["location_points"])
    ]

    all_claims = location_claims + [claim.dict() for claim in request.manual_claims]

    results = cross_verify_location_claims(all_claims, case_id=request.case_id)
    set_cross_verification_results(request.case_id, results)

    return {"case_id": request.case_id, "results": results}