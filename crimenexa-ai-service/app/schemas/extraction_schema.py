from pydantic import BaseModel
from typing import List


class ExtractedEntity(BaseModel):
    text: str
    label: str
    start_char: int
    end_char: int


class ExtractionResponse(BaseModel):
    filename: str
    document_category: str
    raw_text_preview: str
    entities: List[ExtractedEntity]