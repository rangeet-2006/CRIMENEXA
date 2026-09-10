// FastAPI AI Service API Client

export const AI_SERVICE_BASE_URL =
  import.meta.env.VITE_AI_SERVICE_BASE_URL ||
  "https://crimenexa-ai-service.onrender.com";

// ============================================================
// TYPES
// ============================================================

export type UploadCategory =
  | "FIR"
  | "Call Records"
  | "Bank Records"
  | "Social Media"
  | "Surveillance"
  | "Location"
  | "Forensic"
  | "Other";

export interface ExtractionResponse {
  filename?: string;
  document_category?: string;
  raw_text_preview?: string;
  raw_text?: string;
  entities?: unknown[];
  domain_entities?: unknown[];
  relations?: unknown[];
  graph_entities_written?: unknown[];
  graph_result?: unknown;
  [key: string]: unknown;
}

// ============================================================
// COMMON REQUEST HELPER
// ============================================================

async function aiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    isFormData?: boolean;
    isFormUrlEncoded?: boolean;
  } = {}
): Promise<T> {
  const {
    method = "POST",
    body,
    isFormData = false,
    isFormUrlEncoded = false,
  } = options;

  const url = `${AI_SERVICE_BASE_URL}${path}`;

  const headers: Record<string, string> = {};

  if (!isFormData && !isFormUrlEncoded) {
    headers["Content-Type"] = "application/json";
  } else if (isFormUrlEncoded) {
    headers["Content-Type"] =
      "application/x-www-form-urlencoded";
  }

  let requestBody: BodyInit | undefined;

  if (isFormData) {
    requestBody = body as FormData;
  } else if (isFormUrlEncoded) {
    requestBody = body as URLSearchParams;
  } else if (body !== undefined) {
    requestBody = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: requestBody,
  });

  if (!res.ok) {
    const errorText = await res.text();

    throw new Error(
      errorText ||
        `AI Service request failed with status ${res.status}`
    );
  }

  return (await res.json()) as T;
}

// ============================================================
// FILE TEXT HELPER
// ============================================================

export async function extractTextFromFile(
  file: File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      resolve((e.target?.result as string) || "");
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}

// ============================================================
// EXTRACTION APIs
// ============================================================

export function extractDocument(
  file: File,
  documentCategory: string,
  caseId?: string
): Promise<ExtractionResponse> {
  const form = new FormData();

  form.append("file", file);
  form.append("document_category", documentCategory);

  if (caseId) {
    form.append("case_id", caseId);
  }

  return aiRequest<ExtractionResponse>(
    "/api/extraction/extract",
    {
      isFormData: true,
      body: form,
    }
  );
}

export function extractRelations(
  text: string
): Promise<unknown> {
  return aiRequest(
    "/api/relation/extract-relations",
    {
      body: { text },
    }
  );
}

export function extractDomainEntities(
  text: string
): Promise<unknown> {
  return aiRequest(
    "/api/domain-entities/extract-domain-entities",
    {
      body: { text },
    }
  );
}

export function resolveEntities(
  entityA: string,
  entityB: string
): Promise<unknown> {
  return aiRequest(
    "/api/resolution/resolve",
    {
      body: {
        entity_a: entityA,
        entity_b: entityB,
      },
    }
  );
}

// ============================================================
// FILE INGESTION APIs
// ============================================================

export function ingestMultipart(
  endpoint:
    | "/api/ingestion/fir"
    | "/api/ingestion/cdr"
    | "/api/ingestion/location"
    | "/api/ingestion/transactions"
    | "/api/ingestion/cctv"
    | "/api/ingestion/forensic",
  file: File,
  caseId: string
): Promise<unknown> {
  const form = new FormData();

  form.append("file", file);
  form.append("case_id", caseId);

  return aiRequest(endpoint, {
    isFormData: true,
    body: form,
  });
}

