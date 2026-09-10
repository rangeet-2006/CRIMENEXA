from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class TransactionRecord(BaseModel):
    sender: str
    receiver: str
    amount: float
    transaction_time: datetime
    transaction_type: Optional[str] = None
    account_number: Optional[str] = None


class TransactionParseResponse(BaseModel):
    case_id: str
    total_records: int
    records: List[TransactionRecord]