from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any

from app.services.rag_service import ask_assistant

router = APIRouter()


class AssistantRequest(BaseModel):
    question: str
    case_id: str
    retrieved_context: List[Dict[str, Any]] = []


@router.post("/ask")
async def ask(request: AssistantRequest):
    result = ask_assistant(request.question, request.retrieved_context)
    return result