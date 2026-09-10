from app.graph.neo4j_client import create_entity_node, create_relationship

ENTITY_LABEL_MAP = {
    "PERSON": "Person",
    "ORG": "Organization",
    "GPE": "Location",
    "LOC": "Location",
}


def write_extracted_entities_to_graph(case_id: str, entities: list):
    written = []
    for entity in entities:
        label = entity.get("label")
        text = entity.get("text")
        entity_type = ENTITY_LABEL_MAP.get(label)

        if entity_type and text:
            create_entity_node(case_id, entity_type, text)
            written.append({"name": text, "type": entity_type})

    return written


def write_domain_entities_to_graph(case_id: str, domain_entities: dict):
    written = []

    for vehicle in domain_entities.get("vehicle_numbers", []):
        create_entity_node(case_id, "Vehicle", vehicle)
        written.append({"name": vehicle, "type": "Vehicle"})

    for phone in domain_entities.get("phone_numbers", []):
        create_entity_node(case_id, "Phone", phone)
        written.append({"name": phone, "type": "Phone"})

    for account in domain_entities.get("bank_accounts", []):
        create_entity_node(case_id, "BankAccount", account)
        written.append({"name": account, "type": "BankAccount"})

    return written


def write_relations_to_graph(case_id: str, relations: list):
    written = []
    for relation in relations:
        source = relation.get("source")
        target = relation.get("target")
        relation_type = relation.get("relation")

        if source and target and relation_type:
            create_relationship(case_id, source, target, relation_type)
            written.append({"source": source, "target": target, "relation": relation_type})

    return written


def write_cdr_to_graph(case_id: str, cdr_records: list):
    written_entities = set()
    written_relations = []

    for record in cdr_records:
        caller = record["caller"]
        receiver = record["receiver"]

        if caller not in written_entities:
            create_entity_node(case_id, "Phone", caller)
            written_entities.add(caller)

        if receiver not in written_entities:
            create_entity_node(case_id, "Phone", receiver)
            written_entities.add(receiver)

        create_relationship(case_id, caller, receiver, "CALLED")
        written_relations.append({"source": caller, "target": receiver, "relation": "CALLED"})

    return {
        "entities_written": list(written_entities),
        "relations_written": written_relations
    }


def write_transactions_to_graph(case_id: str, transaction_records: list):
    written_entities = set()
    written_relations = []

    for record in transaction_records:
        sender = record["sender"]
        receiver = record["receiver"]

        if sender not in written_entities:
            create_entity_node(case_id, "BankAccount", sender)
            written_entities.add(sender)

        if receiver not in written_entities:
            create_entity_node(case_id, "BankAccount", receiver)
            written_entities.add(receiver)

        create_relationship(case_id, sender, receiver, "TRANSFERRED")
        written_relations.append({"source": sender, "target": receiver, "relation": "TRANSFERRED"})

    return {
        "entities_written": list(written_entities),
        "relations_written": written_relations
    }