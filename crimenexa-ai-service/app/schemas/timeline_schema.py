from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class TimelineEvent(BaseModel):
    timestamp: datetime
    event_type: str
    description: str
    entities_involved: List[str] = []
    source: str
    confidence: float = 1.0


class TimelineResponse(BaseModel):
    case_id: str
    events: List[TimelineEvent]
    gaps_detected: List[dict] = []