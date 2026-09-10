"""
Accumulated evidence per case.

This used to be a bare module-level dict, which meant every restart wiped it.
On a host that sleeps idle instances that is not an edge case - it happens
several times a day - and it produced a confusing half-state: the Neo4j graph
still held the entities, so the network view looked populated, while every
"-for-case" endpoint reported an empty case because their input had vanished.

The dict is now a write-through cache over a per-case JSON document in Neo4j.
The public API is unchanged: callers still mutate the dict returned by
get_case_evidence(), and each append_/set_ helper persists afterwards.

If Neo4j is unconfigured or unreachable the store degrades to memory-only -
the previous behaviour - rather than failing the request, because ingestion
that cannot persist is still more useful than ingestion that 500s.
"""

import json
import logging

from app.graph.neo4j_client import load_case_evidence, save_case_evidence

logger = logging.getLogger(__name__)

# case_id -> evidence dict. Write-through cache, not the source of truth.
_case_evidence = {}


def _empty_evidence() -> dict:
    return {
        "entities": [],
        "domain_entities": {
            "vehicle_numbers": [],
            "ipc_sections": [],
            "bank_accounts": [],
            "phone_numbers": [],
            "ifsc_codes": []
        },
        "cdr_records": [],
        "location_points": [],
        "transaction_records": [],
        "forensic_findings": [],
        "witness_statements": [],
        "cross_verification_results": [],
        "timeline_events": [],
        "gaps_detected": [],
    }


def _merge_onto_empty(stored: dict) -> dict:
    """
    Overlay a stored payload onto the current empty shape.

    Readers index buckets directly (evidence["cdr_records"]), so a payload
    written before a bucket existed must not produce a KeyError. Merging onto
    the current shape means old documents stay readable as the shape grows.
    """
    base = _empty_evidence()
    for key, default in base.items():
        value = stored.get(key)
        if value is None:
            continue
        if isinstance(default, dict) and isinstance(value, dict):
            for sub_key in default:
                if isinstance(value.get(sub_key), list):
                    default[sub_key] = value[sub_key]
        elif isinstance(default, list) and isinstance(value, list):
            base[key] = value
    return base


def _hydrate(case_id: str) -> dict:
    try:
        raw = load_case_evidence(case_id)
    except Exception as exc:
        # RuntimeError when credentials are absent, driver errors otherwise.
        logger.warning("Could not load evidence for case %s: %s", case_id, exc)
        return _empty_evidence()

    if not raw:
        return _empty_evidence()

    try:
        stored = json.loads(raw)
    except (ValueError, TypeError) as exc:
        logger.warning("Stored evidence for case %s is not valid JSON: %s", case_id, exc)
        return _empty_evidence()

    if not isinstance(stored, dict):
        return _empty_evidence()

    return _merge_onto_empty(stored)


def _persist(case_id: str) -> None:
    store = _case_evidence.get(case_id)
    if store is None:
        return
    try:
        # default=str so a stray date or Decimal from a parser cannot make the
        # whole payload unserialisable.
        save_case_evidence(case_id, json.dumps(store, default=str))
    except Exception as exc:
        logger.warning("Could not persist evidence for case %s: %s", case_id, exc)


def get_case_evidence(case_id: str) -> dict:
    if case_id not in _case_evidence:
        _case_evidence[case_id] = _hydrate(case_id)
    return _case_evidence[case_id]


def append_entities(case_id: str, entities: list):
    get_case_evidence(case_id)["entities"].extend(entities)
    _persist(case_id)


def append_domain_entities(case_id: str, domain_entities: dict):
    store = get_case_evidence(case_id)
    for key in store["domain_entities"]:
        store["domain_entities"][key] = list(
            set(store["domain_entities"][key] + domain_entities.get(key, []))
        )
    _persist(case_id)


def append_cdr_records(case_id: str, records: list):
    get_case_evidence(case_id)["cdr_records"].extend(records)
    _persist(case_id)


def append_location_points(case_id: str, points: list):
    get_case_evidence(case_id)["location_points"].extend(points)
    _persist(case_id)


def append_transaction_records(case_id: str, records: list):
    get_case_evidence(case_id)["transaction_records"].extend(records)
    _persist(case_id)


def append_forensic_findings(case_id: str, findings: list):
    get_case_evidence(case_id)["forensic_findings"].extend(findings)
    _persist(case_id)


def append_witness_statement(case_id: str, statement: dict):
    get_case_evidence(case_id)["witness_statements"].append(statement)
    _persist(case_id)


def set_cross_verification_results(case_id: str, results: list):
    get_case_evidence(case_id)["cross_verification_results"] = results
    _persist(case_id)


def set_timeline(case_id: str, events: list, gaps: list):
    store = get_case_evidence(case_id)
    store["timeline_events"] = events
    store["gaps_detected"] = gaps
    _persist(case_id)


def evidence_counts(case_id: str) -> dict:
    """
    Summary of what is stored for a case.

    Exposed so the backend can report an entity count without pulling the whole
    payload across the wire.
    """
    store = get_case_evidence(case_id)
    return {
        "entities": len(store["entities"]),
        "domain_entities": sum(len(v) for v in store["domain_entities"].values()),
        "cdr_records": len(store["cdr_records"]),
        "location_points": len(store["location_points"]),
        "transaction_records": len(store["transaction_records"]),
        "forensic_findings": len(store["forensic_findings"]),
        "witness_statements": len(store["witness_statements"]),
        "timeline_events": len(store["timeline_events"]),
    }
