import logging
import os
import shutil
import tempfile

from fastapi import APIRouter, UploadFile, File, Form

from app.ingestion.cdr_parser import parse_cdr
from app.ingestion.location_parser import parse_location_csv, parse_location_json
from app.ingestion.transaction_parser import parse_transactions
from app.ingestion.witness_parser import parse_witness_statement
from app.ingestion.forensic_parser import parse_forensic_report_text, parse_forensic_report_file
from app.ingestion.fir_parser import parse_fir
from app.ingestion.image_video_parser import parse_cctv_image, parse_cctv_video
from app.services.graph_writer_service import write_cdr_to_graph, write_transactions_to_graph
from app.services.case_evidence_store import (
    append_entities, append_domain_entities, append_cdr_records,
    append_location_points, append_transaction_records,
    append_forensic_findings, append_witness_statement,
    evidence_counts, get_case_evidence
)
from app.services.anomaly_detection import detect_anomalies
from app.graph.neo4j_client import get_case_graph

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/case-summary/{case_id}")
async def case_summary(case_id: str):
    """
    What is known about a case after ingestion, for the backend to write back.

    The backend has no other way to learn this: it forwards uploads here and
    only ever sees a processing status, so its case entity counts stayed at
    zero and no alert was ever raised from a detected anomaly. This endpoint
    closes that loop - see AiIntegrationService on the backend side.
    """
    counts = evidence_counts(case_id)
    store = get_case_evidence(case_id)

    # Distinct entities in the case graph is the most intuitive reading of
    # "entities" for the case list; fall back to extraction counts when the
    # graph is unavailable or nothing has been written to it yet.
    entity_total = counts["entities"] + counts["domain_entities"]
    try:
        edges = get_case_graph(case_id)
        names = {e["source"] for e in edges} | {e["target"] for e in edges}
        if names:
            entity_total = len(names)
    except Exception:
        pass

    anomalies = _financial_anomalies(case_id, store.get("transaction_records") or [])

    return {
        "case_id": case_id,
        "counts": counts,
        "entity_total": entity_total,
        "anomalies": anomalies,
    }


def _financial_anomalies(case_id: str, transactions: list) -> list:
    """
    Outlier transactions, shaped so the backend can raise an alert per finding.

    Severity is assigned by RANK, not an absolute score threshold: the most
    extreme outlier in the case is CRITICAL and the rest HIGH. An absolute
    cut-off would be an invented number, since the detector is unsupervised
    and its scores are only meaningful relative to the rest of the case.
    """
    if not transactions:
        return []

    try:
        outcome = detect_anomalies(case_id, transactions)
    except Exception:
        return []

    flagged = []
    for record, result in zip(transactions, outcome.get("results", [])):
        if not result.get("is_anomaly"):
            continue
        flagged.append({
            "record": record,
            "score": result.get("anomaly_score", 0.0),
        })

    # Most anomalous first. Scores are more negative the more unusual.
    flagged.sort(key=lambda f: f["score"])

    alerts = []
    for index, item in enumerate(flagged):
        record = item["record"]
        sender = record.get("sender") or "unknown"
        receiver = record.get("receiver") or "unknown"
        amount = record.get("amount")
        amount_text = f"{amount:,.0f}" if isinstance(amount, (int, float)) else "an unusual amount"
        alerts.append({
            "category": "Financial",
            "severity": "CRITICAL" if index == 0 else "HIGH",
            "title": f"Outlier transaction: {sender} to {receiver}",
            "description": (
                f"A transfer of {amount_text} from {sender} to {receiver} sits outside the "
                f"pattern of the other transactions in this case "
                f"(anomaly score {item['score']}). Flagged by unsupervised outlier "
                f"detection - review against the source statement."
            ),
            "reference": str(record.get("transaction_time") or record.get("id") or ""),
        })
    return alerts


