from app.models.domain_ner_model import (
    match_vehicle_numbers,
    match_ipc_sections,
    match_bank_accounts,
    match_phone_numbers,
    match_ifsc_codes,
)


def extract_domain_entities(text: str):
    return {
        "vehicle_numbers": match_vehicle_numbers(text),
        "ipc_sections": match_ipc_sections(text),
        "bank_accounts": match_bank_accounts(text),
        "phone_numbers": match_phone_numbers(text),
        "ifsc_codes": match_ifsc_codes(text),
    }