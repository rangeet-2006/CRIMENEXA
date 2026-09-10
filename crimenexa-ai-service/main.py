import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    extraction, relation, domain_entities, resolution, anomaly, priority, assistant,
    ingestion, cross_verification, timeline, geo, graph, investigation
)

app = FastAPI(
    title="CRIMENEXA AI Service",
    description="AI/ML microservice for CRIMENEXA - Criminal Intelligence & Crime Analysis Platform",
    version="1.0.0"
)

# Browser origins allowed to call this service, comma-separated via
# CORS_ALLOWED_ORIGINS. Set it in the Render dashboard to add the deployed
# frontend's origin without editing code.
#
# An origin missing from this list is rejected by Starlette before any route
# runs: the preflight answers 400 "Disallowed CORS origin" and the response
# carries no access-control-allow-origin header. curl and Postman never show
# this, because only browsers enforce CORS - so a frontend can fail here while
# every command-line check passes.
#
# 8443 is this project's Vite dev port; 3000/5173 cover other local setups and
# 8080 is the backend's own port.
_DEFAULT_ORIGINS = (
    "http://localhost:8443,"
    "http://localhost:3000,"
    "http://localhost:5173,"
    "http://localhost:8080"
)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    # allow_credentials=True forbids a "*" origin per the CORS spec - Starlette
    # silently drops the header instead of echoing one, so keep this explicit.
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extraction.router, prefix="/api/extraction", tags=["Extraction"])
app.include_router(relation.router, prefix="/api/relation", tags=["Relation Extraction"])
app.include_router(domain_entities.router, prefix="/api/domain-entities", tags=["Domain Entities"])
app.include_router(resolution.router, prefix="/api/resolution", tags=["Entity Resolution"])
app.include_router(anomaly.router, prefix="/api/anomaly", tags=["Anomaly Detection"])
app.include_router(priority.router, prefix="/api/priority", tags=["Priority Scoring"])
app.include_router(assistant.router, prefix="/api/assistant", tags=["AI Assistant"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["Ingestion"])
app.include_router(cross_verification.router, prefix="/api/cross-verification", tags=["Cross Verification"])
app.include_router(timeline.router, prefix="/api/timeline", tags=["Timeline"])
app.include_router(geo.router, prefix="/api/geo", tags=["Geo Analysis"])
app.include_router(graph.router, prefix="/api/graph", tags=["Graph"])
app.include_router(investigation.router, prefix="/api/investigation", tags=["Investigation Engine"])


@app.get("/")
def root():
    return {"service": "CRIMENEXA AI Service", "status": "running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}