@router.post("/cdr")
async def ingest_cdr(file: UploadFile = File(...), case_id: str = Form(...)):
    suffix = os.path.splitext(file.filename)[1].lower()
    is_excel = suffix in {".xlsx", ".xls"}

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        records = parse_cdr(tmp_path, is_excel=is_excel)
        append_cdr_records(case_id, records)

        graph_result = {"entities_written": [], "relations_written": []}
        try:
            graph_result = write_cdr_to_graph(case_id, records)
        except Exception as exc:
            # Report it instead of returning a clean 200 with an empty graph.
            # Swallowing this made an unconfigured or unreachable Neo4j look
            # like a successful ingestion that merely produced no network.
            logger.warning("CDR graph write failed for case %s: %s", case_id, exc)
            graph_result["error"] = f"Graph write failed: {exc}"

        return {
            "case_id": case_id,
            "total_records": len(records),
            "records": records,
            "graph_result": graph_result
        }
    finally:
        os.remove(tmp_path)


@router.post("/location")
async def ingest_location(file: UploadFile = File(...), case_id: str = Form(...)):
    suffix = os.path.splitext(file.filename)[1].lower()

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        if suffix == ".json":
            points = parse_location_json(tmp_path)
        else:
            points = parse_location_csv(tmp_path)

        append_location_points(case_id, points)

        return {"case_id": case_id, "total_points": len(points), "points": points}
    finally:
        os.remove(tmp_path)


@router.post("/transactions")
async def ingest_transactions(file: UploadFile = File(...), case_id: str = Form(...)):
    suffix = os.path.splitext(file.filename)[1].lower()
    is_excel = suffix in {".xlsx", ".xls"}

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        records = parse_transactions(tmp_path, is_excel=is_excel)
        append_transaction_records(case_id, records)

        graph_result = {"entities_written": [], "relations_written": []}
        try:
            graph_result = write_transactions_to_graph(case_id, records)
        except Exception as exc:
            logger.warning("Transaction graph write failed for case %s: %s", case_id, exc)
            graph_result["error"] = f"Graph write failed: {exc}"

        return {
            "case_id": case_id,
            "total_records": len(records),
            "records": records,
            "graph_result": graph_result
        }
    finally:
        os.remove(tmp_path)


@router.post("/witness")
async def ingest_witness(text: str = Form(...), case_id: str = Form(...)):
    result = parse_witness_statement(text)
    append_witness_statement(case_id, {
        "text": text,
        "entities": result["entities"],
        "relations": result["relations"]
    })
    return {"case_id": case_id, **result}


@router.post("/forensic")
async def ingest_forensic(file: UploadFile = File(...), case_id: str = Form(...)):
    suffix = os.path.splitext(file.filename)[1].lower()
    is_pdf = suffix == ".pdf"
    is_image = suffix in {".png", ".jpg", ".jpeg"}

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = parse_forensic_report_file(tmp_path, is_pdf=is_pdf, is_image=is_image)
        append_forensic_findings(case_id, result["findings"])
        return {"case_id": case_id, **result}
    finally:
        os.remove(tmp_path)


@router.post("/forensic-text")
async def ingest_forensic_text(text: str = Form(...), case_id: str = Form(...)):
    result = parse_forensic_report_text(text)
    append_forensic_findings(case_id, result["findings"])
    return {"case_id": case_id, **result}


@router.post("/fir")
async def ingest_fir(file: UploadFile = File(...), case_id: str = Form(...)):
    suffix = os.path.splitext(file.filename)[1].lower()
    is_pdf = suffix == ".pdf"
    is_scanned = suffix in {".png", ".jpg", ".jpeg"}

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = parse_fir(tmp_path, is_pdf=is_pdf, is_scanned=is_scanned, case_id=case_id)
        append_entities(case_id, result["entities"])
        append_domain_entities(case_id, result["domain_entities"])
        return {"case_id": case_id, **result}
    finally:
        os.remove(tmp_path)


@router.post("/cctv")
async def ingest_cctv(file: UploadFile = File(...), case_id: str = Form(...)):
    suffix = os.path.splitext(file.filename)[1].lower()
    is_video = suffix in {".mp4", ".avi", ".mov"}

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        if is_video:
            result = parse_cctv_video(tmp_path, file.filename, case_id)
        else:
            result = parse_cctv_image(tmp_path, file.filename, case_id)
        return result
    finally:
        os.remove(tmp_path)