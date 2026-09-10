import os
import requests

BACKEND_ALERT_ENDPOINT = "/api/internal/alerts"


def _get_backend_base_url():
    return os.getenv("BACKEND_BASE_URL", "http://localhost:8080")


def _get_internal_api_key():
    return os.getenv("INTERNAL_API_KEY")


def notify_alert(case_id: str, severity: str, category: str, title: str, description: str = ""):
    api_key = _get_internal_api_key()
    if not api_key:
        return {"status": "skipped", "reason": "INTERNAL_API_KEY not configured"}

    url = _get_backend_base_url() + BACKEND_ALERT_ENDPOINT

    headers = {
        "X-Internal-Api-Key": api_key,
        "Content-Type": "application/json"
    }

    payload = {
        "caseId": case_id,
        "severity": severity,
        "category": category,
        "title": title,
        "description": description
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        return {"status": "sent", "response": response.json()}
    except requests.RequestException as e:
        return {"status": "failed", "error": str(e)}