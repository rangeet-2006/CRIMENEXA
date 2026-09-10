import os
import shutil
import tempfile

from fastapi import APIRouter, UploadFile, File, Form

from app.services.ocr_service import extract_text
from app.services.ner_service import extract_entities
from app.services.graph_writer_service import write_extracted_entities_to_graph

router = APIRouter()


@router.post("/extract")
async def extract_entities_from_file(file: UploadFile = File(...), document_category: str = Form(...),
                                      case_id: str = Form(None)):
    suffix = os.path.splitext(file.filename)[1].lower()
    is_pdf = suffix == ".pdf"
    is_image = suffix in {".png", ".jpg", ".jpeg"}

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        if is_pdf or is_image:
            raw_text = extract_text(tmp_path, is_pdf=is_pdf)
        else:
            with open(tmp_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_text = f.read()

        entities = extract_entities(raw_text)

        graph_written = []
        if case_id:
            try:
                graph_written = write_extracted_entities_to_graph(case_id, entities)
            except RuntimeError:
                pass

        return {
            "filename": file.filename,
            "document_category": document_category,
            "raw_text_preview": raw_text[:300],
            "entities": entities,
            "graph_entities_written": graph_written
        }
    finally:
        os.remove(tmp_path)