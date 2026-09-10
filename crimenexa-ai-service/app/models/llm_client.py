import os
import requests

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def generate_answer(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "AI Assistant is not configured yet. Please set the GEMINI_API_KEY environment variable."

    headers = {"Content-Type": "application/json"}
    params = {"key": api_key}
    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }

    response = requests.post(GEMINI_API_URL, headers=headers, params=params, json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return "The AI Assistant could not generate a response for this query."