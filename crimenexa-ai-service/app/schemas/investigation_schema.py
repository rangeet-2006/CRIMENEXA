from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class InvestigationRequest(BaseModel):
    case_id: str
    entity_id: str


class InvestigationSummary(BaseModel):
    case_id: str
    entity_id: str
    priority_score: float
    priority_factors: List[Dict[str, Any]]
    cross_verification_summary: List[Dict[str, Any]]
    timeline_event_count: int
    graph_connections: int
    explanation: str
    stages_completed: List[str]
    stages_pending: List[str]