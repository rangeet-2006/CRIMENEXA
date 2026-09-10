// Typed client for the CRIMENEXA AI Service (FastAPI).
// Response shapes below were verified against the live service, not inferred
// from the spec - several endpoints return fields the OpenAPI schema omits.

import { AI_BASE_URL } from "./config";
import { jsonPost, request, uploadWithProgress } from "./http";

const url = (path: string) => `${AI_BASE_URL}${path}`;

// ─── Response types ───────────────────────────────────────────────────────────

export type GraphEdge = {
  source: string;
  source_type: string;
  relation: string;
  target: string;
  target_type: string;
};

export type GraphResponse = { case_id: string; graph: GraphEdge[] };

export type Influencer = { name: string; type: string; degree: number };

export type InfluencersResponse = { case_id: string; influencers: Influencer[] };

export type DomainEntities = {
  vehicle_numbers: string[];
  ipc_sections: string[];
  bank_accounts: string[];
  phone_numbers: string[];
  ifsc_codes: string[];
};

export type DistanceResponse = { distance_km: number };

export type MovementPlausibility = {
  distance_km: number;
  time_elapsed_minutes: number;
  required_speed_kmh: number;
  is_plausible: boolean;
  explanation: string;
};

/** The seven weighted factors the scorer expects. Any other key scores as absent. */
export type PriorityFactors = {
  evidence_strength: number;
  communication_relevance: number;
  location_correlation: number;
  witness_corroboration: number;
  forensic_relevance: number;
  timeline_consistency: number;
  network_relevance: number;
};

export type ScoredFactor = {
  factor_name: string;
  weight: number;
  raw_value: number;
  contribution: number;
};

export type PriorityScore = {
  case_id: string;
  entity_id: string;
  priority_score: number;
  factors: ScoredFactor[];
  explanation: string;
};

export type RankedSuspects = {
  case_id: string;
  total_persons_identified: number;
  ranked_suspects: RankedSuspect[];
};

export type TimelineEvent = {
  /** ISO-8601 without timezone, e.g. "2026-04-12T19:40:00". */
  timestamp: string;
  /** COMMUNICATION, LOCATION, TRANSACTION and so on - uppercase from the service. */
  event_type: string;
  description: string;
  entities_involved: string[];
};

export type TimelineResponse = {
  case_id: string;
  events: TimelineEvent[];
  gaps_detected: unknown[];
};

export type RankedSuspect = {
  entity_id?: string;
  entity_name: string;
  priority_score: number;
  factors: ScoredFactor[];
  explanation: string;
};

export type ManualClaim = {
  source_type: string;
  source_id: string;
  entity_name: string;
  latitude: number;
  longitude: number;
  /** ISO-8601 without timezone, e.g. "2026-04-12T21:30:00". */
  timestamp: string;
  excerpt: string;
};

export type RetrievedContext = {
  source_id: string;
  source_type: string;
  excerpt: string;
};

// ─── Health ───────────────────────────────────────────────────────────────────

export const health = () => request<{ status: string }>(url("/health"));

// ─── Text analysis ────────────────────────────────────────────────────────────

export const extractRelations = (text: string) =>
  jsonPost<{ relations: unknown[] }>(url("/api/relation/extract-relations"), { text });

export const extractDomainEntities = (text: string) =>
  jsonPost<DomainEntities>(url("/api/domain-entities/extract-domain-entities"), { text });

// ─── Analysis ─────────────────────────────────────────────────────────────────

export const detectAnomalies = (caseId: string, records: unknown[]) =>
  jsonPost<unknown>(url("/api/anomaly/detect"), { case_id: caseId, records });

/** Manual path - you supply all seven factor values yourself. */
export const scorePriority = (caseId: string, entityId: string, factorInputs: PriorityFactors) =>
  jsonPost<PriorityScore>(url("/api/priority/score"), {
    case_id: caseId,
    entity_id: entityId,
    factor_inputs: factorInputs,
  });

/**
 * Automatic path - pulls everything previously ingested for the case, so no
 * evidence has to be re-supplied. Prefer this over scorePriority once ingestion
 * has run for a case.
 */
