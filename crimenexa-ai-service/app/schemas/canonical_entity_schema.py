from pydantic import BaseModel
from typing import List, Optional


class CanonicalPerson(BaseModel):
    canonical_id: str
    canonical_name: str
    aliases: List[str] = []
    phone_numbers: List[str] = []
    vehicle_numbers: List[str] = []
    addresses: List[str] = []
    bank_accounts: List[str] = []
    source_records: List[str] = []


class CanonicalVehicle(BaseModel):
    canonical_id: str
    registration_number: str
    owner_canonical_id: Optional[str] = None
    source_records: List[str] = []


class CanonicalPhone(BaseModel):
    canonical_id: str
    normalized_number: str
    owner_canonical_id: Optional[str] = None
    source_records: List[str] = []


class CanonicalLocation(BaseModel):
    canonical_id: str
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_records: List[str] = []


class CanonicalOrganization(BaseModel):
    canonical_id: str
    name: str
    aliases: List[str] = []
    source_records: List[str] = []