export function ingestForensicFile(
  file: File,
  caseId: string
): Promise<unknown> {
  return ingestMultipart(
    "/api/ingestion/forensic",
    file,
    caseId
  );
}

// ============================================================
// WITNESS INGESTION
// ============================================================

export function ingestFormEncoded(
  text: string,
  caseId: string
): Promise<unknown> {
  const params = new URLSearchParams();

  params.append("case_id", caseId);
  params.append("text", text);

  return aiRequest(
    "/api/ingestion/witness",
    {
      isFormUrlEncoded: true,
      body: params,
    }
  );
}

// ============================================================
// SUSPECT RANKING
// ============================================================

export interface RankedSuspect {
  entity_id?: string;
  entity_name: string;
  priority_score: number;
  factors: {
    factor_name: string;
    weight: number;
    raw_value: number;
    contribution: number;
  }[];
  explanation: string;
}

export interface RankSuspectsResponse {
  case_id: string;
  total_persons_identified: number;
  ranked_suspects: RankedSuspect[];
}

export function rankSuspectsForCase(
  caseId: string,
  incidentLat?: number,
  incidentLon?: number
): Promise<RankSuspectsResponse> {
  return aiRequest<RankSuspectsResponse>(
    "/api/priority/rank-suspects-for-case",
    {
      body: {
        case_id: caseId,
        incident_lat: incidentLat,
        incident_lon: incidentLon,
      },
    }
  );
}

// ============================================================
// AI ASSISTANT
// ============================================================

export interface AssistantSource {
  source_id: string;
  source_type: string;
  excerpt: string;
}

export interface AssistantResponse {
  question: string;
  answer: string;
  sources: AssistantSource[];
}

export async function askAssistant(
  question: string,
  caseId: string,
  retrievedContext: AssistantSource[] = []
): Promise<AssistantResponse> {
  return aiRequest<AssistantResponse>(
    "/api/assistant/ask",
    {
      method: "POST",
      body: {
        question,
        case_id: caseId,
        retrieved_context: retrievedContext,
      },
    }
  );
}

// ============================================================
// CATEGORY MAPPING
// ============================================================

const CATEGORY_TO_API: Record<
  UploadCategory,
  string
> = {
  FIR: "FIR",
  "Call Records": "CALL_RECORDS",
  "Bank Records": "BANK_RECORDS",
  "Social Media": "SOCIAL_MEDIA",
  Surveillance: "SURVEILLANCE",
  Location: "LOCATION",
  Forensic: "FORENSIC",
  Other: "OTHER",
};

// ============================================================
// AUTOMATIC AI DATA NORMALIZATION
// ============================================================
function getRecordsFromIngestion(
  ingestion: unknown
): unknown[] {
  if (
    ingestion &&
    typeof ingestion === "object" &&
    Array.isArray(
      (ingestion as Record<string, unknown>).records
    )
  ) {
    return (
      (ingestion as Record<string, unknown>)
        .records as unknown[]
    );
  }

  return [];
}

function getLocationPointsFromIngestion(
  ingestion: unknown
): unknown[] {
  return getRecordsFromIngestion(ingestion);
}

function getTransactionRecordsFromIngestion(
  ingestion: unknown
): unknown[] {
  return getRecordsFromIngestion(ingestion);
}

function getCdrRecordsFromIngestion(
  ingestion: unknown
): unknown[] {
  return getRecordsFromIngestion(ingestion);
}

function getEntityArray(
  extraction: ExtractionResponse
): unknown[] {
  return Array.isArray(extraction.entities)
    ? extraction.entities
    : [];
}

function getDomainEntityArray(
  extraction: ExtractionResponse
): unknown[] {
  return Array.isArray(extraction.domain_entities)
    ? extraction.domain_entities
    : [];
}

function getRelationArray(
  extraction: ExtractionResponse
): unknown[] {
  return Array.isArray(extraction.relations)
    ? extraction.relations
    : [];
}

