from app.models.llm_client import generate_answer


def build_grounded_prompt(question: str, retrieved_context: list) -> str:
    context_block = "\n".join(
        f"- [{item.get('source_type', 'source')}] {item.get('excerpt', '')}"
        for item in retrieved_context
    )

    prompt = (
        "You are an investigative assistant. Answer the question using ONLY the evidence "
        "provided below. If the evidence does not contain the answer, say so clearly. "
        "Do not invent facts.\n\n"
        f"EVIDENCE:\n{context_block}\n\n"
        f"QUESTION: {question}\n\n"
        "ANSWER:"
    )
    return prompt


def ask_assistant(question: str, retrieved_context: list):
    prompt = build_grounded_prompt(question, retrieved_context)
    answer = generate_answer(prompt)

    sources = [
        {
            "source_id": item.get("source_id", "unknown"),
            "source_type": item.get("source_type", "unknown"),
            "excerpt": item.get("excerpt", "")
        }
        for item in retrieved_context
    ]

    return {
        "question": question,
        "answer": answer,
        "sources": sources
    }