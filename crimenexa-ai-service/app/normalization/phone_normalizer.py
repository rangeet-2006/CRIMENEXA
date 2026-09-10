import re


def normalize_phone(raw_number: str) -> str:
    digits = re.sub(r"\D", "", raw_number)

    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]

    if len(digits) == 10:
        return f"+91{digits}"

    return digits