// ============================================================
// AUTOMATIC PRIMARY ENTITY SELECTION
// ============================================================
function findPrimaryEntity(
  extraction: ExtractionResponse
): {
  entityId: string;
  entityName: string;
} | null {
  const entities = getEntityArray(extraction);

  for (const rawEntity of entities) {
    if (
      !rawEntity ||
      typeof rawEntity !== "object"
    ) {
      continue;
    }

    const entity =
      rawEntity as Record<string, unknown>;

    const entityName =
      entity.name ??
      entity.entity_name ??
      entity.text ??
      entity.value;

    if (
      typeof entityName !== "string" ||
      !entityName.trim()
    ) {
      continue;
    }

    const entityId =
      entity.entity_id ??
      entity.id ??
      entityName;

    return {
      entityId: String(entityId),
      entityName: entityName.trim(),
    };
  }

  return null;
}

// ============================================================
// PROCESS UPLOADED FILE
// ============================================================

export interface ProcessUploadedFileResponse {
  category: UploadCategory;
  extraction: ExtractionResponse;
  ingestion?: unknown;

  analysis?: {
    anomalies?: unknown;
    crossVerification?: unknown;
    timeline?: unknown;
    timelineFromEvidence?: unknown;
    movementPlausibility?: unknown;
    graphEntities?: unknown[];
    graphRelationships?: unknown[];
    investigation?: unknown;
    rankedSuspects?: RankSuspectsResponse;
  };
}

