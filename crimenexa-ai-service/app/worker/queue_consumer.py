# This module will consume messages from the upload queue published by
# crimenexa-backend's UploadService, and trigger the AI processing pipeline
# (OCR -> NER -> domain entities -> relation extraction -> Neo4j write).
#
# Not yet wired to a real message broker. To be implemented once the
# queueing technology (e.g., RabbitMQ + Celery, or a simpler polling approach)
# is finalized.

def process_upload_message(upload_id: str, file_path: str, is_pdf: bool, case_id: str):
    from app.services.ocr_service import extract_text
    from app.services.ner_service import extract_entities
    from app.services.domain_entity_service import extract_domain_entities

    raw_text = extract_text(file_path, is_pdf)
    entities = extract_entities(raw_text)
    domain_entities = extract_domain_entities(raw_text)

    return {
        "upload_id": upload_id,
        "case_id": case_id,
        "entities": entities,
        "domain_entities": domain_entities
    }


def start_consumer():
    print("Queue consumer not yet connected to a message broker. Skipping.")