from pydantic import BaseModel


class ResolutionResponse(BaseModel):
    entity_a: str
    entity_b: str
    similarity_score: float
    is_likely_match: bool
    requires_verification: bool