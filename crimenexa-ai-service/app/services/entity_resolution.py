from Levenshtein import ratio as levenshtein_ratio
from sentence_transformers import util
from app.models.embedding_model import get_embedding

LEVENSHTEIN_WEIGHT = 0.4
EMBEDDING_WEIGHT = 0.6
MATCH_THRESHOLD = 0.80
VERIFICATION_THRESHOLD = 0.60


def resolve_entities(entity_a: str, entity_b: str):
    lev_score = levenshtein_ratio(entity_a.lower(), entity_b.lower())

    embedding_a = get_embedding(entity_a)
    embedding_b = get_embedding(entity_b)
    cosine_score = float(util.cos_sim(embedding_a, embedding_b)[0][0])

    combined_score = (LEVENSHTEIN_WEIGHT * lev_score) + (EMBEDDING_WEIGHT * cosine_score)

    is_likely_match = combined_score >= MATCH_THRESHOLD
    requires_verification = VERIFICATION_THRESHOLD <= combined_score < MATCH_THRESHOLD

    return {
        "entity_a": entity_a,
        "entity_b": entity_b,
        "similarity_score": round(combined_score, 4),
        "is_likely_match": is_likely_match,
        "requires_verification": requires_verification
    }