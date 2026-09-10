from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any

from app.services.anomaly_detection import detect_anomalies

router = APIRouter()


class AnomalyRequest(BaseModel):
    case_id: str
    records: List[Dict[str, Any]]


@router.post("/detect")
async def detect(request: AnomalyRequest):
    result = detect_anomalies(request.case_id, request.records)
    return result