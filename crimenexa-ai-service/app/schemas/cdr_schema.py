from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CallRecord(BaseModel):
    caller: str
    receiver: str
    call_time: datetime
    duration_seconds: int
    call_type: Optional[str] = None


class CdrParseResponse(BaseModel):
    case_id: str
    total_records: int
    records: List[CallRecord]


class CdrAnalysisResponse(BaseModel):
    case_id: str
    call_frequency: dict
    total_duration_by_pair: dict
    most_frequent_pairs: List[dict]
    unusual_frequency_flags: List[dict]