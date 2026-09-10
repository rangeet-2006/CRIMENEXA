from pydantic import BaseModel
from typing import List


class DomainEntitiesResponse(BaseModel):
    vehicle_numbers: List[str]
    ipc_sections: List[str]
    bank_accounts: List[str]
    phone_numbers: List[str]
    ifsc_codes: List[str]