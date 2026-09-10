from pydantic import BaseModel
from typing import List, Optional


class Detection(BaseModel):
    label: str
    confidence: float
    bounding_box: List[float]


class VisionAnalysisResponse(BaseModel):
    case_id: str
    filename: str
    detections: List[Detection]
    person_count: int
    vehicle_count: int