export async function processUploadedFile(
  file: File,
  category: string,
  caseId: string
): Promise<ProcessUploadedFileResponse> {

  const normalizedCategory: UploadCategory =
    category in CATEGORY_TO_API
      ? (category as UploadCategory)
      : "Other";

// ==========================================================
// STEP 1 - OCR / NER / DOMAIN EXTRACTION
// ==========================================================

const extraction = await extractDocument(
  file,
  CATEGORY_TO_API[normalizedCategory],
  caseId
);

// ==========================================================
// STEP 2 - INGEST ORIGINAL FILE
// Backend expects multipart files for these endpoints.
// ==========================================================

let ingestion: unknown | undefined;

switch (normalizedCategory) {

  case "FIR":
    ingestion = await ingestMultipart(
      "/api/ingestion/fir",
      file,
      caseId
    );
    break;

  case "Call Records":
    ingestion = await ingestMultipart(
      "/api/ingestion/cdr",
      file,
      caseId
    );
    break;

  case "Bank Records":
    ingestion = await ingestMultipart(
      "/api/ingestion/transactions",
      file,
      caseId
    );
    break;

  case "Location":
    ingestion = await ingestMultipart(
      "/api/ingestion/location",
      file,
      caseId
    );
    break;

  case "Surveillance":
    ingestion = await ingestMultipart(
      "/api/ingestion/cctv",
      file,
      caseId
    );
    break;

  case "Forensic":
    ingestion = await ingestMultipart(
      "/api/ingestion/forensic",
      file,
      caseId
    );
    break;

  case "Social Media":
  case "Other":
    break;
}

// ==========================================================
// AUTOMATIC STRUCTURED DATA FOR DOWNSTREAM AI APIs
// ==========================================================

const cdrRecords =
  normalizedCategory === "Call Records"
    ? getCdrRecordsFromIngestion(ingestion)
    : [];

const locationPoints =
  normalizedCategory === "Location"
    ? getLocationPointsFromIngestion(ingestion)
    : [];

const transactionRecords =
  normalizedCategory === "Bank Records"
    ? getTransactionRecordsFromIngestion(ingestion)
    : [];

// ==========================================================
// STEP 3 - AUTOMATIC CASE ANALYSIS
// ==========================================================

const analysis:
  ProcessUploadedFileResponse["analysis"] = {};

// ==========================================================
// BANK RECORDS -> ANOMALY DETECTION
// ==========================================================

if (normalizedCategory === "Bank Records") {

  const transactionRecords =
    Array.isArray(
      (ingestion as any)?.records
    )
      ? (ingestion as any).records
      : [];

  const anomalyRecords: AnomalyRecord[] =
    transactionRecords
      .map((record: any, index: number) => {

        const date = record.transaction_time
          ? new Date(record.transaction_time)
          : null;

        return {
          id:
            record.id ??
            `TX-${index + 1}`,

          amount:
            Number(record.amount ?? 0),

          hour:
            date &&
            !Number.isNaN(date.getTime())
              ? date.getHours()
              : 0,

          sender: record.sender,
          receiver: record.receiver,
          transaction_time:
            record.transaction_time,
          transaction_type:
            record.transaction_type,
          account_number:
            record.account_number,
        };
      })
      .filter(
        (record: AnomalyRecord) =>
          Number.isFinite(record.amount)
      );

  if (anomalyRecords.length > 0) {
    try {
      analysis.anomalies =
        await detectAnomalies(
          caseId,
          anomalyRecords
        );
    } catch {
      // Optional analysis
    }
  }
}

// ==========================================================
// STEP 4 - CROSS VERIFICATION
// ==========================================================

try {
  analysis.crossVerification =
    await verifyCaseAutomatically(
      caseId
    );
} catch {
  // Optional analysis
}

// ==========================================================
// STEP 5 - TIMELINE
// ==========================================================

try {
  analysis.timeline =
    await buildTimeline(caseId);
} catch {
  // Optional analysis
}

// ==========================================================
// STEP 5B - TIMELINE FROM STRUCTURED EVIDENCE
// ==========================================================

try {
  analysis.timelineFromEvidence =
    await buildTimelineFromEvidence({
      case_id: caseId,
      cdr_records: cdrRecords,
      location_points: locationPoints,
      transaction_records: transactionRecords,
    });
} catch {
  // Optional analysis
}

// ==========================================================
// STEP 5C - MOVEMENT PLAUSIBILITY
// ==========================================================

if (locationPoints.length >= 2) {
  try {
    const first =
      locationPoints[0] as Record<string, unknown>;

    const second =
      locationPoints[1] as Record<string, unknown>;

    const lat1 = Number(first.latitude);
    const lon1 = Number(first.longitude);
    const lat2 = Number(second.latitude);
    const lon2 = Number(second.longitude);

    const time1 =
      first.timestamp ??
      first.time ??
      first.location_time;

    const time2 =
      second.timestamp ??
      second.time ??
      second.location_time;

    if (
      Number.isFinite(lat1) &&
      Number.isFinite(lon1) &&
      Number.isFinite(lat2) &&
      Number.isFinite(lon2) &&
      typeof time1 === "string" &&
      typeof time2 === "string"
    ) {
      analysis.movementPlausibility =
        await checkMovementPlausibility({
          lat1,
          lon1,
          time1,
          lat2,
          lon2,
          time2,
        });
    }
  } catch {
    // Optional analysis
  }
}

// ==========================================================
// STEP 5D - AUTOMATIC GRAPH ENTITY CREATION
// ==========================================================

try {
  const entities =
    getEntityArray(extraction);

  const graphEntities: unknown[] = [];

  for (const rawEntity of entities) {
    if (
      !rawEntity ||
      typeof rawEntity !== "object"
    ) {
      continue;
    }

    const entity =
      rawEntity as Record<string, unknown>;

    const entityName =
      entity.name ??
      entity.entity_name ??
      entity.text ??
      entity.value;

    if (
      typeof entityName !== "string" ||
      !entityName.trim()
    ) {
      continue;
    }

    const entityType =
      entity.type ??
      entity.entity_type ??
      "Person";

    try {
      const result = await addGraphEntity(
        caseId,
        {
          entity_type: String(entityType),
          entity_name: entityName.trim(),
        }
      );

      graphEntities.push(result);
    } catch {
      // Continue with other entities
    }
  }

  if (graphEntities.length > 0) {
    analysis.graphEntities =
      graphEntities;
  }
} catch {
  // Optional graph analysis
}

// ==========================================================
// STEP 5E - AUTOMATIC GRAPH RELATIONSHIPS
// ==========================================================

try {
  const relations =
    getRelationArray(extraction);

  const graphRelationships: unknown[] = [];

  for (const rawRelation of relations) {
    if (
      !rawRelation ||
      typeof rawRelation !== "object"
    ) {
      continue;
    }

    const relation =
      rawRelation as Record<string, unknown>;

    const source =
      relation.source_name ??
      relation.source ??
      relation.entity_a;

    const target =
      relation.target_name ??
      relation.target ??
      relation.entity_b;

    const relationshipType =
      relation.relationship_type ??
      relation.relation_type ??
      relation.type ??
      relation.relation;

    if (
      typeof source !== "string" ||
      typeof target !== "string" ||
      typeof relationshipType !== "string"
    ) {
      continue;
    }

    try {
      const result =
        await addGraphRelationship(
          caseId,
          {
            source_name: source,
            target_name: target,
            relationship_type:
              relationshipType,
          }
        );

      graphRelationships.push(result);
    } catch {
      // Continue with other relationships
    }
  }

  if (graphRelationships.length > 0) {
    analysis.graphRelationships =
      graphRelationships;
  }
} catch {
  // Optional graph analysis
}

// ==========================================================
// STEP 6 - AUTOMATIC SUSPECT RANKING
// ==========================================================

try {
  analysis.rankedSuspects =
    await rankSuspectsForCase(
      caseId
    );
} catch {
  // Optional analysis
}

// ==========================================================
// STEP 7 - INVESTIGATION ENGINE / ORCHESTRATOR
// ==========================================================

try {
  const rankedPrimary =
    analysis.rankedSuspects
      ?.ranked_suspects?.[0];

  const extractedPrimary =
    findPrimaryEntity(extraction);

  const primaryEntity =
    rankedPrimary
      ? {
          entityId:
            rankedPrimary.entity_id ??
            rankedPrimary.entity_name,

          entityName:
            rankedPrimary.entity_name,
        }
      : extractedPrimary;

  if (primaryEntity) {
    analysis.investigation =
      await runInvestigation({
        case_id: caseId,

        entity_id:
          primaryEntity.entityId,

        entity_name:
          primaryEntity.entityName,

        cdr_records:
          cdrRecords,

        location_points:
          locationPoints,

        transaction_records:
          transactionRecords,

        cross_verification_claims:
          [],

        entity_extraction_count:
          getEntityArray(extraction).length,

        domain_entity_count:
          getDomainEntityArray(extraction).length,

        forensic_findings:
          [],
      });
  }
} catch {
  // Optional investigation analysis
}

// ==========================================================
// RETURN RESULT
// ==========================================================

return {
  category: normalizedCategory,
  extraction,
  ingestion,
  analysis,
};
}

