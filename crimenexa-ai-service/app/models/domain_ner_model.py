import re

VEHICLE_PATTERN = re.compile(r"\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}\b")
IPC_SECTION_PATTERN = re.compile(r"\b(?:section|sec\.?|u/s)\s?\d{1,3}[A-Za-z]?\b", re.IGNORECASE)
BANK_ACCOUNT_PATTERN = re.compile(r"\b\d{9,18}\b")
PHONE_PATTERN = re.compile(r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b")
IFSC_PATTERN = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")


def match_vehicle_numbers(text: str):
    return list(set(VEHICLE_PATTERN.findall(text)))


def match_ipc_sections(text: str):
    return list(set(IPC_SECTION_PATTERN.findall(text)))


def match_bank_accounts(text: str):
    return list(set(BANK_ACCOUNT_PATTERN.findall(text)))


def match_phone_numbers(text: str):
    return list(set(PHONE_PATTERN.findall(text)))


def match_ifsc_codes(text: str):
    return list(set(IFSC_PATTERN.findall(text)))