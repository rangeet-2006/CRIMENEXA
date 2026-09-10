from fastapi import APIRouter
from pydantic import BaseModel

from app.services.domain_entity_service import extract_domain_entities

router = APIRouter()


class DomainEntityRequest(BaseModel):
    text: str


@router.post("/extract-domain-entities")
async def extract_domain_entities_from_text(request: DomainEntityRequest):
    result = extract_domain_entities(request.text)
    return result