// ============================================================
// ANOMALY DETECTION
// ============================================================

export interface AnomalyRecord {
  id: string;
  amount: number;
  hour: number;
  [key: string]: unknown;
}

export interface AnomalyDetectResponse {
  [key: string]: unknown;
}

export function detectAnomalies(
  caseId: string,
  records: AnomalyRecord[]
): Promise<AnomalyDetectResponse> {
  return aiRequest<AnomalyDetectResponse>(
    "/api/anomaly/detect",
    {
      body: {
        case_id: caseId,
        records,
      },
    }
  );
}

// ============================================================
// MANUAL PRIORITY SCORE
// ============================================================

export interface PriorityFactorInputs {
  evidence_strength: number;
  communication_relevance: number;
  location_correlation: number;
  witness_corroboration: number;
  forensic_relevance: number;
  timeline_consistency: number;
  network_relevance: number;
}

export interface PriorityScoreResponse {
  case_id: string;
  entity_id: string;
  priority_score: number;
  factors: {
    factor_name: string;
    weight: number;
    raw_value: number;
    contribution: number;
  }[];
  explanation: string;
}

export function scorePriority(
  caseId: string,
  entityId: string,
  factorInputs: PriorityFactorInputs
): Promise<PriorityScoreResponse> {
  return aiRequest<PriorityScoreResponse>(
    "/api/priority/score",
    {
      body: {
        case_id: caseId,
        entity_id: entityId,
        factor_inputs: factorInputs,
      },
    }
  );
}