export const scorePriorityForCase = (
  caseId: string,
  entityId: string,
  entityName: string,
  incident?: { lat: number; lon: number },
) =>
  jsonPost<PriorityScore>(url("/api/priority/score-for-case"), {
    case_id: caseId,
    entity_id: entityId,
    entity_name: entityName,
    incident_lat: incident?.lat,
    incident_lon: incident?.lon,
  });

/**
 * Automatic suspect discovery: scans all ingested evidence for unique person
 * names, scores each, returns them ranked highest first. This surfaces where
 * evidence concentrates for investigator review - it does not determine guilt.
 */
export const rankSuspectsForCase = (caseId: string, incident?: { lat: number; lon: number }) =>
  jsonPost<RankedSuspects>(url("/api/priority/rank-suspects-for-case"), {
    case_id: caseId,
    incident_lat: incident?.lat,
    incident_lon: incident?.lon,
  });

/**
 * Requires GEMINI_API_KEY to be configured on the AI service. That key is not
 * set on the deployed instance, so this currently answers 500 with a bare
 * "Internal Server Error" - a deployment config gap, not a payload problem.
 */
export const ask = (question: string, caseId: string, retrievedContext: RetrievedContext[] = []) =>
  jsonPost<unknown>(url("/api/assistant/ask"), {
    question,
    case_id: caseId,
    retrieved_context: retrievedContext,
  });

export const buildTimeline = (caseId: string, payload: Record<string, unknown> = {}) =>
  jsonPost<unknown>(url("/api/timeline/build"), { case_id: caseId, ...payload });

/** Automatic variant - pulls stored CDR, location and transaction data itself. */
export const buildTimelineForCase = (caseId: string) =>
  jsonPost<TimelineResponse>(url("/api/timeline/build-for-case"), { case_id: caseId });

// ─── Cross-verification ───────────────────────────────────────────────────────

export const verifyClaims = (caseId: string, claims: ManualClaim[]) =>
  jsonPost<unknown>(url("/api/cross-verification/verify"), { case_id: caseId, claims });

/**
 * Automatic variant - pulls stored GPS points as claims; manualClaims adds
 * witness-reported location/time on top. Stores its result for score-for-case.
 */
export const verifyForCase = (caseId: string, manualClaims: ManualClaim[] = []) =>
  jsonPost<unknown>(url("/api/cross-verification/verify-for-case"), {
    case_id: caseId,
    manual_claims: manualClaims,
  });

// ─── Geo ──────────────────────────────────────────────────────────────────────

export const geoDistance = (lat1: number, lon1: number, lat2: number, lon2: number) =>
  jsonPost<DistanceResponse>(url("/api/geo/distance"), { lat1, lon1, lat2, lon2 });

export const movementPlausibility = (p: {
  lat1: number;
  lon1: number;
  time1: string;
  lat2: number;
  lon2: number;
  time2: string;
}) => jsonPost<MovementPlausibility>(url("/api/geo/movement-plausibility"), p);

// ─── Graph ────────────────────────────────────────────────────────────────────

export const getGraph = (caseId: string) => request<GraphResponse>(url(`/api/graph/${encodeURIComponent(caseId)}`));

export const getInfluencers = (caseId: string, limit = 5) =>
  request<InfluencersResponse>(url(`/api/graph/${encodeURIComponent(caseId)}/influencers?limit=${limit}`));

// These two take their arguments as QUERY PARAMS, not a JSON body.
//
// IMPORTANT ordering rule, verified against the live service: addRelationship
// silently discards the edge unless BOTH endpoints were already registered with
// addEntity. It still answers 200 {"status":"created"} either way, so the write
// looks like it worked. Always add entities first, then relationships.
export const addEntity = (caseId: string, entityType: string, entityName: string) =>
  request<unknown>(
    url(
      `/api/graph/${encodeURIComponent(caseId)}/entity` +
        `?entity_type=${encodeURIComponent(entityType)}&entity_name=${encodeURIComponent(entityName)}`,
    ),
    { method: "POST" },
  );

export const addRelationship = (caseId: string, source: string, target: string, relation: string) =>
  request<unknown>(
    url(
      `/api/graph/${encodeURIComponent(caseId)}/relationship` +
        `?source_name=${encodeURIComponent(source)}&target_name=${encodeURIComponent(target)}` +
        `&relation_type=${encodeURIComponent(relation)}`,
    ),
    { method: "POST" },
  );

// ─── Ingestion (multipart) ────────────────────────────────────────────────────

