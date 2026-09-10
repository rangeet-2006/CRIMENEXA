from app.services.ner_service import extract_entities
from app.services.relation_extraction_service import extract_relations


def parse_witness_statement(text: str):
    entities = extract_entities(text)
    relations = extract_relations(text)

    return {
        "raw_text": text,
        "entities": entities,
        "relations": relations
    }