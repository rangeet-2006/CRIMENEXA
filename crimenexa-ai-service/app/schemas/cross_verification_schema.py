from pydantic import BaseModel
from typing import List


class EvidenceSourceRef(BaseModel):
    source_type: str
    source_id: str
    excerpt: str


class CrossVerificationResult(BaseModel):
    claim: str
    status: str
    supporting_sources: List[EvidenceSourceRef]
    conflicting_sources: List[EvidenceSourceRef]
    explanation: str


class CrossVerificationResponse(BaseModel):
    case_id: str
    results: List[CrossVerificationResult]