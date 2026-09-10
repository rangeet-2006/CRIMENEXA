from pydantic import BaseModel
from typing import List


class PriorityFactor(BaseModel):
    factor_name: str
    weight: float
    contribution: float


class PriorityScoreResponse(BaseModel):
    case_id: str
    entity_id: str
    priority_score: float
    factors: List[PriorityFactor]
    explanation: str