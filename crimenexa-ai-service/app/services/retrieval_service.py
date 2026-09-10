from app.models.embedding_model import get_embedding_model
from sentence_transformers import util

_document_store = []


def index_document(source_id: str, source_type: str, text: str, chunk_size: int = 300):
    model = get_embedding_model()
    chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

    for idx, chunk in enumerate(chunks):
        embedding = model.encode(chunk, convert_to_tensor=True)
        _document_store.append({
            "source_id": source_id,
            "source_type": source_type,
            "chunk_id": f"{source_id}-{idx}",
            "text": chunk,
            "embedding": embedding
        })


def retrieve_relevant_chunks(question: str, top_k: int = 5):
    if not _document_store:
        return []

    model = get_embedding_model()
    question_embedding = model.encode(question, convert_to_tensor=True)

    scored = []
    for doc in _document_store:
        score = float(util.cos_sim(question_embedding, doc["embedding"])[0][0])
        scored.append((score, doc))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_results = scored[:top_k]

    return [
        {
            "source_id": doc["source_id"],
            "source_type": doc["source_type"],
            "excerpt": doc["text"]
        }
        for score, doc in top_results
    ]


def clear_index():
    global _document_store
    _document_store = []