// ============================================================
// PRIORITY SCORE FROM EVIDENCE
// ============================================================

export interface ScoreFromEvidenceRequest {
  case_id: string;
  entity_id: string;
  entity_name: string;
  entity_extraction_count: number;
  domain_entity_count: number;
  forensic_findings: unknown[];
  cdr_analysis: unknown | null;
  location_points: unknown[];
  incident_lat?: number;
  incident_lon?: number;
  cross_verification_results: unknown[];
  timeline_events: unknown[];
  gaps_detected: unknown[];
  graph_connections: unknown[];
  transaction_records: unknown[];
}

export function scorePriorityFromEvidence(
  data: ScoreFromEvidenceRequest
): Promise<PriorityScoreResponse> {
  return aiRequest<PriorityScoreResponse>(
    "/api/priority/score-from-evidence",
    {
      body: data,
    }
  );
}

// ============================================================
// FULLY AUTOMATIC PRIORITY SCORE
// ============================================================

export function scorePriorityForCase(
  caseId: string,
  entityId: string,
  entityName: string,
  incidentLat?: number,
  incidentLon?: number
): Promise<PriorityScoreResponse> {
  return aiRequest<PriorityScoreResponse>(
    "/api/priority/score-for-case",
    {
      body: {
        case_id: caseId,
        entity_id: entityId,
        entity_name: entityName,
        incident_lat: incidentLat,
        incident_lon: incidentLon,
      },
    }
  );
}

// ============================================================
// AUTOMATIC SUSPECT DISCOVERY
// ============================================================

export function rankSuspectsAutomatically(
  caseId: string,
  incidentLat?: number,
  incidentLon?: number
): Promise<RankSuspectsResponse> {
  return rankSuspectsForCase(
    caseId,
    incidentLat,
    incidentLon
  );
}

// ============================================================
// CROSS VERIFICATION
// ============================================================

export interface CrossVerificationResponse {
  [key: string]: unknown;
}

export function verifyCaseAutomatically(
  caseId: string,
  manualClaims: unknown[] = []
): Promise<CrossVerificationResponse> {
  return aiRequest<CrossVerificationResponse>(
    "/api/cross-verification/verify-for-case",
    {
      body: {
        case_id: caseId,
        manual_claims: manualClaims,
      },
    }
  );
}

// ============================================================
// MANUAL / MODEL CROSS VERIFICATION
// ============================================================

export function verifyClaims(
  caseId: string,
  claims: unknown[]
): Promise<CrossVerificationResponse> {
  return aiRequest<CrossVerificationResponse>(
    "/api/cross-verification/verify",
    {
      body: {
        case_id: caseId,
        claims,
      },
    }
  );
}

// ============================================================
// TIMELINE
// ============================================================

export interface TimelineResponse {
  [key: string]: unknown;
}

export function buildTimeline(
  caseId?: string
): Promise<TimelineResponse> {
  // Specific case
  if (caseId) {
    return aiRequest<TimelineResponse>(
      "/api/timeline/build-for-case",
      {
        method: "POST",
        body: {
          case_id: caseId,
        },
      }
    );
  }

  // All cases
  return aiRequest<TimelineResponse>(
    "/api/timeline/build-all",
    {
      method: "GET",
    }
  );
}

// ============================================================
// TIMELINE - BUILD FROM STRUCTURED EVIDENCE
// ============================================================

export interface TimelineBuildRequest {
  case_id: string;
  cdr_records: unknown[];
  location_points: unknown[];
  transaction_records: unknown[];
}

