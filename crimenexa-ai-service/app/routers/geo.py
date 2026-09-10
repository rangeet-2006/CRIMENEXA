from fastapi import APIRouter

from app.schemas.geo_schema import (
    DistanceRequest, DistanceResponse,
    MovementPlausibilityRequest, MovementPlausibilityResponse
)
from app.services.geo_service import haversine_distance, check_movement_plausibility

router = APIRouter()


@router.post("/distance", response_model=DistanceResponse)
async def distance(request: DistanceRequest):
    dist = haversine_distance(request.lat1, request.lon1, request.lat2, request.lon2)
    return DistanceResponse(distance_km=round(dist, 3))


@router.post("/movement-plausibility", response_model=MovementPlausibilityResponse)
async def movement_plausibility(request: MovementPlausibilityRequest):
    result = check_movement_plausibility(
        request.lat1, request.lon1, request.time1,
        request.lat2, request.lon2, request.time2
    )
    return MovementPlausibilityResponse(**result)