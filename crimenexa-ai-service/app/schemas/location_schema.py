from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class LocationPoint(BaseModel):
    entity_name: str
    latitude: float
    longitude: float
    timestamp: datetime
    source: Optional[str] = None


class LocationParseResponse(BaseModel):
    case_id: str
    total_points: int
    points: List[LocationPoint]