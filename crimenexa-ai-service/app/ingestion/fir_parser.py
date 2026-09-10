from app.services.ocr_service import extract_text
from app.services.ner_service import extract_entities
from app.services.domain_entity_service import extract_domain_entities
from app.services.relation_extraction_service import extract_relations
from app.services.graph_writer_service import (
    write_extracted_entities_to_graph,
    write_domain_entities_to_graph,
    write_relations_to_graph
)


def parse_fir(file_path: str, is_pdf: bool, is_scanned: bool = False, case_id: str = None):
    if is_scanned or is_pdf:
        raw_text = extract_text(file_path, is_pdf=is_pdf)
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            raw_text = f.read()

    entities = extract_entities(raw_text)
    domain_entities = extract_domain_entities(raw_text)
    relations = extract_relations(raw_text)

    graph_result = {"entities_written": [], "relations_written": []}
    if case_id:
        try:
            written_general = write_extracted_entities_to_graph(case_id, entities)
            written_domain = write_domain_entities_to_graph(case_id, domain_entities)
            written_relations = write_relations_to_graph(case_id, relations)
            graph_result["entities_written"] = written_general + written_domain
            graph_result["relations_written"] = written_relations
        except RuntimeError:
            pass

    return {
        "raw_text": raw_text,
        "entities": entities,
        "domain_entities": domain_entities,
        "relations": relations,
        "graph_result": graph_result
    }