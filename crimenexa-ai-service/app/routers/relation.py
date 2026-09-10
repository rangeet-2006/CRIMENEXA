from fastapi import APIRouter
from pydantic import BaseModel

from app.services.relation_extraction_service import extract_relations

router = APIRouter()


class RelationRequest(BaseModel):
    text: str


@router.post("/extract-relations")
async def extract_relations_from_text(request: RelationRequest):
    relations = extract_relations(request.text)
    return {"relations": relations}