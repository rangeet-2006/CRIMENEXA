// Client for the CRIMENEXA backend (Spring Boot + Spring Security, JWT).
//
// Every route except signup, login and verify-otp answers 403 without a Bearer
// token - confirmed against the live service.
//
// Authentication is a TWO-STEP flow, which matches the login screen's existing
// badge/password then OTP steps:
//
//   1. POST /api/auth/login      -> { tempToken, otpSentTo }   (emails an OTP)
//   2. POST /api/auth/verify-otp -> { accessToken, refreshToken, user }
//
// The token to send as `Authorization: Bearer` is the accessToken from step 2.
// Step 1 alone does NOT authenticate you.

import { BACKEND_BASE_URL } from "./config";
import { ApiError, jsonPost, request, uploadWithProgress } from "./http";

const url = (path: string) => `${BACKEND_BASE_URL}${path}`;

const ACCESS_KEY = "crimenexa.accessToken";
const REFRESH_KEY = "crimenexa.refreshToken";

// ─── Types ────────────────────────────────────────────────────────────────────

/** The only values the backend accepts. accessLevel at login must match signup. */
export type Role = "ADMIN" | "SENIOR" | "FIELD";

export type User = {
  id: string;
  badgeId: string;
  fullName: string;
  email: string;
  role: Role;
  lastLogin: string;
};

/** Step 1 of login. Not a session - the OTP still has to be verified. */
export type LoginChallenge = { tempToken: string; otpSentTo: string };

export type AuthSession = { accessToken: string; refreshToken: string; user: User };

export type DashboardSummary = {
  activeCases: number;
  totalEntities: number;
  openAlerts: number;
  criticalAlerts: number;
  reportsGenerated: number;
};

export type CaseStatusFilter = "ALL" | "ACTIVE" | "CLOSED";
export type AlertSeverity = "CRITICAL" | "HIGH" | "WARNING" | "INFO" | "ALL";
export type ReportType = "FULL_REPORT" | "GRAPH_EXPORT" | "FINANCIAL";

export type DocumentCategory =
  | "FIR"
  | "CALL_RECORDS"
  | "BANK_RECORDS"
  | "LOCATION"
  | "FORENSIC"
  | "SOCIAL_MEDIA"
  | "SURVEILLANCE"
  | "OTHER";

// Mirrors Evidence.DocumentCategory / CaseRecord.Priority / Alert.Severity etc.
// in crimenexa-backend. Kept in sync by hand - there is no generated client.
export type CaseStatus = "ACTIVE" | "CLOSED";
export type CasePriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/**
 * CaseResponse from the backend.
 *
 * `id` is a UUID and is what every other endpoint expects as `caseId`
 * (uploads, reports, graph, status changes). `caseCode` is the human-facing
 * "CAS-2024-0045" string and is display-only - passing it where a caseId is
 * wanted fails Spring's UUID conversion with a 400.
 */
export type CaseRecord = {
  id: string;
  caseCode: string;
  operationName: string;
  status: CaseStatus;
  officerName: string;
  entitiesCount: number;
  priority: CasePriority;
  /** ISO date, e.g. "2026-09-06". */
  openedDate: string;
};

export type AlertRecord = {
  id: string;
  /** Case code, not the case UUID - alerts cannot be filtered by case server-side. */
  caseCode: string;
  severity: Exclude<AlertSeverity, "ALL">;
  category: string;
  title: string;
  description: string;
  acknowledged: boolean;
  /** ISO-8601 instant. */
  createdAt: string;
};

export type ReportRecord = {
  id: string;
  title: string;
  caseCode: string;
  type: ReportType;
  pages: number;
  generatedAt: string;
  downloadUrl: string;
};

/** Evidence entity returned by POST /api/ingest/upload (a JPA entity, not a DTO). */
export type EvidenceRecord = {
  id: string;
  caseId: string;
  fileName: string;
  documentCategory: DocumentCategory;
  filePath: string;
  fileHash: string;
  uploadedBy: string;
  /** Always QUEUED on return - AI processing runs asynchronously afterwards. */
  status: "QUEUED" | "PROCESSING" | "EXTRACTED" | "FAILED";
};

