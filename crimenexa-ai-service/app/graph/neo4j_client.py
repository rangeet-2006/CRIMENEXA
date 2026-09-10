import os
from neo4j import GraphDatabase

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        uri = os.getenv("NEO4J_URI")
        username = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")
        if not all([uri, username, password]):
            raise RuntimeError("Neo4j credentials not configured. Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD.")
        _driver = GraphDatabase.driver(uri, auth=(username, password))
    return _driver


def close_driver():
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def create_entity_node(case_id: str, entity_type: str, entity_name: str):
    driver = get_driver()
    query = (
        "MERGE (e:Entity {name: $entity_name, case_id: $case_id}) "
        "SET e.type = $entity_type "
        "RETURN e"
    )
    with driver.session() as session:
        session.run(query, entity_name=entity_name, case_id=case_id, entity_type=entity_type)


def create_relationship(case_id: str, source_name: str, target_name: str, relation_type: str):
    driver = get_driver()
    query = (
        "MATCH (a:Entity {name: $source_name, case_id: $case_id}) "
        "MATCH (b:Entity {name: $target_name, case_id: $case_id}) "
        "MERGE (a)-[r:RELATION {type: $relation_type}]->(b) "
        "RETURN r"
    )
    with driver.session() as session:
        session.run(query, source_name=source_name, target_name=target_name,
                     case_id=case_id, relation_type=relation_type)


def get_case_graph(case_id: str):
    driver = get_driver()
    query = (
        "MATCH (a:Entity {case_id: $case_id})-[r:RELATION]->(b:Entity {case_id: $case_id}) "
        "RETURN a.name AS source, a.type AS source_type, "
        "r.type AS relation, b.name AS target, b.type AS target_type"
    )
    with driver.session() as session:
        result = session.run(query, case_id=case_id)
        return [dict(record) for record in result]


def save_case_evidence(case_id: str, payload: str):
    """
    Persist a case's accumulated evidence as a JSON payload on a single node.

    This is deliberately not modelled as a graph - it is a document keyed by
    case, and the alternative was losing it entirely on every restart. The
    entity relationships that DO belong in a graph are stored separately as
    :Entity nodes by create_entity_node / create_relationship.
    """
    driver = get_driver()
    query = (
        "MERGE (e:CaseEvidence {case_id: $case_id}) "
        "SET e.payload = $payload, e.updated_at = datetime() "
        "RETURN e.case_id AS case_id"
    )
    with driver.session() as session:
        session.run(query, case_id=case_id, payload=payload)


def load_case_evidence(case_id: str):
    """Return the stored JSON payload for a case, or None if nothing is stored."""
    driver = get_driver()
    query = "MATCH (e:CaseEvidence {case_id: $case_id}) RETURN e.payload AS payload"
    with driver.session() as session:
        record = session.run(query, case_id=case_id).single()
        return record["payload"] if record else None


def get_top_influencers(case_id: str, limit: int = 5):
    driver = get_driver()
    query = (
        "MATCH (e:Entity {case_id: $case_id})-[r:RELATION]-() "
        "RETURN e.name AS name, e.type AS type, count(r) AS degree "
        "ORDER BY degree DESC LIMIT $limit"
    )
    with driver.session() as session:
        result = session.run(query, case_id=case_id, limit=limit)
        return [dict(record) for record in result]