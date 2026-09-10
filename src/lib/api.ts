// ─── CrimeNexa Backend API client (Spring Boot) ────────────────────────────
// Everything here talks to BACKEND_BASE_URL and requires a Bearer token
// except the three /api/auth/* endpoints. For the AI service (FastAPI,
// no auth, different base URL) see ./aiApi.ts instead.

export const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL || "https://crimenexa-backend.onrender.com";

// ─── Token storage ──────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY = "crimenexa.accessToken";
const REFRESH_TOKEN_KEY = "crimenexa.refreshToken";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
export function hasSession(): boolean {
  return !!getAccessToken();
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function setTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─── Types ──────────────────────────────────────────────────────────────────
// NOTE: the doc doesn't spell out the exact string values the backend uses
// for "role" / "accessLevel" (e.g. whether it's "ADMIN" or "Admin"). We pass
// through whatever the UI already uses today (see App.tsx ROLE MAPPING
// comments) — adjust here in one place if the backend expects something else.
export type ApiRole = string;

export interface ApiUser {
  id: string;
  badgeId: string;
  fullName: string;
  email: string;
  role: ApiRole;
  lastLogin?: string;
}

export interface LoginResponse {
  tempToken: string;
  otpSentTo: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

export interface DashboardSummary {
  activeCases: number;
  totalEntities: number;
  openAlerts: number;
  criticalAlerts: number;
  reportsGenerated: number;
}

// The doc confirms the POST /api/cases body shape and that GET /api/cases
// takes optional status/search query params, but not every field the list
// response includes. Treat anything beyond id/operationName/status/priority/
// openedDate as best-effort/optional until confirmed against the real API.
export interface ApiCase {
  id: string;
  operationName: string;
  status: string;
  priority: string;
  openedDate: string;
  officerId?: string;
  officerName?: string;
  entities?: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ─── Low-level request helper ───────────────────────────────────────────────
async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: boolean;
    isFormData?: boolean;
    query?: Record<string, string | undefined>;
  } = {}
): Promise<T> {
  const { method = "GET", body, auth = true, isFormData = false, query } = options;

  let url = `${BACKEND_BASE_URL}${path}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, v);
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      message = errBody?.message || message;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ─── Auth ───────────────────────────────────────────────────────────────────
export function signup(data: {
  fullName: string;
  email: string;
  badgeId: string;
  password: string;
  role: string;
}) {
  // Per the doc's example response, this returns the created user — no
  // accessToken/refreshToken. The frontend gets a real session by calling
  // login() + verifyOtp() right after this with the same credentials
  // (see SignupPage.handleSubmit in App.tsx).
  return request<ApiUser>("/api/auth/signup", { method: "POST", body: data, auth: false });
}

export function login(data: { accessLevel: string; badgeId: string; password: string }) {
  return request<LoginResponse>("/api/auth/login", { method: "POST", body: data, auth: false });
}

export function verifyOtp(data: { tempToken: string; otp: string }) {
  return request<VerifyOtpResponse>("/api/auth/verify-otp", { method: "POST", body: data, auth: false });
}

export function apiLogout() {
  return request<void>("/api/auth/logout", { method: "POST" });
}

export function getMe() {
  return request<ApiUser>("/api/users/me");
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
export function getDashboardSummary() {
  return request<DashboardSummary>("/api/dashboard/summary");
}

// ─── Cases ──────────────────────────────────────────────────────────────────
export function getCases(params: { status?: string; search?: string } = {}) {
  return request<ApiCase[]>("/api/cases", {
    query: { status: params.status ?? "ALL", search: params.search ?? "" },
  });
}

export function createCase(data: { operationName: string; priority: string; openedDate: string }) {
  return request<ApiCase>("/api/cases", { method: "POST", body: data });
}

export function updateCaseStatus(caseId: string, status: string) {
  return request<void>(`/api/cases/${caseId}/status`, { method: "PATCH", query: { status } });
}

// ─── Upload ─────────────────────────────────────────────────────────────────
export function uploadDocument(data: { file: File; documentCategory: string; caseId: string }) {
  const form = new FormData();
  form.append("file", data.file);
  form.append("documentCategory", data.documentCategory);
  form.append("caseId", data.caseId);
  return request<void>("/api/ingest/upload", { method: "POST", body: form, isFormData: true });
}

// ─── Alerts ─────────────────────────────────────────────────────────────────
// Confirmed against the backend's AlertResponse.java / AlertService.java
// toResponse() mapping.
export interface ApiAlert {
  id: string;
  caseCode: string;
  severity: string;
  category: string;
  title: string;
  description?: string;
  acknowledged: boolean;
  createdAt: string;
}

export function getAlerts(severity: string = "ALL") {
  return request<ApiAlert[]>("/api/alerts", { query: { severity } });
}

export function acknowledgeAlert(alertId: string) {
  return request<ApiAlert>(`/api/alerts/${alertId}/acknowledge`, { method: "PATCH" });
}

// ─── Reports ────────────────────────────────────────────────────────────────
// Confirmed against the backend's ReportResponse.java.
// NOTE: downloadUrl points to /api/reports/download/{id}, which does not
// exist yet server-side — generateReport() currently only stores a
// placeholder path. Any UI download action against this URL will 404 until
// that endpoint + real PDF generation is built.
export type ReportType = "FULL_REPORT" | "GRAPH_EXPORT" | "FINANCIAL";

export interface ApiReport {
  id: string;
  title: string;
  caseCode: string;
  type: string;
  pages: number;
  generatedAt: string;
  downloadUrl: string;
}

export function getReports(caseId: string) {
  return request<ApiReport[]>(`/api/reports/${caseId}`);
}

export function generateReport(data: { caseId: string; reportType: ReportType }) {
  return request<ApiReport>("/api/reports/generate", { method: "POST", body: data });
}

// ─── Graph (proxied to the AI service via the main backend) ────────────────
// GET /api/graph/{caseId} and GET /api/graph/{caseId}/influencers. These go
// through the BACKEND (Bearer auth, BACKEND_BASE_URL) which proxies to the
// AI service internally — that's different from the AI service's own
// unauthenticated /api/graph/{case_id} in aiApi.ts, which the frontend
// doesn't currently call directly. Node/edge/influencer field shapes aren't
// spelled out in the doc either. ASSUMPTION: nodes look like { id, label,
// type, risk?, role?, x?, y? }, edges like { from, to, label? }, and
// influencers like { name, score, connections } — matching the shape the
// network graph UI already renders. Adjust these types + the mapping in
// App.tsx (layoutGraphNodes) if the real response differs.
export interface ApiGraphNode {
  id: string;
  label: string;
  type: string;
  risk?: number;
  role?: string;
  x?: number;
  y?: number;
}

export interface ApiGraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ApiGraphResponse {
  nodes: ApiGraphNode[];
  edges: ApiGraphEdge[];
}

export interface ApiInfluencer {
  name: string;
  score: number;
  connections: number;
}

export function getGraph(caseId: string) {
  return request<ApiGraphResponse>(`/api/graph/${caseId}`);
}

export function getGraphInfluencers(caseId: string) {
  return request<ApiInfluencer[]>(`/api/graph/${caseId}/influencers`);
}