export type FileIngestKind = "cdr" | "location" | "transactions" | "fir" | "cctv";

/**
 * Ingestion now stores into the case's evidence memory, and fir/cdr/transactions
 * additionally auto-write entities into the Neo4j graph. That matters for the
 * network view: the graph stays empty until something has been ingested for the
 * case, which is why useCaseGraph falls back to sample data.
 *
 * Accepted files: cdr/transactions .csv/.xlsx, location .csv/.json, cctv
 * image/video. Note cctv vision detection is currently DISABLED server-side -
 * it returns empty detections with a note, since YOLO was removed to fit the
 * free tier's RAM limit.
 */
export function ingestFile(kind: FileIngestKind, caseId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  form.append("case_id", caseId);
  return request<unknown>(url(`/api/ingestion/${kind}`), { method: "POST", body: form });
}

export function extractEntitiesFromFile(file: File, documentCategory: string, caseId?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("document_category", documentCategory);
  if (caseId) form.append("case_id", caseId);
  return request<unknown>(url("/api/extraction/extract"), { method: "POST", body: form });
}

// ─── Upload UI support ────────────────────────────────────────────────────────

export type IngestKind = "fir" | "cdr" | "transactions" | "location" | "cctv";

/**
 * Maps the Upload page's category buttons onto ingestion endpoints.
 * null means the category has no endpoint on the AI service - the UI must
 * refuse the upload rather than silently pretend it worked.
 */
export const CATEGORY_ENDPOINTS: Record<string, IngestKind | null> = {
  FIR: "fir",
  "Call Records": "cdr",
  "Bank Records": "transactions",
  "Location / GPS": "location",
  Surveillance: "cctv",
  "Social Media": null,
  Other: null,
};

/** File types each endpoint actually accepts, for the input's accept attribute. */
export const CATEGORY_ACCEPT: Record<string, string> = {
  FIR: ".pdf,.txt,.docx",
  "Call Records": ".csv,.xlsx",
  "Bank Records": ".csv,.xlsx",
  "Location / GPS": ".csv,.json",
  Surveillance: ".jpg,.jpeg,.png,.mp4",
  "Social Media": "",
  Other: "",
};

export type IngestResult = {
  case_id?: string;
  total_records?: number;
  total_points?: number;
  records?: unknown[];
  points?: unknown[];
  entities?: unknown[];
  findings?: unknown[];
  detections?: unknown[];
  note?: string;
};

/** Each endpoint reports its haul under a different key - normalise to one line. */
export function summariseIngest(kind: IngestKind, r: IngestResult): string {
  if (typeof r?.total_records === "number") return `${r.total_records} record(s) ingested`;
  if (typeof r?.total_points === "number") return `${r.total_points} location point(s) ingested`;
  if (Array.isArray(r?.entities)) return `${r.entities.length} entit${r.entities.length === 1 ? "y" : "ies"} extracted`;
  if (Array.isArray(r?.findings)) return `${r.findings.length} finding(s) extracted`;
  if (kind === "cctv") return r?.note ? String(r.note) : "Uploaded (vision detection is disabled server-side)";
  return "Uploaded";
}

export function ingestWithProgress(
  kind: IngestKind,
  caseId: string,
  file: File,
  onProgress?: (percent: number) => void,
) {
  const form = new FormData();
  form.append("file", file);
  form.append("case_id", caseId);
  return uploadWithProgress<IngestResult>(url(`/api/ingestion/${kind}`), form, onProgress);
}

// Witness and forensic take form-urlencoded text, not a file.
export function ingestText(kind: "witness" | "forensic", caseId: string, text: string) {
  const body = new URLSearchParams({ text, case_id: caseId });
  return request<unknown>(url(`/api/ingestion/${kind}`), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

// ─── Known-broken ─────────────────────────────────────────────────────────────

/**
 * DO NOT CALL until the service is fixed. A single request kills the uvicorn
 * worker: /health returns 200 before and 502 after, and Render needs 1-2
 * minutes to restart. Almost certainly an OOM loading an embedding model on
 * the 512MB free tier. Left here so the surface is complete.
 */
export const resolveEntities = (entityA: string, entityB: string) =>
  jsonPost<unknown>(url("/api/resolution/resolve"), { entity_a: entityA, entity_b: entityB });
