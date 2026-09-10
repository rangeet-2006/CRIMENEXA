from fastapi import APIRouter, HTTPException

from app.graph.neo4j_client import get_case_graph, get_top_influencers, create_entity_node, create_relationship

router = APIRouter()


@router.get("/{case_id}")
async def get_graph(case_id: str):
    try:
        data = get_case_graph(case_id)
        return {"case_id": case_id, "graph": data}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/{case_id}/influencers")
async def get_influencers(case_id: str, limit: int = 5):
    try:
        data = get_top_influencers(case_id, limit=limit)
        return {"case_id": case_id, "influencers": data}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/{case_id}/entity")
async def add_entity(case_id: str, entity_type: str, entity_name: str):
    try:
        create_entity_node(case_id, entity_type, entity_name)
        return {"status": "created", "case_id": case_id, "entity_name": entity_name}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/{case_id}/relationship")
async def add_relationship(case_id: str, source_name: str, target_name: str, relation_type: str):
    try:
        create_relationship(case_id, source_name, target_name, relation_type)
        return {"status": "created", "source": source_name, "target": target_name}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))