export function buildTimelineFromEvidence(
  data: TimelineBuildRequest
): Promise<TimelineResponse> {
  return aiRequest<TimelineResponse>(
    "/api/timeline/build",
    {
      method: "POST",
      body: data,
    }
  );
}

// ============================================================
// GEO - MOVEMENT PLAUSIBILITY
// ============================================================

export interface MovementPlausibilityRequest {
  lat1: number;
  lon1: number;
  time1: string;
  lat2: number;
  lon2: number;
  time2: string;
}

export interface MovementPlausibilityResponse {
  [key: string]: unknown;
}

export function checkMovementPlausibility(
  data: MovementPlausibilityRequest
): Promise<MovementPlausibilityResponse> {
  return aiRequest<MovementPlausibilityResponse>(
    "/api/geo/movement-plausibility",
    {
      method: "POST",
      body: data,
    }
  );
}

// ============================================================
// GEO DISTANCE
// ============================================================

export interface GeoDistanceResponse {
  [key: string]: unknown;
}

export function calculateGeoDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<GeoDistanceResponse> {
  return aiRequest<GeoDistanceResponse>(
    "/api/geo/distance",
    {
      body: {
        lat1,
        lon1,
        lat2,
        lon2,
      },
    }
  );
}

// ============================================================
// GRAPH APIs
// ============================================================

export interface GraphResponse {
  [key: string]: unknown;
}

export interface GraphEntityRequest {
  entity_type: string;
  entity_name: string;
}

export interface GraphRelationshipRequest {
  source_name: string;
  target_name: string;
  relationship_type: string;
}

export function getCaseGraph(
  caseId?: string
): Promise<GraphResponse> {
  const path = caseId
    ? `/api/graph/${encodeURIComponent(caseId)}`
    : `/api/graph`;

  return aiRequest<GraphResponse>(path, {
    method: "GET",
  });
}

export function getCaseInfluencers(
  caseId?: string,
  limit = 5
): Promise<unknown> {
  const path = caseId
    ? `/api/graph/${encodeURIComponent(caseId)}/influencers?limit=${limit}`
    : `/api/graph/influencers?limit=${limit}`;

  return aiRequest(path, {
    method: "GET",
  });
}

export function addGraphEntity(
  caseId: string,
  data: GraphEntityRequest
): Promise<unknown> {
  const params = new URLSearchParams({
    entity_type: data.entity_type,
    entity_name: data.entity_name,
  });

  return aiRequest(
    `/api/graph/${encodeURIComponent(
      caseId
    )}/entity?${params.toString()}`,
    {
      method: "POST",
    }
  );
}

export function addGraphRelationship(
  caseId: string,
  data: GraphRelationshipRequest
): Promise<unknown> {
  const params = new URLSearchParams({
    source_name: data.source_name,
    target_name: data.target_name,
    relationship_type: data.relationship_type,
  });

  return aiRequest(
    `/api/graph/${encodeURIComponent(
      caseId
    )}/relationship?${params.toString()}`,
    {
      method: "POST",
    }
  );
}

// ============================================================
// INVESTIGATION ENGINE / ORCHESTRATOR
// ============================================================

export interface InvestigationRunRequest {
  case_id: string;
  entity_id: string;
  entity_name: string;
  cdr_records: unknown[];
  location_points: unknown[];
  transaction_records: unknown[];
  cross_verification_claims: unknown[];
  entity_extraction_count: number;
  domain_entity_count: number;
  forensic_findings: unknown[];
  incident_lat?: number;
  incident_lon?: number;
}

export interface InvestigationRunResponse {
  [key: string]: unknown;
}

export function runInvestigation(
  data: InvestigationRunRequest
): Promise<InvestigationRunResponse> {
  return aiRequest<InvestigationRunResponse>(
    "/api/investigation/run",
    {
      method: "POST",
      body: data,
    }
  );
}