/** Maps the login screen's role labels onto the backend's role values. */
export const ACCESS_LEVELS: Record<string, Role> = {
  Admin: "ADMIN",
  "Senior Investigator": "SENIOR",
  "Field Officer": "FIELD",
};

// ─── Token storage ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function setSession(accessToken: string | null, refreshToken?: string | null): void {
  try {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    else localStorage.removeItem(ACCESS_KEY);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    else if (refreshToken === null) localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Private browsing or blocked storage - the session just won't persist.
  }
}

export function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Authenticated GET/DELETE/etc against the backend. */
function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(url(path), {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}

function authedJson<T>(path: string, payload: unknown, method = "POST"): Promise<T> {
  return request<T>(url(path), {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function signup(payload: {
  fullName: string;
  email: string;
  badgeId: string;
  password: string;
  role: Role;
}): Promise<User> {
  return jsonPost<User>(url("/api/auth/signup"), payload);
}

/**
 * Step 1: verifies the badge and password, then emails an OTP (via Brevo).
 * Returns a short-lived tempToken to hand to verifyOtp - NOT a session token.
 * `accessLevel` must exactly match the role the account was created with.
 */
export function login(badgeId: string, password: string, accessLevel: Role | string): Promise<LoginChallenge> {
  return jsonPost<LoginChallenge>(url("/api/auth/login"), {
    badgeId,
    password,
    accessLevel: ACCESS_LEVELS[accessLevel] ?? accessLevel,
  });
}

/** Step 2: exchanges the OTP for a real session, and stores the tokens. */
export async function verifyOtp(tempToken: string, otp: string): Promise<AuthSession> {
  const session = await jsonPost<AuthSession>(url("/api/auth/verify-otp"), { tempToken, otp });
  if (session?.accessToken) setSession(session.accessToken, session.refreshToken ?? null);
  return session;
}

/** Clears the local session even if the server call fails - logout must not strand the user. */
export async function logout(): Promise<void> {
  try {
    await authedJson<unknown>("/api/auth/logout", {});
  } catch {
    // Expired or already-invalid token; local state is what matters here.
  } finally {
    setSession(null, null);
  }
}

// ─── User ─────────────────────────────────────────────────────────────────────

export const getMe = () => authed<User>("/api/users/me");

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getDashboardSummary = () => authed<DashboardSummary>("/api/dashboard/summary");

// ─── Cases ────────────────────────────────────────────────────────────────────

export function listCases(status: CaseStatusFilter = "ALL", search = ""): Promise<CaseRecord[]> {
  const q = new URLSearchParams({ status });
  if (search) q.set("search", search);
  return authed<CaseRecord[]>(`/api/cases?${q}`);
}

/** Requires ADMIN or SENIOR. openedDate is a plain date: "2026-09-06". */
export function createCase(payload: {
  operationName: string;
  priority: string;
  openedDate: string;
}): Promise<CaseRecord> {
  return authedJson<CaseRecord>("/api/cases", payload);
}

/** Requires ADMIN or SENIOR. Status travels as a query param, not a body. */
export function updateCaseStatus(caseId: string, status: "ACTIVE" | "CLOSED"): Promise<CaseRecord> {
  return authed<CaseRecord>(`/api/cases/${encodeURIComponent(caseId)}/status?status=${status}`, {
    method: "PATCH",
  });
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Backend-mediated evidence upload. Saves the file, then asynchronously triggers
 * AI service processing - so unlike posting to the AI service directly, the
 * response returns before analysis has finished.
 *
 * Note the field names are camelCase here (documentCategory, caseId), where the
 * AI service uses snake_case (document_category, case_id).
 */
export function uploadEvidence(
  file: File,
  documentCategory: DocumentCategory,
  caseId: string,
  onProgress?: (percent: number) => void,
): Promise<EvidenceRecord> {
  const form = new FormData();
  form.append("file", file);
  form.append("documentCategory", documentCategory);
  // Must be the case UUID (CaseRecord.id), not the caseCode - the endpoint
  // declares UUID and a code like "CAS-2024-0045" fails conversion with a 400.
  form.append("caseId", caseId);
  return uploadWithProgress<EvidenceRecord>(url("/api/ingest/upload"), form, onProgress, authHeaders());
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export type EvidenceStatus = "QUEUED" | "PROCESSING" | "EXTRACTED" | "FAILED";

export type EvidenceStatusRecord = {
  id: string;
  caseId: string;
  fileName: string;
  documentCategory: DocumentCategory;
  fileHash: string;
  status: EvidenceStatus;
  uploadedAt: string;
  /** Populated only when status is FAILED. */
  processingError?: string | null;
};

export const getEvidenceForCase = (caseId: string) =>
  authed<EvidenceStatusRecord[]>(`/api/evidence/case/${encodeURIComponent(caseId)}`);

export const getEvidence = (evidenceId: string) =>
  authed<EvidenceStatusRecord>(`/api/evidence/${encodeURIComponent(evidenceId)}`);

/**
 * Poll one evidence record until processing settles.
 *
 * The upload response returns while the AI call is still in flight, so it can
 * only confirm storage. Without polling, a failure afterwards left a green tick
 * on screen and the reason in a server log the user cannot read.
 *
 * Resolves on EXTRACTED or FAILED, or returns the last status seen if it is
 * still running when the attempts run out.
 */
export async function pollEvidenceStatus(
  evidenceId: string,
  onUpdate?: (record: EvidenceStatusRecord) => void,
  onUnavailable?: (reason: string) => void,
  attempts = 10,
  intervalMs = 3000,
): Promise<EvidenceStatusRecord | null> {
  let last: EvidenceStatusRecord | null = null;
  let consecutiveFailures = 0;

  for (let i = 0; i < attempts; i++) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    try {
      last = await getEvidence(evidenceId);
      consecutiveFailures = 0;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;

      // 404 means the endpoint or the record is not there. Retrying cannot
      // change that, and hammering it 10 times per file just fills the network
      // log with what looks like a server fault.
      if (status === 404) {
        onUnavailable?.("Status tracking is unavailable on this server (endpoint not found).");
        return null;
      }

      // Anything else might be transient - a cold start, a dropped connection -
      // but give up after two in a row rather than retrying to the limit.
      consecutiveFailures++;
      if (consecutiveFailures >= 2) {
        onUnavailable?.(
          err instanceof Error
            ? `Could not read processing status: ${err.message}`
            : "Could not read processing status.",
        );
        return null;
      }
      continue;
    }

    onUpdate?.(last);
    if (last.status === "EXTRACTED" || last.status === "FAILED") return last;
  }
  return last;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const listAlerts = (severity: AlertSeverity = "ALL") =>
  authed<AlertRecord[]>(`/api/alerts?severity=${severity}`);

/** Requires ADMIN or SENIOR. */
export const acknowledgeAlert = (alertId: string) =>
  authed<AlertRecord>(`/api/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: "PATCH" });

// ─── Reports ──────────────────────────────────────────────────────────────────

export const getReports = (caseId: string) =>
  authed<ReportRecord[]>(`/api/reports/${encodeURIComponent(caseId)}`);

/** Requires ADMIN or SENIOR. */
export const generateReport = (caseId: string, reportType: ReportType) =>
  authedJson<ReportRecord>("/api/reports/generate", { caseId, reportType });

// ─── Graph (backend proxies these to the AI service) ──────────────────────────
//
// These mirror the AI service's graph endpoints but require a Bearer token.
// Routing graph traffic through the backend means only ONE service's CORS
// allowlist needs the frontend's origin - see CORS.md.

export const getGraphViaBackend = (caseId: string) =>
  authed<{ case_id: string; graph: unknown[] }>(`/api/graph/${encodeURIComponent(caseId)}`);

export const getInfluencersViaBackend = (caseId: string) =>
  authed<{ case_id: string; influencers: unknown[] }>(
    `/api/graph/${encodeURIComponent(caseId)}/influencers`,
  );
