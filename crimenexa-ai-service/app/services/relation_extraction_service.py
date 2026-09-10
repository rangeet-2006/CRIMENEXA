from app.models.ner_model_loader import get_nlp

RELATION_VERBS = {
    "called": "CALLED",
    "met": "MET",
    "transferred": "TRANSFERRED",
    "owns": "OWNS",
    "visited": "VISITED",
    "works": "WORKS_FOR",
    "contacted": "CONTACTED",
    "directed": "DIRECTS",
}


def extract_relations(text: str):
    nlp = get_nlp()
    doc = nlp(text)
    relations = []

    for sent in doc.sents:
        persons_orgs = [ent for ent in sent.ents if ent.label_ in {"PERSON", "ORG", "GPE"}]
        if len(persons_orgs) < 2:
            continue

        sent_text_lower = sent.text.lower()
        matched_relation = None
        for verb, relation_label in RELATION_VERBS.items():
            if verb in sent_text_lower:
                matched_relation = relation_label
                break

        if matched_relation:
            for i in range(len(persons_orgs) - 1):
                relations.append({
                    "source": persons_orgs[i].text,
                    "relation": matched_relation,
                    "target": persons_orgs[i + 1].text,
                    "confidence": 0.65
                })

    return relations