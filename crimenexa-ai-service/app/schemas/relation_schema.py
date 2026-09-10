from pydantic import BaseModel
from typing import List


class ExtractedRelation(BaseModel):
    source: str
    relation: str
    target: str
    confidence: float


class RelationExtractionResponse(BaseModel):
    relations: List[ExtractedRelation]