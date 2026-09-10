from app.models.ner_model_loader import get_nlp

RELEVANT_LABELS = {"PERSON", "ORG", "GPE", "LOC", "DATE", "TIME", "MONEY", "CARDINAL", "FAC"}


def extract_entities(text: str):
    nlp = get_nlp()
    doc = nlp(text)

    entities = []
    for ent in doc.ents:
        if ent.label_ in RELEVANT_LABELS:
            entities.append({
                "text": ent.text,
                "label": ent.label_,
                "start_char": ent.start_char,
                "end_char": ent.end_char
            })

    return entities