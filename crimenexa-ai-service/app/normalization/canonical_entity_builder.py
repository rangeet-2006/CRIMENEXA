import uuid
from app.normalization.name_normalizer import normalize_name
from app.normalization.phone_normalizer import normalize_phone


def build_canonical_person(raw_name: str, source_record: str, phone: str = None,
                            vehicle: str = None, address: str = None, bank_account: str = None):
    canonical_id = f"PER-{uuid.uuid4().hex[:8]}"

    person = {
        "canonical_id": canonical_id,
        "canonical_name": normalize_name(raw_name),
        "aliases": [raw_name] if raw_name != normalize_name(raw_name) else [],
        "phone_numbers": [normalize_phone(phone)] if phone else [],
        "vehicle_numbers": [vehicle.upper().replace(" ", "").replace("-", "")] if vehicle else [],
        "addresses": [address] if address else [],
        "bank_accounts": [bank_account] if bank_account else [],
        "source_records": [source_record]
    }
    return person


def merge_canonical_persons(person_a: dict, person_b: dict) -> dict:
    merged = dict(person_a)
    merged["aliases"] = list(set(person_a["aliases"] + person_b["aliases"] + [person_b["canonical_name"]]))
    merged["phone_numbers"] = list(set(person_a["phone_numbers"] + person_b["phone_numbers"]))
    merged["vehicle_numbers"] = list(set(person_a["vehicle_numbers"] + person_b["vehicle_numbers"]))
    merged["addresses"] = list(set(person_a["addresses"] + person_b["addresses"]))
    merged["bank_accounts"] = list(set(person_a["bank_accounts"] + person_b["bank_accounts"]))
    merged["source_records"] = list(set(person_a["source_records"] + person_b["source_records"]))
    return merged