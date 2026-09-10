from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EvidenceRecord(BaseModel):
    evidence_id: str
    case_id: str
    source_type: str
    source_filename: str
    content_excerpt: str
    confidence: float = 1.0
    verification_status: str = "UNVERIFIED"
    file_hash: Optional[str] = None
    timestamp: Optional[datetime] = None
    ingested_at: datetime