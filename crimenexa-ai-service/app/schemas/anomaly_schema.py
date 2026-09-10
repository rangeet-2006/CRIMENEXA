from pydantic import BaseModel
from typing import List


class AnomalyResult(BaseModel):
    record_id: str
    is_anomaly: bool
    anomaly_score: float


class AnomalyDetectionResponse(BaseModel):
    case_id: str
    results: List[AnomalyResult]