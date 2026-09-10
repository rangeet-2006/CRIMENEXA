from fastapi import APIRouter
from pydantic import BaseModel

from app.services.entity_resolution import resolve_entities

router = APIRouter()


class ResolutionRequest(BaseModel):
    entity_a: str
    entity_b: str


@router.post("/resolve")
async def resolve(request: ResolutionRequest):
    result = resolve_entities(request.entity_a, request.entity_b)
    return result