import re
from app.services.ner_service import extract_entities
from app.services.ocr_service import extract_text

FINDING_PATTERNS = {
    "blood_group": re.compile(r"blood\s*group\s*[:\-]?\s*([ABO][+-])", re.IGNORECASE),
    "time_estimate": re.compile(r"time\s*(?:of\s*death|estimate)\s*[:\-]?\s*([\d:apmAPM\s\-–toTO]+)", re.IGNORECASE),
    "weapon": re.compile(r"weapon\s*[:\-]?\s*([A-Za-z0-9 ]+?)(?:\.|,|\n)", re.IGNORECASE),
    "match_confidence": re.compile(r"match\s*[:\-]?\s*(partial|full|no)\s*match", re.IGNORECASE),
}


def parse_forensic_report_text(text: str):
    findings = []

    for finding_type, pattern in FINDING_PATTERNS.items():
        match = pattern.search(text)
        if match:
            findings.append({
                "type": finding_type,
                "value": match.group(1).strip(),
                "confidence": 1.0
            })

    entities = extract_entities(text)

    return {
        "raw_text": text,
        "findings": findings,
        "entities": entities
    }


def parse_forensic_report_file(file_path: str, is_pdf: bool = False, is_image: bool = False):
    if is_pdf or is_image:
        raw_text = extract_text(file_path, is_pdf=is_pdf)
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_text = f.read()

    return parse_forensic_report_text(raw_text)