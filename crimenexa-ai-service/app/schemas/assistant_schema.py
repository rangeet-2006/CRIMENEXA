from pydantic import BaseModel
from typing import List


class SourceReference(BaseModel):
    source_id: str
    source_type: str
    excerpt: str


class AssistantResponse(BaseModel):
    question: str
    answer: str
    sources: List[SourceReference]