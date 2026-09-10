from pydantic import BaseModel
from typing import Optional


class DistanceRequest(BaseModel):
    lat1: float
    lon1: float
    lat2: float
    lon2: float


class DistanceResponse(BaseModel):
    distance_km: float


class MovementPlausibilityRequest(BaseModel):
    lat1: float
    lon1: float
    time1: str
    lat2: float
    lon2: float
    time2: str


class MovementPlausibilityResponse(BaseModel):
    distance_km: float
    time_elapsed_minutes: float
    required_speed_kmh: float
    is_plausible: bool
    explanation: str