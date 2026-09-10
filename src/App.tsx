import { useState, useRef, useEffect, useCallback } from "react";
import * as api from "./lib/api";
import * as AIApi from "./lib/AIApi";
import type { ApiCase, ApiUser } from "./lib/api";

// ─── Assets ───────────────────────────────────────────────────────────────────
// Served from /public. BASE_URL keeps this correct when Vite builds under a
// non-root base (see FIGMA_PUBLIC_URL in vite.config.ts).
const LOGO_SRC = `${import.meta.env.BASE_URL}logo-wordmark.png`;

// ─── Types ────────────────────────────────────────────────────────────────────
type Page = "login" | "signup" | "dashboard" | "cases" | "upload" | "network" | "alerts" | "reports";
type Role = "Admin" | "Senior Investigator" | "Field Officer";

// ─── Role <-> backend mapping ──────────────────────────────────────────────
// CRIMENEXA_API_Reference.pdf confirms role/accessLevel are uppercase:
// ADMIN / SENIOR / FIELD (e.g. signup's role field, login's accessLevel).
type ApiRoleShort = "ADMIN" | "SENIOR" | "FIELD";

function roleToApi(role: Role): ApiRoleShort {
  if (role === "Admin") return "ADMIN";
  if (role === "Senior Investigator") return "SENIOR";
  return "FIELD";
}

function roleFromApi(apiRole: string): Role {
  const r = apiRole.toLowerCase();
  if (r.startsWith("admin")) return "Admin";
  if (r.startsWith("field")) return "Field Officer";
  return "Senior Investigator";
}

// Maps an ApiCase (from GET/POST /api/cases) into the shape the existing UI
// already renders. officerName/officerId match the actual Supabase columns
// (officer_name/officer_id); entities isn't confirmed anywhere yet, so it
// still falls back to a placeholder until that field is confirmed.
function apiCaseToUiCase(c: ApiCase) {
  return {
    id: c.id,
    name: c.operationName,
    status: /closed/i.test(c.status) ? "Closed" : "Active",
    date: c.openedDate,
    officer: c.officerName ?? "Unassigned",
    priority: c.priority
      ? c.priority.charAt(0).toUpperCase() + c.priority.slice(1).toLowerCase()
      : "Medium",
    entities: c.entities ?? 0,
  };
}

// ─── Case type (real data) ──────────────────────────────────────────────────
// Cases used to be a hardcoded CASES array. They now come entirely from the
// backend (Supabase, via /api/cases and /api/dashboard/summary) — created
// through the "+ New Case" button in Case Management and read back on the
// Dashboard and Cases pages. This type just captures the shape so components
// stay strongly typed without needing a mock array to infer `typeof` from.
type UiCase = ReturnType<typeof apiCaseToUiCase>;

// ─── Alert helpers (real data) ──────────────────────────────────────────────
// GET /api/alerts?severity= doesn't have its exact response fields confirmed
// in the doc — only the severity query values are documented. ASSUMPTION:
// each alert includes at least id/severity/title, optionally description/
// type/caseId/createdAt/acknowledged. Adjust this mapping if the real shape
// differs.
function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return "";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function apiAlertToUiAlert(a: api.ApiAlert) {
  return {
    id: a.id,
    severity: a.severity ? a.severity.charAt(0).toUpperCase() + a.severity.slice(1).toLowerCase() : "Info",
    title: a.title,
    case: a.caseCode ?? "—",
    desc: a.description ?? "No additional details provided.",
    time: timeAgo(a.createdAt),
    type: a.category ?? "General",
    acknowledged: a.acknowledged ?? false,
  };
}
type UiAlert = ReturnType<typeof apiAlertToUiAlert>;

// ─── Network graph helpers (real data) ──────────────────────────────────────
// GET /api/graph/{caseId} and /influencers also don't have their exact
// response fields confirmed. ASSUMPTION: nodes look like { id, label, type,
// risk?, role?, x?, y? } and edges like { from, to, label? } — matching the
// shape the graph UI already renders — and influencers match { name, score,
// connections } as-is. Nodes without x/y (most likely, since the AI service
// deals in graph structure, not pixel layout) are placed on a simple circle;
// swap in a real force-directed layout (e.g. d3-force) later if needed.
function layoutGraphNodes(nodes: api.ApiGraphNode[]) {
  const cx = 400, cy = 260;
  const r = Math.min(260, 90 + nodes.length * 14);
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
    return {
      id: n.id,
      label: n.label,
      type: n.type,
      risk: n.risk ?? 50,
      role: n.role ?? "Unknown",
      x: n.x ?? cx + r * Math.cos(angle),
      y: n.y ?? cy + r * Math.sin(angle),
    };
  });
}
type UiGraphNode = ReturnType<typeof layoutGraphNodes>[number];

const TIMELINE_EVENTS = [
  { date: "Nov 28", time: "08:14", label: "Wire transfer $2.4M", type: "financial", entity: "Ahmed Khan" },
  { date: "Nov 28", time: "09:30", label: "Call to Tariq Mehmood (23 min)", type: "communication", entity: "Ahmed Khan" },
  { date: "Nov 27", time: "22:00", label: "Karachi Port — container #KHI-4421 offloaded", type: "location", entity: "Karachi Port" },
  { date: "Nov 26", time: "14:55", label: "CryptoFront LLC registered Singapore", type: "org", entity: "CryptoFront LLC" },
  { date: "Nov 25", time: "11:00", label: "Meeting: Ahmed Khan + Chen Wei", type: "meeting", entity: "Ahmed Khan" },
  { date: "Nov 22", time: "03:15", label: "Maria Santos — Karachi Port ping", type: "location", entity: "Maria Santos" },
  { date: "Nov 20", time: "16:40", label: "Bank statement: $800K withdrawal Shell Corp XYZ", type: "financial", entity: "Shell Corp XYZ" },
];

// ─── Icon Components ──────────────────────────────────────────────────────────
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const icons: Record<string, string> = {
    shield: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
    dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
    cases: "M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8-2h4v2h-4V4z",
    upload: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
    network: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
    alert: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
    reports: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
    search: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    user: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
    filter: "M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z",
    download: "M19 9h-4V3H9v6H5l7 7 7-7zm-7 2l-3-3h2V5h2v3h2l-3 3zm-7 7v2h14v-2H5z",
    map: "M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z",
    timeline: "M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z",
    logout: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
    check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    arrowRight: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d={icons[name] || icons.shield} />
    </svg>
  );
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 80; const h = 32;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#g-${color})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: "100%",
              height: `${(v / max) * 64}px`,
              background: `linear-gradient(to top, ${color}99, ${color}33)`,
              borderRadius: "3px 3px 0 0",
              border: `1px solid ${color}44`,
              transition: "height 0.5s ease",
            }}
          />
          <span style={{ fontSize: 9, color: "#64748b", fontFamily: "JetBrains Mono", whiteSpace: "nowrap" }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shared auth-screen shell (used by Login + Signup) ────────────────────────
function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      {/* Animated corner accents */}
      <div style={{ position: "absolute", top: 40, left: 40, width: 120, height: 120, borderTop: "1px solid rgba(0,212,255,0.3)", borderLeft: "1px solid rgba(0,212,255,0.3)" }} />
      <div style={{ position: "absolute", bottom: 40, right: 40, width: 120, height: 120, borderBottom: "1px solid rgba(0,212,255,0.3)", borderRight: "1px solid rgba(0,212,255,0.3)" }} />
      <div style={{ position: "absolute", top: "20%", right: "10%", width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)" }} />

      <div style={{ width: "100%", maxWidth: 420, padding: "0 24px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", marginBottom: 20 }} className="animate-glow">
            <Icon name="shield" size={28} />
          </div>
          <h1 style={{ margin: 0 }}>
            <img src={LOGO_SRC} alt="CrimeNexa" style={{ display: "block", width: 250, maxWidth: "100%", height: "auto", margin: "0 auto" }} />
          </h1>
          <p style={{ color: "#64748b", fontSize: 12, fontFamily: "JetBrains Mono", letterSpacing: "0.12em", marginTop: 6 }}>{subtitle}</p>
        </div>

        {children}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#1a2d4a", fontFamily: "JetBrains Mono", letterSpacing: "0.08em" }}>
          ENCRYPTED · CLASSIFIED · OFFICIAL USE ONLY
        </p>
      </div>
    </div>
  );
}

// ─── Role selector (used by Login only) ────────────────────────────────────────
function RoleSelector({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontFamily: "Rajdhani", fontSize: 13, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Access Level</p>
      <div style={{ display: "flex", gap: 6 }}>
        {(["Admin", "Senior Investigator", "Field Officer"] as Role[]).map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "7px 4px", borderRadius: 6, fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.2s", border: role === r ? "1px solid rgba(0,212,255,0.5)" : "1px solid #1a2d4a", background: role === r ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.02)", color: role === r ? "#00d4ff" : "#64748b" }}>
            {r.split(" ")[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
// Real flow: POST /api/auth/login -> { tempToken, otpSentTo } -> POST
// /api/auth/verify-otp -> { accessToken, refreshToken, user }. The role
// picker is sent as `accessLevel`; the role that actually drives the app
// after login comes back from the server on `user.role`.
function LoginPage({ onLogin, onGoToSignup }: { onLogin: (user: ApiUser, accessToken: string, refreshToken: string) => void; onGoToSignup: () => void }) {
  const [role, setRole] = useState<Role>("Senior Investigator");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");

  async function handleSubmit() {
    setError(null);
    if (step === 1) {
      if (!username || !password) return;
      setLoading(true);
      try {
        const res = await api.login({ accessLevel: roleToApi(role), badgeId: username, password });
        setTempToken(res.tempToken);
        setOtpSentTo(res.otpSentTo);
        setStep(2);
      } catch (e) {
        setError(e instanceof api.ApiError ? e.message : "Couldn't reach the server. Try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyOtp({ tempToken, otp });
      onLogin(res.user, res.accessToken, res.refreshToken);
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : "Couldn't verify that code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="CLASSIFIED INTELLIGENCE PLATFORM">
      <div className="card-glow" style={{ padding: "32px 28px" }}>
        <RoleSelector role={role} setRole={setRole} />

        {error && (
          <p style={{ fontSize: 12.5, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "8px 12px", marginBottom: 14 }}>{error}</p>
        )}

        {step === 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Badge / Username</label>
              <input className="input-field" placeholder="INV-XXXX or username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
              <input className="input-field" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <button className="btn-primary" onClick={handleSubmit} style={{ marginTop: 4, width: "100%" }} disabled={loading}>
              {loading ? "Signing in..." : "Continue"}
            </button>
            <p style={{ textAlign: "center", marginTop: 4, fontSize: 12.5, color: "#64748b" }}>
              Don't have an account?{" "}
              <button
                onClick={onGoToSignup}
                style={{ background: "none", border: "none", padding: 0, color: "#00d4ff", fontSize: 12.5, cursor: "pointer", fontFamily: "Inter, sans-serif", textDecoration: "underline", textUnderlineOffset: 2 }}
              >
                Create one
              </button>
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>OTP sent to registered device</p>
              <p style={{ fontSize: 11, fontFamily: "JetBrains Mono", color: "#64748b" }}>{otpSentTo || "—"}</p>
            </div>
            <div>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>One-Time Passcode</label>
              <input className="input-field" placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ textAlign: "center", letterSpacing: "0.3em", fontSize: 20, fontFamily: "JetBrains Mono" }} maxLength={6} />
            </div>
            <button className="btn-primary" onClick={handleSubmit} style={{ marginTop: 4, width: "100%" }} disabled={loading}>
              {loading ? "Authenticating..." : "Authenticate"}
            </button>
            <button onClick={() => { setStep(1); setError(null); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer" }}>← Back</button>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

// ─── Themed Dropdown ───────────────────────────────────────────────────────────
// A fully custom, on-brand replacement for the native <select>. The browser's
// own dropdown popup can't be restyled beyond option background/text color,
// so this renders its own panel (dark card background, cyan accents, the
// same font/letter-spacing as the rest of the form) and closes on outside
// click or Escape.
function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="input-field"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#e2e8f0",
        }}
      >
        <span>{value}</span>
        <span
          style={{
            display: "inline-flex",
            color: "#00d4ff",
            transition: "transform 0.18s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "#0a1628",
            border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
          }}
        >
          {options.map(opt => {
            const isSelected = opt === value;
            return (
              <div
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  padding: "10px 14px",
                  fontSize: 14,
                  fontFamily: "Rajdhani",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  color: isSelected ? "#00d4ff" : "#94a3b8",
                  background: isSelected ? "rgba(0,212,255,0.08)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "background 0.12s ease, color 0.12s ease",
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {opt}
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Signup Page ──────────────────────────────────────────────────────────────
// NOTE: The "Access Level" selector block has been removed from this page.
// Role is now just another field in the form (Username, Email, Badge ID,
// Password, Role), with Role restricted to Admin / Senior / Field via a
// dropdown. The card padding has been increased so the box reads a bit
// thicker/heavier than before.
type SignupRoleChoice = "Admin" | "Senior" | "Field";

const SIGNUP_ROLE_MAP: Record<SignupRoleChoice, Role> = {
  Admin: "Admin",
  Senior: "Senior Investigator",
  Field: "Field Officer",
};

function SignupPage({ onLogin, onGoToLogin }: { onLogin: (user: ApiUser, accessToken: string, refreshToken: string) => void; onGoToLogin: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [password, setPassword] = useState("");
  const [roleChoice, setRoleChoice] = useState<SignupRoleChoice>("Senior");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");

  const canSubmit = fullName && email && badgeId && password;

  async function handleSubmit() {
    setError(null);

    if (step === 1) {
      if (!canSubmit) return;
      setLoading(true);
      try {
        // 1) Create the account. 2) Immediately call login with the same
        // credentials to trigger the OTP email — signup itself doesn't
        // issue a session, only login + verify-otp does, so this reuses
        // those same two documented endpoints instead of needing any
        // backend change.
        await api.signup({ fullName, email, badgeId, password, role: roleChoice.toUpperCase() });
        const res = await api.login({ accessLevel: roleChoice.toUpperCase(), badgeId, password });
        setTempToken(res.tempToken);
        setOtpSentTo(res.otpSentTo);
        setStep(2);
      } catch (e) {
        setError(e instanceof api.ApiError ? e.message : "Couldn't create the account. Try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyOtp({ tempToken, otp });
      onLogin(res.user, res.accessToken, res.refreshToken);
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : "Couldn't verify that code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="REQUEST NEW ACCESS CREDENTIALS">
      <div className="card-glow" style={{ padding: step === 1 ? "44px 36px" : "32px 28px" }}>
        {error && (
          <p style={{ fontSize: 12.5, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "8px 12px", marginBottom: 14 }}>{error}</p>
        )}

        {step === 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Username</label>
              <input className="input-field" placeholder="Full name or username" value={fullName} onChange={e => setFullName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email</label>
              <input className="input-field" type="email" placeholder="name@agency.gov" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Badge ID</label>
              <input className="input-field" placeholder="INV-XXXX" value={badgeId} onChange={e => setBadgeId(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
              <input className="input-field" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Role</label>
              <Dropdown
                value={roleChoice}
                options={["Admin", "Senior", "Field"]}
                onChange={v => setRoleChoice(v as SignupRoleChoice)}
              />
            </div>
            <button className="btn-primary" onClick={handleSubmit} style={{ marginTop: 4, width: "100%" }} disabled={loading || !canSubmit}>
              {loading ? "Creating Account..." : "Create Account"}
            </button>
            <p style={{ textAlign: "center", marginTop: 4, fontSize: 12.5, color: "#64748b" }}>
              Already have an account?{" "}
              <button
                onClick={onGoToLogin}
                style={{ background: "none", border: "none", padding: 0, color: "#00d4ff", fontSize: 12.5, cursor: "pointer", fontFamily: "Inter, sans-serif", textDecoration: "underline", textUnderlineOffset: 2 }}
              >
                Log in
              </button>
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Account created — OTP sent to registered device</p>
              <p style={{ fontSize: 11, fontFamily: "JetBrains Mono", color: "#64748b" }}>{otpSentTo || "—"}</p>
            </div>
            <div>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>One-Time Passcode</label>
              <input className="input-field" placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ textAlign: "center", letterSpacing: "0.3em", fontSize: 20, fontFamily: "JetBrains Mono" }} maxLength={6} />
            </div>
            <button className="btn-primary" onClick={handleSubmit} style={{ marginTop: 4, width: "100%" }} disabled={loading}>
              {loading ? "Authenticating..." : "Authenticate"}
            </button>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: Page; icon: string; label: string }[] = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard" },
  { id: "cases", icon: "cases", label: "Cases" },
  { id: "upload", icon: "upload", label: "Upload Data" },
  { id: "network", icon: "network", label: "Network Graph" },
  { id: "alerts", icon: "alert", label: "Alerts" },
  { id: "reports", icon: "reports", label: "Reports" },
];

const USERS: Record<Role, { name: string; id: string; tag: string }> = {
  "Admin": { name: "DCP Arvind Sharma", id: "ADM-001", tag: "ADMIN" },
  "Senior Investigator": { name: "Insp. Meera Iyer", id: "SNR-114", tag: "SENIOR" },
  "Field Officer": { name: "SI Rakesh Patil", id: "FLD-207", tag: "FIELD" },
};

function Sidebar({ page, setPage, role, apiUser, onLogout }: { page: Page; setPage: (p: Page) => void; role: Role; apiUser: ApiUser | null; onLogout: () => void }) {
  // Prefer the real profile from GET /api/users/me; fall back to the mock
  // per-role identity so the sidebar still looks right in offline/dev mode.
  const mock = USERS[role];
  const user = apiUser
    ? { name: apiUser.fullName, id: apiUser.badgeId, tag: role.split(" ")[0].toUpperCase() }
    : mock;

  // Real alert count for the nav badge — GET /api/alerts?severity=ALL. No
  // badge shown if the count is zero, there's no session yet, or the
  // request fails.
  const [alertCount, setAlertCount] = useState(0);
  useEffect(() => {
    if (!api.hasSession()) return;
    api.getAlerts("ALL")
      .then(list => setAlertCount(list?.length ?? 0))
      .catch(() => { /* no badge if we can't reach the server */ });
  }, []);

  // Profile popup — shows the raw GET /api/users/me fields without leaving
  // the page. Closes on Escape or clicking outside the card.
  const [showProfile, setShowProfile] = useState(false);
  useEffect(() => {
    if (!showProfile) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setShowProfile(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showProfile]);

  return (
    <>
    <div style={{ width: 256, minHeight: "100vh", background: "#070e1b", borderRight: "1px solid #0f1e36", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Brand */}
      <div style={{ padding: "22px 20px", borderBottom: "1px solid #0f1e36", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#00d4ff", flexShrink: 0 }}>
          <Icon name="shield" size={18} />
        </div>
        <div>
          <img src={LOGO_SRC} alt="CrimeNexa" style={{ display: "block", width: 148, maxWidth: "100%", height: "auto" }} />
          <div style={{ fontSize: 10, color: "#475569", fontFamily: "JetBrains Mono", letterSpacing: "0.1em", marginTop: 2 }}>v4.1.2</div>
        </div>
      </div>

      {/* User */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #0f1e36", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => setShowProfile(true)}
          title="View profile"
          style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #1a2d4a, #0a1628)", border: "1px solid #1a2d4a", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", flexShrink: 0, cursor: "pointer", padding: 0, transition: "border-color 0.2s, color 0.2s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.5)"; (e.currentTarget as HTMLElement).style.color = "#00d4ff"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a2d4a"; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
        >
          <Icon name="user" size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontFamily: "Rajdhani", fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>{user.name}</div>
          <div style={{ fontSize: 10.5, color: "#00d4ff", fontFamily: "JetBrains Mono", letterSpacing: "0.08em", marginTop: 2 }}>{user.id} &middot; {user.tag}</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
            style={{ width: "100%", textAlign: "left" }}
            aria-current={page === item.id ? "page" : undefined}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
            {item.id === "alerts" && alertCount > 0 && (
              <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "JetBrains Mono", flexShrink: 0 }}>
                {alertCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: "14px", borderTop: "1px solid #0f1e36" }}>
        <button className="nav-item" onClick={onLogout} style={{ width: "100%", textAlign: "left", color: "#ef4444" }}>
          <Icon name="logout" size={16} />
          Logout
        </button>
      </div>
    </div>

    {/* Profile popup */}
    {showProfile && (
      <div
        onClick={() => setShowProfile(false)}
        style={{ position: "fixed", inset: 0, background: "rgba(2,6,14,0.72)", backdropFilter: "blur(3px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      >
        <div onClick={e => e.stopPropagation()} className="card-glow" style={{ width: 340, maxWidth: "100%", padding: 0, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a2d4a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontFamily: "Rajdhani", fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#e2e8f0", margin: 0 }}>User Profile</h3>
            <button onClick={() => setShowProfile(false)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 4, display: "flex" }}><Icon name="close" size={16} /></button>
          </div>

          {/* Avatar + name */}
          <div style={{ padding: "24px 22px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, borderBottom: "1px solid #0f1e36" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,212,255,0.1)", border: "1.5px solid rgba(0,212,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "#00d4ff" }} className="animate-glow">
              <Icon name="user" size={28} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 17, fontFamily: "Rajdhani", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>{apiUser?.fullName ?? user.name}</p>
              {apiUser?.role && (
                <span className="badge badge-info" style={{ marginTop: 6, display: "inline-block" }}>{apiUser.role}</span>
              )}
            </div>
          </div>

          {/* Fields — straight from GET /api/users/me */}
          <div style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            {apiUser ? (
              [
                { k: "Full Name", v: apiUser.fullName },
                { k: "Badge ID", v: apiUser.badgeId },
                { k: "Email", v: apiUser.email },
                { k: "Role", v: apiUser.role },
                { k: "User ID", v: apiUser.id },
                { k: "Last Login", v: apiUser.lastLogin ? new Date(apiUser.lastLogin).toLocaleString() : "—" },
              ].map(row => (
                <div key={row.k} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                  <span style={{ fontSize: 11, color: "#64748b", fontFamily: "Rajdhani", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", flexShrink: 0, paddingTop: 1 }}>{row.k}</span>
                  <span style={{ fontSize: 12.5, fontFamily: "JetBrains Mono", color: "#94a3b8", textAlign: "right", overflowWrap: "anywhere" }}>{row.v}</span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 12.5, color: "#f59e0b", margin: 0, textAlign: "center", lineHeight: 1.6 }}>Couldn't load profile details from the server — showing local session only.</p>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({ title, setPage }: { title: string; setPage: (p: Page) => void }) {
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ height: 73, borderBottom: "1px solid #0f1e36", display: "flex", alignItems: "center", padding: "0 24px", gap: 20, background: "#070e1b", flexShrink: 0 }}>
      <h2 style={{ fontFamily: "Rajdhani", fontSize: 21, fontWeight: 700, letterSpacing: "0.01em", color: "#e2e8f0", margin: 0, flexShrink: 0 }}>{title}</h2>

      <div style={{ position: "relative", width: 380, maxWidth: "40vw" }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}>
          <Icon name="search" size={15} />
        </div>
        <input
          ref={searchRef}
          className="input-field"
          placeholder="Search name, phone, case ID..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && q && setPage("cases")}
          style={{ paddingLeft: 40, paddingRight: 46, fontSize: 13.5, borderRadius: 8 }}
        />
        <span className="kbd" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>&#8984;K</span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} className="animate-pulse-cyan" />
        <span style={{ fontSize: 11, fontFamily: "JetBrains Mono", color: "#22c55e", letterSpacing: "0.08em" }}>SECURE</span>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setPage }: { setPage: (p: Page) => void }) {
  // Live data from GET /api/dashboard/summary and GET /api/cases — no more
  // mock fallback. If a call fails we surface it (banner below) instead of
  // silently showing fake numbers. If there's no Bearer token at all (e.g.
  // just after signup, before a real login) we don't call the API — a 401
  // isn't a "server error" worth alarming someone with, it's just "you're
  // not logged in yet", so this shows a plain empty dashboard instead.
  const hasSession = api.hasSession();
  const [summary, setSummary] = useState<api.DashboardSummary | null>(null);
  const [casesList, setCasesList] = useState<UiCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(hasSession);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [alertsList, setAlertsList] = useState<UiAlert[]>([]);

  useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    api.getDashboardSummary()
      .then(s => { if (!cancelled) setSummary(s); })
      .catch(() => { /* summary is optional — stats below fall back to counts derived from cases/alerts */ });
    api.getCases({ status: "ALL" })
      .then(list => { if (!cancelled) { setCasesList(list.map(apiCaseToUiCase)); setCasesError(null); } })
      .catch(e => { if (!cancelled) setCasesError(e instanceof api.ApiError ? e.message : "Couldn't load cases from the server."); })
      .finally(() => { if (!cancelled) setCasesLoading(false); });
    api.getAlerts("ALL")
      .then(list => { if (!cancelled) setAlertsList(list.map(apiAlertToUiAlert)); })
      .catch(() => { /* Recent Alerts card just stays empty */ });
    return () => { cancelled = true; };
  }, [hasSession]);

  const activeCases = casesList.filter(c => c.status === "Active");
  const totalEntitiesFallback = casesList.reduce((sum, c) => sum + c.entities, 0);
  const criticalCases = activeCases.filter(c => c.priority === "Critical").length;

  const stats = [
    { label: "Active Cases", value: String(summary?.activeCases ?? activeCases.length), sub: `${criticalCases} critical priority`, accent: "#00d4ff" },
    { label: "Total Entities", value: String(summary?.totalEntities ?? totalEntitiesFallback), sub: "across all cases", accent: "#a855f7" },
    { label: "Open Alerts", value: String(summary?.openAlerts ?? alertsList.length), sub: `${summary?.criticalAlerts ?? alertsList.filter(a => a.severity === "Critical").length} unreviewed today`, accent: "#ef4444" },
    { label: "Officers Assigned", value: "6", sub: `across ${activeCases.length} cases`, accent: "#22c55e" },
  ];

  const severityColor: Record<string, string> = { Critical: "#ef4444", High: "#f97316", Medium: "#f59e0b", Info: "#00d4ff" };

  const quickActions: { label: string; page: Page; color: string; rgb: string }[] = [
    { label: "Upload New Data", page: "upload", color: "#00d4ff", rgb: "0,212,255" },
    { label: "View Network Map", page: "network", color: "#a855f7", rgb: "168,85,247" },
    { label: "Generate Report", page: "reports", color: "#22c55e", rgb: "34,197,94" },
    { label: "Manage Cases", page: "cases", color: "#f59e0b", rgb: "245,158,11" },
  ];

  const alertMonths = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const alertCounts = [14, 11, 17, 13, 18, 21];
  const trend = ((alertCounts[5] - alertCounts[4]) / alertCounts[4]) * 100;

  return (
    <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 22, overflowY: "auto", flex: 1 }}>
      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20 }}>
        {stats.map(s => (
          <div key={s.label} className="stat-tile" style={{ "--accent-color": s.accent } as React.CSSProperties}>
            <p style={{ fontSize: 11.5, fontFamily: "Rajdhani", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>{s.label}</p>
            <p style={{ fontSize: 42, fontFamily: "Rajdhani", fontWeight: 700, color: s.accent, margin: "10px 0 8px", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Three-column row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 20, alignItems: "start" }}>
        {/* Recent alerts */}
        <div className="card" style={{ padding: "18px 22px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h3 style={{ fontFamily: "Rajdhani", fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e2e8f0", margin: 0 }}>Recent Alerts</h3>
            <button onClick={() => setPage("alerts")} style={{ background: "none", border: "none", color: "#00d4ff", fontSize: 12.5, cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>View all &rarr;</button>
          </div>
          {alertsList.length === 0 && (
            <p style={{ fontSize: 12.5, color: "#475569", margin: "8px 0", fontFamily: "JetBrains Mono" }}>No alerts yet.</p>
          )}
          {alertsList.slice(0, 4).map(a => (
            <div key={a.id} className="alert-row" onClick={() => setPage("alerts")}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 7, flexShrink: 0, background: severityColor[a.severity] || "#64748b" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ fontSize: 14.5, color: "#e2e8f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</p>
                  <span className={`badge ${a.severity === "Critical" ? "badge-critical" : a.severity === "Info" ? "badge-info" : "badge-warning"}`} style={{ flexShrink: 0, marginLeft: "auto" }}>{a.severity}</span>
                </div>
                <p style={{ fontSize: 11.5, color: "#475569", margin: "4px 0 0", fontFamily: "JetBrains Mono" }}>{a.case} &middot; {a.time}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Alerts per month */}
        <div className="card" style={{ padding: "18px 22px 20px" }}>
          <h3 style={{ fontFamily: "Rajdhani", fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e2e8f0", margin: "0 0 22px" }}>Alerts / Month</h3>
          <BarChart data={alertCounts} labels={alertMonths} color="#ef4444" />
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 22 }}>
            <span style={{ fontSize: 27, fontFamily: "Rajdhani", fontWeight: 700, color: "#ef4444", lineHeight: 1 }}>
              {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
            </span>
            <span style={{ fontSize: 12.5, color: "#64748b" }}>alerts vs last month</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card" style={{ padding: "18px 22px 22px" }}>
          <h3 style={{ fontFamily: "Rajdhani", fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e2e8f0", margin: "0 0 16px" }}>Quick Actions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {quickActions.map(qa => (
              <button
                key={qa.label}
                className="qa-btn"
                onClick={() => setPage(qa.page)}
                style={{ background: `rgba(${qa.rgb},0.07)`, border: `1px solid rgba(${qa.rgb},0.25)`, color: qa.color }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: qa.color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{qa.label}</span>
                <Icon name="arrowRight" size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active operations */}
      <div className="card" style={{ padding: "18px 22px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontFamily: "Rajdhani", fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e2e8f0", margin: 0 }}>Active Operations</h3>
          <button onClick={() => setPage("cases")} style={{ background: "none", border: "none", color: "#00d4ff", fontSize: 12.5, cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>All cases &rarr;</button>
        </div>
        {casesError && (
          <p style={{ fontSize: 12.5, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>{casesError}</p>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1a2d4a" }}>
                {["Case ID", "Operation", "Officer", "Entities", "Priority"].map(h => (
                  <th key={h} style={{ padding: "0 14px 10px 0", textAlign: "left", fontSize: 10.5, fontFamily: "JetBrains Mono", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeCases.map(c => (
                <tr key={c.id} className="table-row" style={{ cursor: "pointer" }} onClick={() => setPage("cases")}>
                  <td style={{ padding: "13px 14px 13px 0", fontFamily: "JetBrains Mono", fontSize: 12, color: "#00d4ff", whiteSpace: "nowrap" }}>{c.id}</td>
                  <td style={{ padding: "13px 14px 13px 0", fontSize: 14, color: "#e2e8f0" }}>{c.name}</td>
                  <td style={{ padding: "13px 14px 13px 0", fontSize: 13.5, color: "#94a3b8", whiteSpace: "nowrap" }}>{c.officer}</td>
                  <td style={{ padding: "13px 14px 13px 0", fontFamily: "JetBrains Mono", fontSize: 12, color: "#94a3b8" }}>{c.entities}</td>
                  <td style={{ padding: "13px 0" }}>
                    <span className={`badge ${c.priority === "Critical" ? "badge-critical" : c.priority === "High" ? "badge-warning" : "badge-info"}`}>{c.priority}</span>
                  </td>
                </tr>
              ))}
              {casesLoading && (
                <tr><td colSpan={5} style={{ padding: "24px 0", textAlign: "center", color: "#475569", fontFamily: "JetBrains Mono", fontSize: 12.5 }}>Loading cases…</td></tr>
              )}
              {!casesLoading && !casesError && activeCases.length === 0 && (
                <tr><td colSpan={5} style={{ padding: "24px 0", textAlign: "center", color: "#475569", fontFamily: "JetBrains Mono", fontSize: 12.5 }}>{hasSession ? "No active cases yet — create one from the Cases page." : "Log in to view your cases."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Case Management ──────────────────────────────────────────────────────────
// GET /api/cases?status=&search= for the list; POST /api/cases (ADMIN/SENIOR
// only) to create; PATCH /api/cases/{caseId}/status?status=CLOSED (ADMIN/
// SENIOR only) to close. Backed entirely by the real API now — no mock
// fallback — with loading/error states surfaced in the UI below.
function CaseManagement({ setPage, role, onOpenCase }: { setPage: (p: Page) => void; role: Role; onOpenCase: (caseId: string) => void }) {
  const hasSession = api.hasSession();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [cases, setCases] = useState<UiCase[]>([]);
  const [loading, setLoading] = useState(hasSession);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [newOpName, setNewOpName] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Case creation also needs a real session — without one, "+ New Case"
  // would just fail with a 401, so it's disabled rather than left to error.
  const canManage = hasSession && (role === "Admin" || role === "Senior Investigator");

  const refresh = useCallback(() => {
    if (!hasSession) { setLoading(false); return; }
    setLoading(true);
    api.getCases({ status: filter === "All" ? "ALL" : filter.toUpperCase(), search })
      .then(list => { setCases(list.map(apiCaseToUiCase)); setLoadError(null); })
      .catch(e => setLoadError(e instanceof api.ApiError ? e.message : "Couldn't load cases from the server."))
      .finally(() => setLoading(false));
  }, [filter, search, hasSession]);

  useEffect(() => {
    const t = setTimeout(refresh, 250); // light debounce on search
    return () => clearTimeout(t);
  }, [refresh]);

  // Status/search filtering happens server-side (GET /api/cases already
  // accepts both as query params), so the API response is shown as-is.
  const filtered = cases;

  async function handleCreateCase() {
    if (!newOpName) return;
    setCreating(true);
    setCreateError(null);
    try {
      await api.createCase({ operationName: newOpName, priority: newPriority.toUpperCase(), openedDate: new Date().toISOString().slice(0, 10) });
      setShowNewCase(false);
      setNewOpName("");
      refresh();
    } catch (e) {
      setCreateError(e instanceof api.ApiError ? e.message : "Couldn't create the case. Try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCloseCase(caseId: string) {
    try {
      await api.updateCaseStatus(caseId, "CLOSED");
      refresh();
    } catch {
      // best-effort — no confirmed error shape yet
    }
  }

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }}><Icon name="search" size={14} /></div>
          <input className="input-field" placeholder="Search cases..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, fontSize: 13 }} />
        </div>
        {["All", "Active", "Closed"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "9px 18px", borderRadius: 6, fontFamily: "Rajdhani", fontWeight: 600, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s", border: filter === f ? "1px solid rgba(0,212,255,0.5)" : "1px solid #1a2d4a", background: filter === f ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.02)", color: filter === f ? "#00d4ff" : "#64748b" }}>{f}</button>
        ))}
        <button className="btn-primary" disabled={!canManage} title={canManage ? "" : hasSession ? "Admin/Senior Investigator only" : "Log in to create a case"} onClick={() => setShowNewCase(v => !v)}>+ New Case</button>
      </div>

      {showNewCase && canManage && (
        <div className="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {createError && (
            <p style={{ fontSize: 12.5, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "8px 12px", margin: 0 }}>{createError}</p>
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Operation Name</label>
              <input className="input-field" placeholder="Operation Name" value={newOpName} onChange={e => setNewOpName(e.target.value)} />
            </div>
            <div style={{ width: 180 }}>
              <label style={{ fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Priority</label>
              <Dropdown value={newPriority} options={["Critical", "High", "Medium", "Low"]} onChange={setNewPriority} />
            </div>
            <button className="btn-primary" onClick={handleCreateCase} disabled={creating || !newOpName}>{creating ? "Creating..." : "Create"}</button>
            <button className="btn-secondary" onClick={() => setShowNewCase(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "rgba(0,212,255,0.04)", borderBottom: "1px solid #1a2d4a" }}>
            <tr>
              {["Case ID", "Operation Name", "Status", "Opened", "Officer", "Entities", "Priority", ""].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="table-row" style={{ cursor: "pointer" }} onClick={() => onOpenCase(c.id)}>
                <td style={{ padding: "14px 16px", fontFamily: "JetBrains Mono", fontSize: 12, color: "#00d4ff" }}>{c.id}</td>
                <td style={{ padding: "14px 16px", fontSize: 14, color: "#e2e8f0", fontWeight: 500 }}>{c.name}</td>
                <td style={{ padding: "14px 16px" }}><span className={`badge ${c.status === "Active" ? "badge-active" : "badge-closed"}`}>{c.status}</span></td>
                <td style={{ padding: "14px 16px", fontSize: 12, color: "#64748b", fontFamily: "JetBrains Mono" }}>{c.date}</td>
                <td style={{ padding: "14px 16px", fontSize: 13, color: "#94a3b8" }}>{c.officer}</td>
                <td style={{ padding: "14px 16px", fontSize: 13, fontFamily: "JetBrains Mono", color: "#94a3b8" }}>{c.entities}</td>
                <td style={{ padding: "14px 16px" }}><span className={`badge ${c.priority === "Critical" ? "badge-critical" : c.priority === "High" ? "badge-warning" : c.priority === "Medium" ? "badge-info" : "badge-closed"}`}>{c.priority}</span></td>
                <td style={{ padding: "14px 16px", display: "flex", gap: 6 }}>
                  <button className="btn-secondary" style={{ padding: "4px 12px", fontSize: 11 }} onClick={e => { e.stopPropagation(); onOpenCase(c.id); }}>Open →</button>
                  {canManage && c.status === "Active" && (
                    <button className="btn-secondary" style={{ padding: "4px 12px", fontSize: 11 }} onClick={e => { e.stopPropagation(); handleCloseCase(c.id); }}>Close</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div style={{ padding: "40px", textAlign: "center", color: "#475569", fontFamily: "JetBrains Mono", fontSize: 13 }}>Loading cases…</div>}
        {!loading && loadError && <div style={{ padding: "40px", textAlign: "center", color: "#ef4444", fontFamily: "JetBrains Mono", fontSize: 13 }}>{loadError}</div>}
        {!loading && !loadError && filtered.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "#475569", fontFamily: "JetBrains Mono", fontSize: 13 }}>{hasSession ? 'No cases yet — click "+ New Case" to create the first one.' : "Log in to view and manage cases."}</div>}
      </div>
    </div>
  );
}

// ─── Data Upload ──────────────────────────────────────────────────────────────
// POST /api/ingest/upload (multipart: file, documentCategory, caseId). The
// doc's category values are FIR/CALL_RECORDS/BANK_RECORDS/SOCIAL_MEDIA/
// SURVEILLANCE/OTHER — mapped from the existing display labels below. caseId
// is required by the API and is populated from the real case list (created
// via the Cases page). The progress bar animation is kept for feel while the
// real request is in flight; the "AI extraction" entity count is still a
// placeholder since that response shape isn't in the doc pages seen so far.
const CATEGORY_TO_API: Record<string, string> = {
  FIR: "FIR",
  "Call Records": "CALL_RECORDS",
  "Bank Records": "BANK_RECORDS",
  "Social Media": "SOCIAL_MEDIA",
  Surveillance: "SURVEILLANCE",
  Location: "LOCATION",
  Forensic: "FORENSIC",
  Other: "OTHER",
};

type FastApiUploadCategory =
  | "FIR"
  | "Call Records"
  | "Bank Records"
  | "Surveillance"
  | "Location";

function uploadToFastApi(file: File, category: string, caseId: string) {
  return AIApi.processUploadedFile(file, category, caseId);
}

function DataUpload() {
  const hasSession = api.hasSession();

  const [dragging, setDragging] = useState(false);

  const [files, setFiles] = useState<
    {
      name: string;
      size: string;
      cat: string;
      progress: number;
      done: boolean;
      error?: string;
    }[]
  >([]);

  const [category, setCategory] = useState("FIR");

  const [caseOptions, setCaseOptions] = useState<
    { id: string; name: string }[]
  >([]);

  const [caseId, setCaseId] = useState<string>("");

  const [casesLoading, setCasesLoading] = useState(hasSession);

  const CATS = [
    "FIR",
    "Call Records",
    "Bank Records",
    "Social Media",
    "Surveillance",
    "Location",
    "Forensic",
    "Other",
  ];

  // ─────────────────────────────────────────────
  // AI ASSISTANT STATE
  // ─────────────────────────────────────────────

  const [assistantQuestion, setAssistantQuestion] =
    useState("");

  const [assistantAnswer, setAssistantAnswer] =
    useState("");

  const [assistantSources, setAssistantSources] =
    useState<AIApi.AssistantSource[]>([]);

  // Evidence context that will be sent to
  // POST /api/assistant/ask
  const [assistantContext, setAssistantContext] =
    useState<AIApi.AssistantSource[]>([]);

  const [assistantLoading, setAssistantLoading] =
    useState(false);

  const [assistantError, setAssistantError] =
    useState("");

  const [caseCdrRecords, setCaseCdrRecords] =
  useState<unknown[]>([]);

  const [caseLocationPoints, setCaseLocationPoints] =
    useState<unknown[]>([]);

  const [caseTransactionRecords, setCaseTransactionRecords] =
    useState<unknown[]>([]);

  // ─────────────────────────────────────────────
  // LOAD CASES
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!hasSession) return;

    api
      .getCases({ status: "ALL" })
      .then((list) => {
        const opts = list.map((c) => ({
          id: c.id,
          name: c.operationName,
        }));

        setCaseOptions(opts);

        // Select first case automatically
        setCaseId(opts[0]?.id ?? "");
      })
      .catch(() => {
        /* leave caseOptions empty */
      })
      .finally(() => setCasesLoading(false));
  }, [hasSession]);

  // ─────────────────────────────────────────────
  // ASK AI ASSISTANT
  // ─────────────────────────────────────────────

  async function handleAskAssistant() {
    if (!assistantQuestion.trim()) {
      return;
    }

    if (!caseId) {
      setAssistantError(
        "Please select a case before asking a question."
      );
      return;
    }

    setAssistantLoading(true);
    setAssistantError("");
    setAssistantAnswer("");
    setAssistantSources([]);


    try {
      /*
       * The selected case ID is sent directly to
       * /api/assistant/ask.
       *
       * assistantContext contains evidence extracted
       * from files uploaded for this case.
       */
      const result = await AIApi.askAssistant(
        assistantQuestion.trim(),
        caseId,
        assistantContext
      );

      setAssistantAnswer(result.answer || "");
      setAssistantSources(result.sources || []);
    } catch (error) {
      setAssistantError(
        error instanceof Error
          ? error.message
          : "Failed to contact AI Assistant"
      );
    } finally {
      setAssistantLoading(false);
    }
  }

  // ─────────────────────────────────────────────
  // FILE UPLOAD
  // ─────────────────────────────────────────────

  function runUpload(file: File) {
    if (!caseId) return;

    const name = file.name;
    const size = `${(file.size / 1024).toFixed(0)} KB`;

    setFiles((prev) => [
      ...prev,
      {
        name,
        size,
        cat: category,
        progress: 0,
        done: false,
      },
    ]);

    let p = 0;

    const iv = setInterval(() => {
      p = Math.min(
        p + Math.random() * 12 + 4,
        92
      );

      setFiles((prev) =>
        prev.map((f) =>
          f.name === name && !f.done
            ? {
                ...f,
                progress: Math.round(p),
              }
            : f
        )
      );
    }, 200);

    uploadToFastApi(file, category, caseId)
      .then((result) => {
        clearInterval(iv);
        
        if (category === "Call Records") {
          const records =
            Array.isArray(
              (result?.ingestion as any)?.records
            )
              ? (result.ingestion as any).records
              : [];

          setCaseCdrRecords((prev) => [
            ...prev,
            ...records,
          ]);
        }

        if (category === "Location") {
          const records =
            Array.isArray(
              (result?.ingestion as any)?.records
            )
              ? (result.ingestion as any).records
              : [];

          setCaseLocationPoints((prev) => [
            ...prev,
            ...records,
          ]);
        }

        if (category === "Bank Records") {
          const records =
            Array.isArray(
              (result?.ingestion as any)?.records
            )
              ? (result.ingestion as any).records
              : [];

          setCaseTransactionRecords((prev) => [
            ...prev,
            ...records,
          ]);
        }

        // ─────────────────────────────────────────
        // SAVE UPLOADED EVIDENCE FOR AI ASSISTANT
        // ─────────────────────────────────────────

        const newContext: AIApi.AssistantSource[] = [];

        /*
         * processUploadedFile() returns the extraction
         * result from the AI service.
         *
         * For FIR / forensic / text-based evidence,
         * raw_text contains the extracted document text.
         */
        const extraction =
          result?.extraction;

        if (
          extraction &&
          typeof extraction.raw_text === "string" &&
          extraction.raw_text.trim()
        ) {
          newContext.push({
            source_id: name,
            source_type: category,
            excerpt: extraction.raw_text,
          });
        }

        /*
         * Some ingestion endpoints can also return
         * raw_text. Add it if it is different from
         * the extraction result.
         */
        const ingestion =
          result?.ingestion;

        if (
          ingestion &&
          typeof (ingestion as any).raw_text === "string" &&
          (ingestion as any).raw_text.trim() &&
          (ingestion as any).raw_text !== extraction?.raw_text
        ) {
          newContext.push({
            source_id: name,
            source_type: category,
            excerpt: (ingestion as any).raw_text,
          });
        }

        /*
         * Add the newly uploaded evidence to the
         * currently selected case's Assistant context.
         */
        if (newContext.length > 0) {
          setAssistantContext((prev) => [
            ...prev,
            ...newContext,
          ]);
        }

        // ─────────────────────────────────────────
        // UPDATE UPLOAD STATUS
        // ─────────────────────────────────────────

        setFiles((prev) =>
          prev.map((f) =>
            f.name === name
              ? {
                  ...f,
                  progress: 100,
                  done: true,
                }
              : f
          )
        );
      })
      .catch((e) => {
        clearInterval(iv);

        const message =
          e instanceof api.ApiError
            ? e.message
            : "Upload failed";

        setFiles((prev) =>
          prev.map((f) =>
            f.name === name
              ? {
                  ...f,
                  progress: 100,
                  done: true,
                  error: message,
                }
              : f
          )
        );
      });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);

    Array.from(e.dataTransfer.files).forEach(
      runUpload
    );
  }

  function handleFileInput(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!e.target.files) return;

    Array.from(e.target.files).forEach(
      runUpload
    );
  }

  const inputRef =
    useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────

  return (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        overflowY: "auto",
        flex: 1,
      }}
    >
      {/* ───────────────────────────────────────── */}
      {/* UPLOAD SECTION */}
      {/* ───────────────────────────────────────── */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 20,
          flex: 1,
        }}
      >
        {/* LEFT SIDE */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* CATEGORY + CASE */}
          <div
            className="card"
            style={{
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* DOCUMENT CATEGORY */}
            <div>
              <h3
                style={{
                  fontFamily: "Rajdhani",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  margin: "0 0 14px",
                }}
              >
                Document Category
              </h3>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {CATS.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      setCategory(c)
                    }
                    style={{
                      padding: "7px 16px",
                      borderRadius: 20,
                      fontFamily: "Rajdhani",
                      fontWeight: 600,
                      fontSize: 13,
                      letterSpacing: "0.04em",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      border:
                        category === c
                          ? "1px solid rgba(0,212,255,0.5)"
                          : "1px solid #1a2d4a",
                      background:
                        category === c
                          ? "rgba(0,212,255,0.1)"
                          : "rgba(255,255,255,0.02)",
                      color:
                        category === c
                          ? "#00d4ff"
                          : "#64748b",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* CASE */}
            <div>
              <h3
                style={{
                  fontFamily: "Rajdhani",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  margin: "0 0 10px",
                }}
              >
                Case
              </h3>

              {casesLoading ? (
                <p
                  style={{
                    fontSize: 12.5,
                    color: "#475569",
                    margin: 0,
                  }}
                >
                  Loading cases…
                </p>
              ) : caseOptions.length === 0 ? (
                <p
                  style={{
                    fontSize: 12.5,
                    color: "#f59e0b",
                    margin: 0,
                  }}
                >
                  {hasSession
                    ? "No cases yet — create one on the Cases page before uploading."
                    : "Log in to select a case for upload."}
                </p>
              ) : (
                <Dropdown
                  value={
                    caseOptions.find(
                      (o) => o.id === caseId
                    )?.name ??
                    "Select a case"
                  }
                  options={caseOptions.map(
                    (o) => o.name
                  )}
                  onChange={(name) => {
                    const found =
                      caseOptions.find(
                        (o) =>
                          o.name === name
                      );

                    if (found) {
                      setCaseId(found.id);

                      // Clear Assistant state
                      // when changing cases.
                      setAssistantQuestion("");
                      setAssistantAnswer("");
                      setAssistantSources([]);
                      setAssistantContext([]);
                      setAssistantError("");

                      // Clear accumulated evidence from previous case
                      setCaseCdrRecords([]);
                      setCaseLocationPoints([]);
                      setCaseTransactionRecords([]);
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* DROP ZONE */}
          <div
            onDragOver={(e) => {
              if (caseId) {
                e.preventDefault();
                setDragging(true);
              }
            }}
            onDragLeave={() =>
              setDragging(false)
            }
            onDrop={handleDrop}
            onClick={() =>
              caseId &&
              inputRef.current?.click()
            }
            style={{
              border: `2px dashed ${
                dragging
                  ? "#00d4ff"
                  : "#1a2d4a"
              }`,
              borderRadius: 12,
              padding: "60px 40px",
              textAlign: "center",
              background: dragging
                ? "rgba(0,212,255,0.04)"
                : "rgba(255,255,255,0.01)",
              cursor: caseId
                ? "pointer"
                : "not-allowed",
              opacity: caseId ? 1 : 0.5,
              transition: "all 0.2s",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              minHeight: 240,
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleFileInput}
              accept=".pdf,.xlsx,.xls,.csv,.json,.txt,.jpg,.jpeg,.png,.mp4"
            />

            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background:
                  "rgba(0,212,255,0.08)",
                border:
                  "1px solid rgba(0,212,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: dragging
                  ? "#00d4ff"
                  : "#475569",
              }}
            >
              <Icon
                name="upload"
                size={26}
              />
            </div>

            <div>
              <p
                style={{
                  fontSize: 16,
                  fontFamily: "Rajdhani",
                  fontWeight: 600,
                  color: dragging
                    ? "#00d4ff"
                    : "#94a3b8",
                  margin: 0,
                }}
              >
                {dragging
                  ? "Release to upload"
                  : "Drag & drop files here"}
              </p>

              <p
                style={{
                  fontSize: 12,
                  color: "#475569",
                  margin: "6px 0 0",
                }}
              >
                PDF, Excel, CSV, JSON, TXT,
                Images, Video — max 500 MB per
                file
              </p>
            </div>

            <button
              className="btn-secondary"
              disabled={!caseId}
              onClick={(e) => {
                e.stopPropagation();

                if (caseId) {
                  inputRef.current?.click();
                }
              }}
            >
              Browse Files
            </button>
          </div>

          {/* UPLOAD QUEUE */}
          {files.length > 0 && (
            <div
              className="card"
              style={{
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h3
                style={{
                  fontFamily: "Rajdhani",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  margin: 0,
                }}
              >
                Upload Queue
              </h3>

              {files.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: "#e2e8f0",
                        overflow: "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace:
                          "nowrap",
                        maxWidth: "60%",
                      }}
                    >
                      {f.name}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span className="badge badge-info">
                        {f.cat}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          fontFamily:
                            "JetBrains Mono",
                          color: f.done
                            ? "#22c55e"
                            : "#64748b",
                        }}
                      >
                        {f.done
                          ? "Done"
                          : `${f.progress}%`}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      height: 4,
                      background: "#0f1e36",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${f.progress}%`,
                        background: f.error
                          ? "linear-gradient(90deg, #ef4444, #ef444488)"
                          : f.done
                          ? "linear-gradient(90deg, #22c55e, #22c55e88)"
                          : "linear-gradient(90deg, #00d4ff, #a855f7)",
                        borderRadius: 2,
                        transition:
                          "width 0.3s ease",
                      }}
                    />
                  </div>

                  {f.done && !f.error && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#22c55e",
                        margin: 0,
                      }}
                    >
                      ✓ Uploaded — AI processing
                      running in the background
                    </p>
                  )}

                  {f.error && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#ef4444",
                        margin: 0,
                      }}
                    >
                      ✗ {f.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT SIDE - AI EXTRACTION */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            className="card"
            style={{
              padding: "20px",
            }}
          >
            <h3
              style={{
                fontFamily: "Rajdhani",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#64748b",
                margin: "0 0 14px",
              }}
            >
              AI Extraction
            </h3>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {[
                {
                  label: "Persons",
                  color: "#00d4ff",
                },
                {
                  label: "Organizations",
                  color: "#a855f7",
                },
                {
                  label: "Locations",
                  color: "#f59e0b",
                },
                {
                  label: "Phone Numbers",
                  color: "#22c55e",
                },
                {
                  label: "Financial Accounts",
                  color: "#ef4444",
                },
              ].map((e) => (
                <div
                  key={e.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: e.color,
                      flexShrink: 0,
                    }}
                  />

                  <span
                    style={{
                      fontSize: 13,
                      color: "#94a3b8",
                    }}
                  >
                    {e.label}
                  </span>
                </div>
              ))}
            </div>

            <p
              style={{
                fontSize: 12,
                color: "#475569",
                marginTop: 14,
                lineHeight: 1.5,
              }}
            >
              AI automatically extracts and
              classifies entities from uploaded
              documents and adds them to the network
              graph — no separate step needed.
            </p>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────── */}
      {/* AI ASSISTANT */}
      {/* ───────────────────────────────────────── */}

      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#08111f",
          border: "1px solid #12314a",
          borderRadius: 12,
          padding: "20px 22px",
          boxShadow:
            "0 0 20px rgba(0, 180, 255, 0.06)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "Rajdhani",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#00d4ff",
            }}
          >
            AI Assistant
          </h2>

          <p
            style={{
              margin: "5px 0 0",
              fontSize: 13,
              color: "#64748b",
            }}
          >
            Ask questions about the evidence in
            the selected case.
          </p>
        </div>

        {/* SELECTED CASE */}
        <div
          style={{
            marginBottom: 12,
            fontSize: 12,
            color: "#64748b",
          }}
        >
          Current case:{" "}
          <span
            style={{
              color: "#00d4ff",
              fontWeight: 600,
            }}
          >
            {caseOptions.find(
              (o) => o.id === caseId
            )?.name || "No case selected"}
          </span>

          {caseId && (
            <span
              style={{
                marginLeft: 12,
                color:
                  assistantContext.length > 0
                    ? "#22c55e"
                    : "#f59e0b",
              }}
            >
              •{" "}
              {assistantContext.length > 0
                ? `${assistantContext.length} evidence source${
                    assistantContext.length > 1
                      ? "s"
                      : ""
                  } loaded`
                : "No new evidence loaded"}
            </span>
          )}
        </div>

        {/* QUESTION INPUT */}
        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          <input
            type="text"
            value={assistantQuestion}
            onChange={(e) =>
              setAssistantQuestion(
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !assistantLoading
              ) {
                handleAskAssistant();
              }
            }}
            placeholder={
              caseId
                ? "Ask about this case..."
                : "Select a case first..."
            }
            disabled={
              !caseId ||
              assistantLoading
            }
            style={{
              flex: 1,
              minWidth: 0,
              height: 42,
              boxSizing: "border-box",
              padding: "0 14px",
              borderRadius: 8,
              border: "1px solid #16405a",
              background: "#050a12",
              color: "#e2e8f0",
              outline: "none",
              fontSize: 13,
            }}
          />

          {/* ASK BUTTON */}
          <button
            type="button"
            onClick={handleAskAssistant}
            disabled={
              assistantLoading ||
              !assistantQuestion.trim() ||
              !caseId
            }
            style={{
              height: 42,
              padding: "0 20px",
              borderRadius: 8,
              border:
                "1px solid rgba(0,212,255,0.5)",
              background:
                assistantLoading ||
                !assistantQuestion.trim() ||
                !caseId
                  ? "#12314a"
                  : "#00a8cc",
              color:
                assistantLoading ||
                !assistantQuestion.trim() ||
                !caseId
                  ? "#64748b"
                  : "#031018",
              fontFamily: "Rajdhani",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.05em",
              cursor:
                assistantLoading ||
                !assistantQuestion.trim() ||
                !caseId
                  ? "not-allowed"
                  : "pointer",
              transition: "all 0.2s",
            }}
          >
            {assistantLoading
              ? "ASKING..."
              : "ASK"}
          </button>
        </div>

        {/* CONTEXT INFORMATION */}
        {caseId &&
          assistantContext.length === 0 &&
          !assistantAnswer && (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 11,
                color: "#64748b",
              }}
            >
              You can ask a question. For
              evidence-based answers, upload
              evidence for this case first.
            </p>
          )}

        {/* ERROR */}
        {assistantError && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 7,
              background:
                "rgba(239,68,68,0.08)",
              border:
                "1px solid rgba(239,68,68,0.25)",
              color: "#ef4444",
              fontSize: 12,
            }}
          >
            {assistantError}
          </div>
        )}

        {/* AI RESPONSE */}
        {assistantAnswer && (
          <div
            style={{
              marginTop: 16,
              padding: "16px",
              borderRadius: 8,
              background: "#050a12",
              border: "1px solid #12314a",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px",
                fontFamily: "Rajdhani",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#00d4ff",
              }}
            >
              AI Response
            </h3>

            <p
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: 13,
                lineHeight: 1.6,
                color: "#cbd5e1",
              }}
            >
              {assistantAnswer}
            </p>

            {/* SOURCES */}
            {assistantSources.length > 0 && (
              <div
                style={{
                  marginTop: 18,
                }}
              >
                <h4
                  style={{
                    margin: "0 0 10px",
                    fontFamily: "Rajdhani",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing:
                      "0.08em",
                    textTransform:
                      "uppercase",
                    color: "#64748b",
                  }}
                >
                  Sources
                </h4>

                <div
                  style={{
                    display: "flex",
                    flexDirection:
                      "column",
                    gap: 8,
                  }}
                >
                  {assistantSources.map(
                    (source, index) => (
                      <div
                        key={`${source.source_id}-${index}`}
                        style={{
                          padding:
                            "10px 12px",
                          borderRadius: 7,
                          background:
                            "#08111f",
                          border:
                            "1px solid #16405a",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color:
                              "#00b8e6",
                          }}
                        >
                          {source.source_type}{" "}
                          ·{" "}
                          {source.source_id}
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 12,
                            lineHeight: 1.5,
                            color:
                              "#94a3b8",
                          }}
                        >
                          {source.excerpt}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Network Graph ────────────────────────────────────────────────────────────
// Supports:
//   • All Cases      -> /api/graph
//   • Single Case    -> /api/graph/{caseId}
//   • All influencers -> /api/graph/influencers
//   • Case influencers -> /api/graph/{caseId}/influencers
//   • All timeline   -> /api/timeline/build-all
//   • Case timeline  -> /api/timeline/build-for-case
//   • Case priority  -> /api/priority/rank-suspects-for-case
//
// Empty caseId means "All Cases".
// A real caseId means ONLY that case's data is loaded.

// ---------------------------------------------------------------------------
// Entity type inference
//
// The backend doesn't consistently send a "type" field under the same key
// on every response shape (sometimes `type`, sometimes `entity_type`,
// sometimes nothing at all on relationship rows). Previously, any node
// missing a recognized type field silently defaulted to "Person" — that's
// why every node in the graph rendered the same color.
//
// This resolves the type from any of several possible field names, and
// when none of them are present/recognized, falls back to a name-based
// heuristic (e.g. "CryptoFront LLC" -> org, "Karachi Port" -> location)
// instead of defaulting blindly.
// ---------------------------------------------------------------------------

const ORG_NAME_PATTERN =
  /\b(llc|l\.l\.c\.|corp|corporation|inc|incorporated|ltd|limited|group|holdings?|trading|company|co\.?|enterprises?|partners?|industries|foundation|organi[sz]ation|bank|exchange|ventures?|capital|fund|agency)\b/i;

const LOCATION_NAME_PATTERN =
  /\b(port|airport|harbor|harbour|hub|terminal|border|crossing|warehouse|city|island|zone|district|freeport|station|dock|route|road|street|ave|avenue|building|plaza|tower|office)\b/i;

function guessEntityType(
  explicitType: unknown,
  name: string
): "person" | "org" | "location" {
  const normalized =
    typeof explicitType === "string" ? explicitType.trim().toLowerCase() : "";

  if (normalized) {
    if (
      normalized.includes("org") ||
      normalized.includes("company") ||
      normalized.includes("corp") ||
      normalized.includes("business") ||
      normalized.includes("entity_org")
    ) {
      return "org";
    }

    if (
      normalized.includes("location") ||
      normalized.includes("place") ||
      normalized.includes("geo") ||
      normalized.includes("site") ||
      normalized.includes("address")
    ) {
      return "location";
    }

    if (
      normalized.includes("person") ||
      normalized.includes("individual") ||
      normalized.includes("human")
    ) {
      return "person";
    }
  }

  // No usable explicit type — fall back to a heuristic based on the name
  // itself, rather than silently defaulting everyone to "person".
  if (ORG_NAME_PATTERN.test(name)) {
    return "org";
  }

  if (LOCATION_NAME_PATTERN.test(name)) {
    return "location";
  }

  return "person";
}

function resolveExplicitType(candidates: unknown[]): unknown {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c;
    }
  }
  return undefined;
}

function NetworkGraph({ caseId, onChangeCaseId }: { caseId: string; onChangeCaseId: (id: string) => void }) {
  const hasSession = api.hasSession();

  const ALL_CASES_OPTION = "All Cases";

  const [selected, setSelected] = useState<UiGraphNode | null>(null);

  const [tab, setTab] = useState<"graph" | "timeline" | "map">("graph");

  const [filterType, setFilterType] = useState("All");

  const [zoom, setZoom] = useState(1);

  const [pan, setPan] = useState({ x: 0, y: 0 });

  const dragging = useRef(false);

  const lastMouse = useRef({ x: 0, y: 0 });

  // ---------------------------------------------------------------------------
  // Graph canvas auto-fit + legend positioning
  //
  // The layout function positions nodes in a fixed-size arrangement. When a
  // case has few nodes (or the canvas is large), that arrangement ends up
  // small and clustered in one corner, leaving a big empty black area that
  // looks like something is covering the graph. This tracks the real pixel
  // size of the graph canvas and auto-fits/centers the node layout to fill
  // it, so the graph always uses the full available space regardless of
  // node count or screen size.
  //
  // It also tracks the canvas's on-screen left edge so the legend (below)
  // can be pinned with `position: fixed` to the true bottom of the browser
  // window — not the bottom of this canvas box, which may render shorter
  // than the full viewport depending on the surrounding page layout.
  //
  // A callback ref (rather than a plain useRef) is used so this correctly
  // re-attaches whenever the canvas div mounts/unmounts, e.g. when
  // switching away from and back to the Network Graph tab.
  // ---------------------------------------------------------------------------

  const [graphCanvasEl, setGraphCanvasEl] =
    useState<HTMLDivElement | null>(null);

  const graphCanvasRef = useCallback((el: HTMLDivElement | null) => {
    setGraphCanvasEl(el);
  }, []);

  const [graphViewport, setGraphViewport] = useState({
    width: 900,
    height: 600,
  });

  const [legendLeft, setLegendLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!graphCanvasEl) {
      setLegendLeft(null);
      return;
    }

    const updateMeasurements = () => {
      const rect = graphCanvasEl.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        setGraphViewport({ width: rect.width, height: rect.height });
      }

      // Fixed positioning is relative to the viewport, so we only need
      // the canvas's left edge — "bottom" is handled by the CSS itself.
      setLegendLeft(rect.left + 16);
    };

    updateMeasurements();

    const resizeObserver = new ResizeObserver(updateMeasurements);
    resizeObserver.observe(graphCanvasEl);

    // Covers cases the ResizeObserver won't catch on its own: the window
    // resizing without the canvas element itself resizing, or the page
    // scrolling (which moves the canvas's on-screen position).
    window.addEventListener("resize", updateMeasurements);
    window.addEventListener("scroll", updateMeasurements, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateMeasurements);
      window.removeEventListener("scroll", updateMeasurements, true);
    };
  }, [graphCanvasEl]);

  // ---------------------------------------------------------------------------
  // Case picker
  // ---------------------------------------------------------------------------

  const [caseOptions, setCaseOptions] = useState<
    { id: string; name: string }[]
  >([]);

  // ---------------------------------------------------------------------------
  // Graph
  // ---------------------------------------------------------------------------

  const [nodes, setNodes] = useState<UiGraphNode[]>([]);

  const [edges, setEdges] = useState<
    { from: string; to: string; label: string }[]
  >([]);

  const [influencers, setInfluencers] = useState<api.ApiInfluencer[]>([]);

  // Auto-fit the graph layout to the canvas whenever a new set of nodes
  // loads (or the canvas resizes). Must come after `nodes` is declared
  // above, since it reads from that state.
  useEffect(() => {
    const withCoords = nodes.filter(
      (n) => Number.isFinite(n.x) && Number.isFinite(n.y)
    );

    if (withCoords.length === 0) return;

    const xs = withCoords.map((n) => n.x as number);
    const ys = withCoords.map((n) => n.y as number);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const bboxWidth = Math.max(maxX - minX, 1);
    const bboxHeight = Math.max(maxY - minY, 1);

    // Room for node radius, labels below nodes, and the legend overlay.
    const PADDING = 90;

    const availableWidth = Math.max(
      graphViewport.width - PADDING * 2,
      100
    );
    const availableHeight = Math.max(
      graphViewport.height - PADDING * 2,
      100
    );

    const fitZoom = Math.min(
      availableWidth / bboxWidth,
      availableHeight / bboxHeight,
      2 // never zoom in further than the manual zoom-in cap
    );

    const clampedZoom = Math.max(0.5, Math.min(2, fitZoom));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Matches the render transform: translate(pan.x + 40, pan.y + 40) scale(zoom)
    setZoom(clampedZoom);
    setPan({
      x: graphViewport.width / 2 - 40 - centerX * clampedZoom,
      y: graphViewport.height / 2 - 40 - centerY * clampedZoom,
    });
  }, [nodes, graphViewport.width, graphViewport.height]);

  const [graphLoading, setGraphLoading] = useState(false);

  const [graphError, setGraphError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Priority / Suspects
  // ---------------------------------------------------------------------------

  const [rankedSuspects, setRankedSuspects] = useState<
    AIApi.RankedSuspect[]
  >([]);

  const [suspectsLoading, setSuspectsLoading] = useState(false);

  const [suspectsError, setSuspectsError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Timeline
  // ---------------------------------------------------------------------------

  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);

  const [timelineGaps, setTimelineGaps] = useState<any[]>([]);

  const [timelineLoading, setTimelineLoading] = useState(false);

  const [timelineError, setTimelineError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Case picker options
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!hasSession) {
      setCaseOptions([]);
      return;
    }

    let cancelled = false;

    api
      .getCases({ status: "ALL" })
      .then((list) => {
        if (cancelled) return;

        setCaseOptions(
          list.map((c) => ({
            id: c.id,
            name: c.operationName,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCaseOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  // ---------------------------------------------------------------------------
  // Case dropdown values
  //
  // (single source of truth — no duplicate declarations)
  // ---------------------------------------------------------------------------

  const dropdownValue =
    caseOptions.find((o) => o.id === caseId)?.name ?? ALL_CASES_OPTION;

  const dropdownOptions = [
    ALL_CASES_OPTION,
    ...caseOptions.map((o) => o.name),
  ];

  // ---------------------------------------------------------------------------
  // Graph + Influencers
  //
  // Empty caseId = All Cases.
  // Real caseId = selected case ONLY.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!hasSession) {
      setNodes([]);
      setEdges([]);
      setInfluencers([]);
      setSelected(null);
      setGraphError(null);
      return;
    }

    let cancelled = false;

    // IMPORTANT:
    // Empty string means All Cases.
    // A real ID means one specific case.
    const effectiveCaseId = caseId || undefined;

    // Clear old case data immediately.
    setNodes([]);
    setEdges([]);
    setInfluencers([]);
    setSelected(null);

    setGraphLoading(true);
    setGraphError(null);

    Promise.all([
      AIApi.getCaseGraph(effectiveCaseId),
      AIApi.getCaseInfluencers(effectiveCaseId),
    ])
      .then(([graph, infl]) => {
        if (cancelled) return;

        // ---------------------------------------------------------------------
        // Graph response
        //
        // New backend response is expected to contain:
        //
        // {
        //   graph: [...],
        //   scope: ...
        // }
        //
        // We also keep compatibility with a response that directly contains
        // nodes/edges.
        // ---------------------------------------------------------------------

        const graphData = graph as Record<string, any>;

        const rawGraph = Array.isArray(graphData?.graph)
          ? graphData.graph
          : [];

        const rawNodes = Array.isArray(graphData?.nodes)
          ? graphData.nodes
          : [];

        const rawEdges = Array.isArray(graphData?.edges)
          ? graphData.edges
          : [];

        // ---------------------------------------------------------------------
        // If backend gives graph relationship rows, convert them into nodes
        // and edges.
        // ---------------------------------------------------------------------

        let graphNodes: any[] = [];
        let graphEdges: any[] = [];

        if (rawNodes.length > 0) {
          graphNodes = rawNodes;
          graphEdges = rawEdges;
        } else if (rawGraph.length > 0) {
          const nodeMap = new Map<string, any>();

          rawGraph.forEach((item: any) => {
            if (!item || typeof item !== "object") return;

            const sourceName =
              item.source_name ??
              item.source ??
              item.entity_a ??
              item.from;

            const targetName =
              item.target_name ??
              item.target ??
              item.entity_b ??
              item.to;

            const sourceTypeRaw = resolveExplicitType([
              item.source_type,
              item.source_entity_type,
              item.sourceType,
              item.source_category,
              item.entity_type,
              item.type,
            ]);

            const targetTypeRaw = resolveExplicitType([
              item.target_type,
              item.target_entity_type,
              item.targetType,
              item.target_category,
              item.entity_type,
              item.type,
            ]);

            const sourceType = guessEntityType(
              sourceTypeRaw,
              typeof sourceName === "string" ? sourceName : ""
            );

            const targetType = guessEntityType(
              targetTypeRaw,
              typeof targetName === "string" ? targetName : ""
            );

            const relationship =
              item.relationship_type ??
              item.relation_type ??
              item.relation ??
              item.label ??
              "";

            if (typeof sourceName === "string" && sourceName.trim()) {
              if (!nodeMap.has(sourceName)) {
                nodeMap.set(sourceName, {
                  id: sourceName,
                  name: sourceName,
                  entity_name: sourceName,
                  entity_type: sourceType,
                  type: sourceType,
                  risk: Number(item.source_risk ?? item.risk ?? 0),
                });
              }
            }

            if (typeof targetName === "string" && targetName.trim()) {
              if (!nodeMap.has(targetName)) {
                nodeMap.set(targetName, {
                  id: targetName,
                  name: targetName,
                  entity_name: targetName,
                  entity_type: targetType,
                  type: targetType,
                  risk: Number(item.target_risk ?? item.risk ?? 0),
                });
              }
            }

            if (
              typeof sourceName === "string" &&
              typeof targetName === "string" &&
              sourceName.trim() &&
              targetName.trim()
            ) {
              graphEdges.push({
                from: sourceName,
                to: targetName,
                label: relationship,
              });
            }
          });

          graphNodes = Array.from(nodeMap.values());
        }

        // ---------------------------------------------------------------------
        // Normalize nodes into the UI shape.
        // ---------------------------------------------------------------------

        const normalizedNodes: UiGraphNode[] = graphNodes.map(
          (rawNode: any) => {
            const explicitType = resolveExplicitType([
              rawNode.type,
              rawNode.entity_type,
              rawNode.entityType,
              rawNode.node_type,
              rawNode.nodeType,
              rawNode.category,
              rawNode.classification,
            ]);

            const name =
              rawNode.label ??
              rawNode.name ??
              rawNode.entity_name ??
              rawNode.entityName ??
              rawNode.id ??
              "Unknown";

            const type = guessEntityType(explicitType, String(name));

            return {
              ...rawNode,
              id: String(
                rawNode.id ??
                  rawNode.entity_id ??
                  rawNode.entity_name ??
                  rawNode.name ??
                  name
              ),
              label: String(name),
              type,
              role: String(
                rawNode.role ??
                  rawNode.entity_role ??
                  rawNode.description ??
                  ""
              ),
              risk: Math.max(
                0,
                Math.min(
                  100,
                  Number(
                    rawNode.risk ??
                      rawNode.risk_score ??
                      rawNode.priority_score ??
                      0
                  )
                )
              ),
              x:
                Number.isFinite(Number(rawNode.x)) &&
                Number.isFinite(Number(rawNode.y))
                  ? Number(rawNode.x)
                  : undefined,
              y:
                Number.isFinite(Number(rawNode.x)) &&
                Number.isFinite(Number(rawNode.y))
                  ? Number(rawNode.y)
                  : undefined,
            } as UiGraphNode;
          }
        );

        // ---------------------------------------------------------------------
        // Use your existing circular fallback layout when backend doesn't
        // provide coordinates.
        // ---------------------------------------------------------------------

        const laidOutNodes = layoutGraphNodes(normalizedNodes);

        setNodes(laidOutNodes);

        // ---------------------------------------------------------------------
        // Normalize edges.
        // ---------------------------------------------------------------------

        const normalizedEdges = graphEdges
          .map((e: any) => {
            const from =
              e.from ??
              e.source ??
              e.source_name ??
              e.entity_a;

            const to =
              e.to ??
              e.target ??
              e.target_name ??
              e.entity_b;

            const label =
              e.label ??
              e.relationship_type ??
              e.relation_type ??
              e.relation ??
              "";

            if (
              typeof from !== "string" ||
              typeof to !== "string"
            ) {
              return null;
            }

            return {
              from,
              to,
              label: String(label),
            };
          })
          .filter(
            (
              e
            ): e is {
              from: string;
              to: string;
              label: string;
            } => e !== null
          );

        setEdges(normalizedEdges);

        // ---------------------------------------------------------------------
        // Influencers
        //
        // Backend may return:
        //   { influencers: [...] }
        //
        // or directly:
        //   [...]
        // ---------------------------------------------------------------------

        const influencerData = infl as any;

        const normalizedInfluencers = Array.isArray(influencerData)
          ? influencerData
          : Array.isArray(influencerData?.influencers)
            ? influencerData.influencers
            : [];

        setInfluencers(
          normalizedInfluencers.map((inf: any) => ({
            ...inf,
            name: String(
              inf.name ??
                inf.entity_name ??
                inf.entityName ??
                inf.label ??
                "Unknown"
            ),
            score: Math.max(
              0,
              Math.min(
                100,
                Number(
                  inf.score ??
                    inf.influence_score ??
                    inf.priority_score ??
                    inf.degree ??
                    0
                )
              )
            ),
          }))
        );
      })
      .catch((error) => {
        if (cancelled) return;

        setNodes([]);
        setEdges([]);
        setInfluencers([]);

        setGraphError(
          error instanceof Error
            ? error.message
            : "Couldn't load the network graph."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setGraphLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, hasSession]);

  // ---------------------------------------------------------------------------
  // Priority / Suspect ranking
  //
  // IMPORTANT:
  // Priority is ONLY calculated for a real case.
  // All Cases does NOT reuse a previous case's suspect ranking.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!hasSession || !caseId) {
      setRankedSuspects([]);
      setSuspectsError(null);
      setSuspectsLoading(false);
      return;
    }

    let cancelled = false;

    // Clear previous case's priority immediately.
    setRankedSuspects([]);
    setSuspectsError(null);
    setSuspectsLoading(true);

    AIApi.rankSuspectsForCase(caseId)
      .then((result) => {
        if (cancelled) return;

        setRankedSuspects(result.ranked_suspects ?? []);
      })
      .catch((error) => {
        if (cancelled) return;

        setRankedSuspects([]);

        setSuspectsError(
          error instanceof Error
            ? error.message
            : "Couldn't rank suspects."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setSuspectsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, hasSession]);

  // ---------------------------------------------------------------------------
  // Timeline
  //
  // Matches the Network Graph tab's handling of scope: an empty caseId
  // means "All Cases" and is passed through as `undefined` so the
  // backend routes to /api/timeline/build-all, while a real caseId
  // routes to /api/timeline/build-for-case. Timeline now loads for
  // every case scenario, not just a specifically selected one.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!hasSession) {
      setTimelineEvents([]);
      setTimelineGaps([]);
      setTimelineError(null);
      setTimelineLoading(false);
      return;
    }

    // Only load timeline when Timeline tab is opened.
    if (tab !== "timeline") return;

    let cancelled = false;

    // Empty string means All Cases — same convention as the graph fetch.
    const effectiveCaseId = caseId || undefined;

    // Clear previous timeline immediately.
    setTimelineEvents([]);
    setTimelineGaps([]);
    setTimelineError(null);
    setTimelineLoading(true);

    AIApi.buildTimeline(effectiveCaseId)
      .then((result) => {
        if (cancelled) return;

        const data = result as any;

        // Backend timeline response:
        //
        // {
        //   events: [...],
        //   gaps_detected: [...]
        // }
        //
        // Keep a few compatibility fallbacks.

        const events = Array.isArray(data?.events)
          ? data.events
          : Array.isArray(data?.timeline_events)
            ? data.timeline_events
            : Array.isArray(data?.timeline)
              ? data.timeline
              : [];

        const gaps = Array.isArray(data?.gaps_detected)
          ? data.gaps_detected
          : Array.isArray(data?.gaps)
            ? data.gaps
            : [];

        setTimelineEvents(events);
        setTimelineGaps(gaps);
      })
      .catch((error) => {
        if (cancelled) return;

        setTimelineEvents([]);
        setTimelineGaps([]);

        setTimelineError(
          error instanceof Error
            ? error.message
            : "Couldn't load the timeline."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setTimelineLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tab, caseId, hasSession]);

  // ---------------------------------------------------------------------------
  // Node colors
  // ---------------------------------------------------------------------------

  const typeColors: Record<string, string> = {
    person: "#00d4ff",
    org: "#a855f7",
    location: "#f59e0b",
  };

  // ---------------------------------------------------------------------------
  // Graph filters
  // ---------------------------------------------------------------------------

  const visibleNodes =
    filterType === "All"
      ? nodes
      : nodes.filter(
          (n) => n.type === filterType.toLowerCase()
        );

  const visibleIds = new Set(
    visibleNodes.map((n) => n.id)
  );

  const visibleEdges = edges.filter(
    (e) =>
      visibleIds.has(e.from) &&
      visibleIds.has(e.to)
  );

  function getNode(id: string) {
    return nodes.find((n) => n.id === id);
  }

  // ---------------------------------------------------------------------------
  // Mouse controls
  // ---------------------------------------------------------------------------

  function onMouseDown(
    e: React.MouseEvent<SVGSVGElement>
  ) {
    if (
      (e.target as SVGElement).closest(
        ".node-circle"
      )
    ) {
      return;
    }

    dragging.current = true;

    lastMouse.current = {
      x: e.clientX,
      y: e.clientY,
    };
  }

  function onMouseMove(
    e: React.MouseEvent<SVGSVGElement>
  ) {
    if (!dragging.current) return;

    setPan((p) => ({
      x:
        p.x +
        e.clientX -
        lastMouse.current.x,

      y:
        p.y +
        e.clientY -
        lastMouse.current.y,
    }));

    lastMouse.current = {
      x: e.clientX,
      y: e.clientY,
    };
  }

  function onMouseUp() {
    dragging.current = false;
  }

  function onWheel(
    e: React.WheelEvent<SVGSVGElement>
  ) {
    e.preventDefault();

    setZoom((z) =>
      Math.max(
        0.5,
        Math.min(
          2,
          z - e.deltaY * 0.001
        )
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Case change
  //
  // Resets the selected-entity side panel so a stale entity from the
  // previous case never lingers after switching cases (or back to
  // "All Cases").
  // ---------------------------------------------------------------------------

  function handleCaseChange(
    selectedName: string
  ) {
    setSelected(null);

    if (selectedName === ALL_CASES_OPTION) {
      onChangeCaseId("");
      return;
    }

    const selectedCase = caseOptions.find(
      (c) => c.name === selectedName
    );

    onChangeCaseId(selectedCase?.id ?? "");
  }

  // ---------------------------------------------------------------------------
  // Timeline helpers
  // ---------------------------------------------------------------------------

  function getTimelineEventType(
    event: any
  ): string {
    const raw =
      event?.event_type ??
      event?.type ??
      event?.category ??
      "event";

    return String(raw).toLowerCase();
  }

  function getTimelineEventColor(
    event: any
  ): string {
    const type =
      getTimelineEventType(event);

    if (
      type.includes("financial") ||
      type.includes("transaction") ||
      type.includes("bank")
    ) {
      return "#f59e0b";
    }

    if (
      type.includes("communication") ||
      type.includes("call") ||
      type.includes("cdr")
    ) {
      return "#00d4ff";
    }

    if (
      type.includes("location") ||
      type.includes("movement") ||
      type.includes("geo")
    ) {
      return "#a855f7";
    }

    if (
      type.includes("organization") ||
      type.includes("org")
    ) {
      return "#22c55e";
    }

    if (
      type.includes("meeting") ||
      type.includes("incident")
    ) {
      return "#ef4444";
    }

    return "#64748b";
  }

  function getTimelineDescription(
    event: any
  ): string {
    return String(
      event?.description ??
        event?.label ??
        event?.event_description ??
        event?.summary ??
        "Investigation event"
    );
  }

  function getTimelineEntities(
    event: any
  ): string {
    const entities =
      event?.entities_involved ??
      event?.entities ??
      event?.entity ??
      "";

    if (Array.isArray(entities)) {
      return entities
        .map((e: any) => {
          if (typeof e === "string") return e;

          return String(
            e?.name ??
              e?.entity_name ??
              e?.label ??
              e?.id ??
              ""
          );
        })
        .filter(Boolean)
        .join(", ");
    }

    return String(entities || "");
  }

  function getTimelineDate(
    event: any
  ): string {
    const value =
      event?.timestamp ??
      event?.time ??
      event?.datetime ??
      event?.date ??
      "";

    if (!value) return "Unknown date";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString();
  }

  function getTimelineTime(
    event: any
  ): string {
    const value =
      event?.timestamp ??
      event?.time ??
      event?.datetime ??
      "";

    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ---------------------------------------------------------------------------
  // Timeline gap formatting
  //
  // The backend sometimes sends each gap as a raw JSON string, e.g.:
  //   '{"from":"2026-09-08T14:05:22","to":"2026-09-09T09:20:11","gap_hours":19.25}'
  // instead of an object. Previously this hit the `typeof gap === "string"`
  // branch and got rendered verbatim, which is why raw JSON showed up in the
  // UI. This parses that string (when possible) and turns it into a plain,
  // human-readable sentence instead.
  // ---------------------------------------------------------------------------

  function formatTimelineGap(gap: any): string {
    let data = gap;

    if (typeof gap === "string") {
      try {
        data = JSON.parse(gap);
      } catch {
        // Not JSON — it's genuinely plain text, show as-is.
        return gap;
      }
    }

    if (data && typeof data === "object") {
      const from = data.from ? new Date(data.from) : null;
      const to = data.to ? new Date(data.to) : null;
      const hours = Number(data.gap_hours ?? data.hours ?? 0);

      const fmt = (d: Date) =>
        d.toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

      if (
        from &&
        to &&
        !Number.isNaN(from.getTime()) &&
        !Number.isNaN(to.getTime())
      ) {
        const hoursText =
          hours >= 1
            ? `${hours.toFixed(1)} hour${hours === 1 ? "" : "s"}`
            : `${Math.round(hours * 60)} minutes`;

        return `No activity for ${hoursText} — between ${fmt(from)} and ${fmt(to)}`;
      }

      return String(
        data.description ??
          data.reason ??
          data.message ??
          "Gap detected in timeline"
      );
    }

    return "Gap detected in timeline";
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
        // Anchors this component's box as the positioning context, so any
        // stray absolute/fixed-positioned descendant (from this component
        // or elsewhere) is contained to this area instead of covering the
        // full viewport when a node is selected.
        position: "relative",
      }}
    >
      {/* =====================================================================
          MAIN CONTENT
          ===================================================================== */}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ===================================================================
            Tabs
            =================================================================== */}

        <div
          style={{
            display: "flex",
            gap: 0,
            alignItems: "center",
            flexWrap: "wrap",
            borderBottom:
              "1px solid #0f1e36",
            padding: "0 20px",
            background: "#070e1b",
            flexShrink: 0,
          }}
        >
          {[
            {
              id: "graph",
              icon: "network",
              label: "Network Graph",
            },
            {
              id: "timeline",
              icon: "timeline",
              label: "Timeline",
            },
            {
              id: "map",
              icon: "map",
              label: "Map View",
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() =>
                setTab(
                  t.id as typeof tab
                )
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "14px 20px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${
                  tab === t.id
                    ? "#00d4ff"
                    : "transparent"
                }`,
                color:
                  tab === t.id
                    ? "#00d4ff"
                    : "#64748b",
                fontFamily:
                  "Rajdhani",
                fontWeight: 600,
                fontSize: 13,
                letterSpacing:
                  "0.06em",
                textTransform:
                  "uppercase",
                cursor: "pointer",
                marginBottom: -1,
                transition:
                  "all 0.2s",
              }}
            >
              <Icon
                name={t.icon}
                size={14}
              />

              {t.label}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* ===============================================================
              CASE PICKER
              =============================================================== */}

          <div
            style={{
              width: 220,
              padding: "8px 0",
            }}
          >
            <select
              value={dropdownValue}
              onChange={(e) =>
                handleCaseChange(
                  e.target.value
                )
              }
              className="input-field"
              style={{
                width: "100%",
                height: 36,
                background: "#0a1628",
                border: "1px solid #1a2d4a",
                borderRadius: 6,
                padding:
                  "6px 10px",
                fontSize: 12,
                fontFamily:
                  "Rajdhani",
                fontWeight: 600,
                letterSpacing:
                  "0.04em",
                color: "#e2e8f0",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {dropdownOptions.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                    style={{
                      background:
                        "#0a1628",
                      color:
                        "#e2e8f0",
                    }}
                  >
                    {option}
                  </option>
                )
              )}
            </select>
          </div>

          {/* ===============================================================
              GRAPH FILTERS
              =============================================================== */}

          {tab === "graph" && (
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems:
                  "center",
                padding:
                  "8px 0 8px 12px",
              }}
            >
              {[
                "All",
                "Person",
                "Org",
                "Location",
              ].map((f) => (
                <button
                  key={f}
                  onClick={() =>
                    setFilterType(f)
                  }
                  style={{
                    padding:
                      "5px 12px",
                    borderRadius: 20,
                    fontFamily:
                      "JetBrains Mono",
                    fontSize: 11,
                    cursor:
                      "pointer",
                    transition:
                      "all 0.2s",
                    border:
                      filterType === f
                        ? `1px solid ${
                            f === "All"
                              ? "#00d4ff"
                              : f ===
                                  "Person"
                                ? "#00d4ff"
                                : f ===
                                    "Org"
                                  ? "#a855f7"
                                  : "#f59e0b"
                          }44`
                        : "1px solid #1a2d4a",
                    background:
                      filterType === f
                        ? "rgba(255,255,255,0.05)"
                        : "transparent",
                    color:
                      filterType === f
                        ? "#e2e8f0"
                        : "#475569",
                  }}
                >
                  {f}
                </button>
              ))}

              <div
                style={{
                  width: 1,
                  height: 20,
                  background:
                    "#1a2d4a",
                  margin: "0 4px",
                }}
              />

              <button
                onClick={() =>
                  setZoom((z) =>
                    Math.min(
                      2,
                      z + 0.1
                    )
                  )
                }
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background:
                    "rgba(255,255,255,0.04)",
                  border:
                    "1px solid #1a2d4a",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                }}
              >
                +
              </button>

              <button
                onClick={() =>
                  setZoom((z) =>
                    Math.max(
                      0.5,
                      z - 0.1
                    )
                  )
                }
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background:
                    "rgba(255,255,255,0.04)",
                  border:
                    "1px solid #1a2d4a",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                }}
              >
                -
              </button>
            </div>
          )}
        </div>

        {/* ===================================================================
            GRAPH
            =================================================================== */}

        {tab === "graph" && (
          <div
            ref={graphCanvasRef}
            style={{
              flex: 1,
              position:
                "relative",
              overflow:
                "hidden",
              background:
                "#050a12",
            }}
          >
            <div
              className="hex-pattern"
              style={{
                position:
                  "absolute",
                inset: 0,
                opacity: 0.6,
              }}
            />

            {!hasSession && (
              <div
                style={{
                  position:
                    "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  color: "#475569",
                  fontFamily:
                    "JetBrains Mono",
                  fontSize: 13,
                  textAlign:
                    "center",
                  padding: 24,
                }}
              >
                Log in to view
                the network
                graph.
              </div>
            )}

            {hasSession &&
              graphLoading && (
                <div
                  style={{
                    position:
                      "absolute",
                    inset: 0,
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    color:
                      "#475569",
                    fontFamily:
                      "JetBrains Mono",
                    fontSize: 13,
                  }}
                >
                  Loading network
                  graph…
                </div>
              )}

            {hasSession &&
              !graphLoading &&
              graphError && (
                <div
                  style={{
                    position:
                      "absolute",
                    inset: 0,
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    color:
                      "#ef4444",
                    fontFamily:
                      "JetBrains Mono",
                    fontSize: 13,
                    textAlign:
                      "center",
                    padding: 24,
                  }}
                >
                  {graphError}
                </div>
              )}

            {hasSession &&
              !graphLoading &&
              !graphError &&
              nodes.length === 0 && (
                <div
                  style={{
                    position:
                      "absolute",
                    inset: 0,
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    color:
                      "#475569",
                    fontFamily:
                      "JetBrains Mono",
                    fontSize: 13,
                    textAlign:
                      "center",
                    padding: 24,
                  }}
                >
                  {caseId
                    ? "No entities extracted for this case yet."
                    : "No network entities found across the available cases."}
                </div>
              )}

            {hasSession &&
              !graphLoading &&
              !graphError &&
              nodes.length > 0 && (
                <svg
                  style={{
                    position:
                      "absolute",
                    inset: 0,
                    width:
                      "100%",
                    height:
                      "100%",
                    cursor: "grab",
                  }}
                  onMouseDown={
                    onMouseDown
                  }
                  onMouseMove={
                    onMouseMove
                  }
                  onMouseUp={
                    onMouseUp
                  }
                  onMouseLeave={
                    onMouseUp
                  }
                  onWheel={
                    onWheel
                  }
                >
                  <defs>
                    <marker
                      id="arrow"
                      markerWidth="6"
                      markerHeight="6"
                      refX="5"
                      refY="3"
                      orient="auto"
                    >
                      <path
                        d="M 0 0 L 6 3 L 0 6 Z"
                        fill="#1a2d4a"
                      />
                    </marker>

                    {Object.entries(
                      typeColors
                    ).map(
                      ([t, c]) => (
                        <radialGradient
                          key={t}
                          id={`node-grad-${t}`}
                          cx="35%"
                          cy="35%"
                          r="65%"
                        >
                          <stop
                            offset="0%"
                            stopColor={
                              c
                            }
                            stopOpacity={
                              0.9
                            }
                          />

                          <stop
                            offset="100%"
                            stopColor={
                              c
                            }
                            stopOpacity={
                              0.3
                            }
                          />
                        </radialGradient>
                      )
                    )}
                  </defs>

                  <g
                    transform={`translate(${
                      pan.x + 40
                    },${
                      pan.y + 40
                    }) scale(${zoom})`}
                  >
                    {/* Edges */}

                    {visibleEdges.map(
                      (e, i) => {
                        const from =
                          getNode(
                            e.from
                          );

                        const to =
                          getNode(
                            e.to
                          );

                        if (
                          !from ||
                          !to
                        ) {
                          return null;
                        }

                        const mx =
                          (from.x +
                            to.x) /
                          2;

                        const my =
                          (from.y +
                            to.y) /
                          2;

                        const isHighlighted =
                          selected &&
                          (selected.id ===
                            e.from ||
                            selected.id ===
                              e.to);

                        return (
                          <g
                            key={i}
                          >
                            <line
                              x1={
                                from.x
                              }
                              y1={
                                from.y
                              }
                              x2={
                                to.x
                              }
                              y2={
                                to.y
                              }
                              stroke={
                                isHighlighted
                                  ? "#00d4ff"
                                  : "#1a2d4a"
                              }
                              strokeWidth={
                                isHighlighted
                                  ? 1.5
                                  : 1
                              }
                              strokeOpacity={
                                isHighlighted
                                  ? 0.8
                                  : 0.5
                              }
                              markerEnd="url(#arrow)"
                            />

                            <text
                              x={mx}
                              y={my}
                              textAnchor="middle"
                              fontSize="9"
                              fill="#475569"
                              fontFamily="JetBrains Mono"
                              style={{
                                pointerEvents:
                                  "none",
                              }}
                            >
                              {
                                e.label
                              }
                            </text>
                          </g>
                        );
                      }
                    )}

                    {/* Nodes */}

                    {visibleNodes.map(
                      (n) => {
                        const color =
                          typeColors[
                            n.type
                          ] ||
                          "#64748b";

                        const isSelected =
                          selected?.id ===
                          n.id;

                        const r =
                          n.type ===
                          "person"
                            ? 22
                            : n.type ===
                                "org"
                              ? 20
                              : 18;

                        return (
                          <g
                            key={
                              n.id
                            }
                            className="node-circle"
                            onClick={() =>
                              setSelected(
                                isSelected
                                  ? null
                                  : n
                              )
                            }
                            style={{
                              cursor:
                                "pointer",
                            }}
                          >
                            {isSelected && (
                              <circle
                                cx={
                                  n.x
                                }
                                cy={
                                  n.y
                                }
                                r={
                                  r +
                                  10
                                }
                                fill={
                                  color
                                }
                                opacity={
                                  0.08
                                }
                              />
                            )}

                            <circle
                              cx={
                                n.x
                              }
                              cy={
                                n.y
                              }
                              r={
                                r + 4
                              }
                              fill="none"
                              stroke={
                                isSelected
                                  ? color
                                  : `${color}33`
                              }
                              strokeWidth={
                                isSelected
                                  ? 1.5
                                  : 1
                              }
                            />

                            <circle
                              cx={
                                n.x
                              }
                              cy={
                                n.y
                              }
                              r={r}
                              fill={`url(#node-grad-${n.type})`}
                              stroke={
                                color
                              }
                              strokeWidth={
                                isSelected
                                  ? 2
                                  : 1
                              }
                            />

                            {/* Risk indicator */}

                            <circle
                              cx={
                                n.x
                              }
                              cy={
                                n.y
                              }
                              r={
                                r -
                                3
                              }
                              fill="none"
                              stroke={
                                n.risk >
                                80
                                  ? "#ef4444"
                                  : n.risk >
                                      60
                                    ? "#f59e0b"
                                    : "#22c55e"
                              }
                              strokeWidth={
                                2
                              }
                              strokeDasharray={`${(n.risk / 100) * 2 * Math.PI * (r - 3)} ${
                                2 *
                                Math.PI *
                                (r -
                                  3)
                              }`}
                              transform={`rotate(-90 ${n.x} ${n.y})`}
                              opacity={
                                0.6
                              }
                            />

                            <text
                              x={
                                n.x
                              }
                              y={
                                n.y
                              }
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={
                                n.type ===
                                "person"
                                  ? "8"
                                  : "7"
                              }
                              fill="white"
                              fontFamily="JetBrains Mono"
                              fontWeight="500"
                              style={{
                                pointerEvents:
                                  "none",
                              }}
                            >
                              {
                                n.label.split(
                                  " "
                                )[0]
                              }
                            </text>

                            <text
                              x={
                                n.x
                              }
                              y={
                                n.y +
                                r +
                                12
                              }
                              textAnchor="middle"
                              fontSize="10"
                              fill="#94a3b8"
                              fontFamily="Rajdhani"
                              fontWeight="600"
                              style={{
                                pointerEvents:
                                  "none",
                              }}
                            >
                              {
                                n.label
                              }
                            </text>
                          </g>
                        );
                      }
                    )}
                  </g>
                </svg>
              )}

            {/* Legend moved to the outermost wrapper — see below — so it
                stays fixed regardless of graph pan/zoom/selection. */}
          </div>
        )}

        {/* ===================================================================
            TIMELINE
            =================================================================== */}

        {tab === "timeline" && (
          <div
            style={{
              flex: 1,
              padding:
                "30px 40px",
              overflowY:
                "auto",
            }}
          >
            {!caseId && (
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  minHeight: 200,
                  color:
                    "#475569",
                  fontFamily:
                    "JetBrains Mono",
                  fontSize: 13,
                  textAlign:
                    "center",
                  padding: 24,
                }}
              >
                Timeline should only be viewed for a particular case. Select a case above.
              </div>
            )}

            {caseId && timelineLoading && (
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  minHeight: 200,
                  color:
                    "#475569",
                  fontFamily:
                    "JetBrains Mono",
                  fontSize: 13,
                }}
              >
                Loading timeline…
              </div>
            )}

            {caseId &&
              !timelineLoading &&
              timelineError && (
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    minHeight: 200,
                    color:
                      "#ef4444",
                    fontFamily:
                      "JetBrains Mono",
                    fontSize: 13,
                    textAlign:
                      "center",
                  }}
                >
                  {timelineError}
                </div>
              )}

            {caseId &&
              !timelineLoading &&
              !timelineError &&
              timelineEvents.length ===
                0 && (
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    minHeight: 200,
                    color:
                      "#475569",
                    fontFamily:
                      "JetBrains Mono",
                    fontSize: 13,
                    textAlign:
                      "center",
                  }}
                >
                  No timeline events found for this case.
                </div>
              )}

            {caseId &&
              !timelineLoading &&
              !timelineError &&
              timelineEvents.length >
                0 && (
                <>
                  <div
                    style={{
                      position:
                        "relative",
                      paddingLeft: 32,
                    }}
                  >
                    <div
                      style={{
                        position:
                          "absolute",
                        left: 15,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background:
                          "linear-gradient(to bottom, #00d4ff44, #1a2d4a)",
                      }}
                    />

                    {timelineEvents.map(
                      (
                        ev,
                        i
                      ) => {
                        const c =
                          getTimelineEventColor(
                            ev
                          );

                        const type =
                          getTimelineEventType(
                            ev
                          );

                        const description =
                          getTimelineDescription(
                            ev
                          );

                        const entities =
                          getTimelineEntities(
                            ev
                          );

                        const date =
                          getTimelineDate(
                            ev
                          );

                        const time =
                          getTimelineTime(
                            ev
                          );

                        return (
                          <div
                            key={
                              ev?.id ??
                              i
                            }
                            style={{
                              display:
                                "flex",
                              gap: 20,
                              marginBottom:
                                28,
                              position:
                                "relative",
                              animationDelay: `${i * 0.06}s`,
                            }}
                            className="animate-fade-in-up"
                          >
                            <div
                              style={{
                                position:
                                  "absolute",
                                left: -24,
                                top: 14,
                                width: 12,
                                height: 12,
                                borderRadius:
                                  "50%",
                                background:
                                  c,
                                border:
                                  "2px solid #050a12",
                                zIndex: 1,
                              }}
                            />

                            <div
                              className="card"
                              style={{
                                flex: 1,
                                padding:
                                  "14px 18px",
                              }}
                            >
                              <div
                                style={{
                                  display:
                                    "flex",
                                  justifyContent:
                                    "space-between",
                                  alignItems:
                                    "flex-start",
                                  gap: 16,
                                }}
                              >
                                <div
                                  style={{
                                    minWidth: 0,
                                  }}
                                >
                                  <p
                                    style={{
                                      fontSize: 14,
                                      color:
                                        "#e2e8f0",
                                      margin: 0,
                                      fontWeight: 500,
                                    }}
                                  >
                                    {
                                      description
                                    }
                                  </p>

                                  {entities && (
                                    <p
                                      style={{
                                        fontSize: 12,
                                        color:
                                          "#64748b",
                                        margin:
                                          "4px 0 0",
                                        fontFamily:
                                          "JetBrains Mono",
                                      }}
                                    >
                                      {
                                        entities
                                      }
                                    </p>
                                  )}
                                </div>

                                <div
                                  style={{
                                    textAlign:
                                      "right",
                                    flexShrink: 0,
                                  }}
                                >
                                  <span
                                    className="badge"
                                    style={{
                                      background: `${c}18`,
                                      color: c,
                                      border: `1px solid ${c}33`,
                                    }}
                                  >
                                    {
                                      type
                                    }
                                  </span>

                                  <p
                                    style={{
                                      fontSize: 11,
                                      fontFamily:
                                        "JetBrains Mono",
                                      color:
                                        "#475569",
                                      margin:
                                        "4px 0 0",
                                    }}
                                  >
                                    {date}
                                    {time
                                      ? ` · ${time}`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* Timeline gaps */}

                  {timelineGaps.length >
                    0 && (
                    <div
                      className="card"
                      style={{
                        marginTop: 10,
                        padding:
                          "16px 18px",
                        borderColor:
                          "rgba(245,158,11,0.25)",
                      }}
                    >
                      <h4
                        style={{
                          fontFamily:
                            "Rajdhani",
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing:
                            "0.08em",
                          textTransform:
                            "uppercase",
                          color:
                            "#f59e0b",
                          margin:
                            "0 0 10px",
                        }}
                      >
                        Timeline Gaps
                      </h4>

                      {timelineGaps.map(
                        (
                          gap,
                          i
                        ) => (
                          <div
                            key={
                              i
                            }
                            style={{
                              padding:
                                "8px 0",
                              borderBottom:
                                i <
                                timelineGaps.length -
                                  1
                                  ? "1px solid #0f1e36"
                                  : "none",
                              fontSize: 12,
                              color:
                                "#94a3b8",
                              fontFamily:
                                "JetBrains Mono",
                            }}
                          >
                            {formatTimelineGap(gap)}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </>
              )}
          </div>
        )}

        {/* ===================================================================
            MAP
            =================================================================== */}

        {tab === "map" && (
          <div
            style={{
              flex: 1,
              position:
                "relative",
              overflow:
                "hidden",
              background:
                "#050a12",
            }}
          >
            <div
              style={{
                position:
                  "absolute",
                inset: 0,
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&h=800&fit=crop&auto=format)",
                backgroundSize:
                  "cover",
                backgroundPosition:
                  "center",
                opacity: 0.15,
              }}
            />

            <div
              className="grid-bg"
              style={{
                position:
                  "absolute",
                inset: 0,
              }}
            />

            {/* Existing map pins remain for now. */}
            {[
              {
                label:
                  "Karachi Port",
                x: "35%",
                y: "55%",
                events: 8,
                color:
                  "#f59e0b",
              },
              {
                label:
                  "Dubai Airport",
                x: "58%",
                y: "42%",
                events: 5,
                color:
                  "#f59e0b",
              },
              {
                label:
                  "Singapore",
                x: "78%",
                y: "65%",
                events: 3,
                color:
                  "#f59e0b",
              },
              {
                label:
                  "Lahore",
                x: "42%",
                y: "38%",
                events: 4,
                color:
                  "#f59e0b",
              },
            ].map(
              (pin, i) => (
                <div
                  key={i}
                  style={{
                    position:
                      "absolute",
                    left: pin.x,
                    top: pin.y,
                    transform:
                      "translate(-50%,-50%)",
                    cursor:
                      "pointer",
                  }}
                >
                  <div
                    style={{
                      position:
                        "relative",
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      alignItems:
                        "center",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius:
                          "50%",
                        background:
                          "rgba(245,158,11,0.15)",
                        border:
                          "2px solid rgba(245,158,11,0.5)",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        color:
                          "#f59e0b",
                        animation:
                          "glow 2s ease-in-out infinite",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily:
                            "JetBrains Mono",
                          fontWeight:
                            500,
                        }}
                      >
                        {
                          pin.events
                        }
                      </span>
                    </div>

                    <div
                      style={{
                        background:
                          "rgba(5,10,18,0.9)",
                        border:
                          "1px solid #1a2d4a",
                        borderRadius: 4,
                        padding:
                          "3px 8px",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily:
                            "Rajdhani",
                          fontWeight:
                            600,
                          color:
                            "#e2e8f0",
                        }}
                      >
                        {
                          pin.label
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}

            <div
              style={{
                position:
                  "absolute",
                top: 16,
                left: 16,
                padding:
                  "10px 14px",
                borderRadius: 8,
                background:
                  "rgba(5,10,18,0.85)",
                border:
                  "1px solid #1a2d4a",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontFamily:
                    "Rajdhani",
                  fontWeight: 600,
                  color:
                    "#f59e0b",
                  margin: 0,
                  letterSpacing:
                    "0.08em",
                  textTransform:
                    "uppercase",
                }}
              >
                {caseId
                  ? "Case Location View"
                  : "All Cases Location View"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          RIGHT SIDEBAR
          ===================================================================== */}

      <div
        style={{
          width: 280,
          borderLeft:
            "1px solid #0f1e36",
          display: "flex",
          flexDirection:
            "column",
          background:
            "#070e1b",
          overflow:
            "hidden",
        }}
      >
        {/* ===================================================================
            ENTITY DETAIL
            =================================================================== */}

        {selected ? (
          <div
            style={{
              flex: 1,
              overflowY:
                "auto",
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom:
                  "1px solid #0f1e36",
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
              }}
            >
              <h3
                style={{
                  fontFamily:
                    "Rajdhani",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing:
                    "0.08em",
                  textTransform:
                    "uppercase",
                  color:
                    "#64748b",
                  margin: 0,
                }}
              >
                Entity Detail
              </h3>

              <button
                onClick={() =>
                  setSelected(
                    null
                  )
                }
                style={{
                  background:
                    "none",
                  border:
                    "none",
                  color:
                    "#475569",
                  cursor:
                    "pointer",
                }}
              >
                <Icon
                  name="close"
                  size={16}
                />
              </button>
            </div>

            <div
              style={{
                padding:
                  "20px 16px",
                borderBottom:
                  "1px solid #0f1e36",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 12,
                  marginBottom:
                    16,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius:
                      selected.type ===
                      "location"
                        ? 8
                        : "50%",
                    background: `${
                      typeColors[
                        selected.type
                      ]
                    }18`,
                    border: `1.5px solid ${
                      typeColors[
                        selected.type
                      ]
                    }44`,
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    color:
                      typeColors[
                        selected.type
                      ],
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    name={
                      selected.type ===
                      "person"
                        ? "user"
                        : selected.type ===
                            "org"
                          ? "cases"
                          : "map"
                    }
                    size={20}
                  />
                </div>

                <div>
                  <p
                    style={{
                      fontSize: 16,
                      fontFamily:
                        "Rajdhani",
                      fontWeight:
                        700,
                      color:
                        "#e2e8f0",
                      margin: 0,
                    }}
                  >
                    {
                      selected.label
                    }
                  </p>

                  <span
                    className="badge badge-info"
                    style={{
                      marginTop: 4,
                      display:
                        "inline-block",
                      textTransform:
                        "capitalize",
                    }}
                  >
                    {
                      selected.type
                    }
                  </span>
                </div>
              </div>

              <div
                style={{
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  gap: 8,
                }}
              >
                {[
                  {
                    k: "Role",
                    v:
                      selected.role ||
                      "—",
                  },
                  {
                    k: "Node ID",
                    v: selected.id,
                  },
                  {
                    k: "Risk Score",
                    v: `${selected.risk}/100`,
                  },
                ].map(
                  (row) => (
                    <div
                      key={
                        row.k
                      }
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color:
                            "#475569",
                          fontFamily:
                            "Rajdhani",
                          fontWeight:
                            600,
                          letterSpacing:
                            "0.06em",
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {
                          row.k
                        }
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          fontFamily:
                            "JetBrains Mono",
                          color:
                            row.k ===
                            "Risk Score"
                              ? selected.risk >
                                80
                                ? "#ef4444"
                                : selected.risk >
                                    60
                                  ? "#f59e0b"
                                  : "#22c55e"
                              : "#94a3b8",
                        }}
                      >
                        {
                          row.v
                        }
                      </span>
                    </div>
                  )
                )}
              </div>

              <div
                style={{
                  marginTop: 14,
                  height: 6,
                  background:
                    "#0f1e36",
                  borderRadius: 3,
                  overflow:
                    "hidden",
                }}
              >
                <div
                  style={{
                    height:
                      "100%",
                    width: `${selected.risk}%`,
                    background:
                      `linear-gradient(90deg, #22c55e, ${
                        selected.risk >
                        60
                          ? "#f59e0b"
                          : "#22c55e"
                      }, ${
                        selected.risk >
                        80
                          ? "#ef4444"
                          : selected.risk >
                              60
                            ? "#f59e0b"
                            : "#22c55e"
                      })`,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: 16,
              }}
            >
              <h4
                style={{
                  fontFamily:
                    "Rajdhani",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing:
                    "0.08em",
                  textTransform:
                    "uppercase",
                  color:
                    "#64748b",
                  margin:
                    "0 0 12px",
                }}
              >
                Connected Entities
              </h4>

              {edges.filter(
                (e) =>
                  e.from ===
                    selected.id ||
                  e.to ===
                    selected.id
              ).length ===
                0 && (
                <p
                  style={{
                    fontSize: 12,
                    color:
                      "#475569",
                    margin: 0,
                  }}
                >
                  No connected
                  entities.
                </p>
              )}

              {edges
                .filter(
                  (e) =>
                    e.from ===
                      selected.id ||
                    e.to ===
                      selected.id
                )
                .map(
                  (e, i) => {
                    const other =
                      getNode(
                        e.from ===
                          selected.id
                          ? e.to
                          : e.from
                      );

                    if (
                      !other
                    )
                      return null;

                    return (
                      <div
                        key={i}
                        onClick={() =>
                          setSelected(
                            other
                          )
                        }
                        style={{
                          display:
                            "flex",
                          gap: 10,
                          alignItems:
                            "center",
                          padding:
                            "8px 10px",
                          borderRadius: 6,
                          marginBottom: 4,
                          cursor:
                            "pointer",
                          transition:
                            "background 0.15s",
                        }}
                        onMouseEnter={(
                          ev
                        ) =>
                          (ev.currentTarget.style.background =
                            "rgba(255,255,255,0.03)")
                        }
                        onMouseLeave={(
                          ev
                        ) =>
                          (ev.currentTarget.style.background =
                            "")
                        }
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius:
                              "50%",
                            background:
                              typeColors[
                                other.type
                              ],
                            flexShrink: 0,
                          }}
                        />

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 13,
                              color:
                                "#e2e8f0",
                              margin: 0,
                              overflow:
                                "hidden",
                              textOverflow:
                                "ellipsis",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              other.label
                            }
                          </p>

                          <p
                            style={{
                              fontSize: 11,
                              color:
                                "#475569",
                              margin:
                                "1px 0 0",
                              fontFamily:
                                "JetBrains Mono",
                            }}
                          >
                            {
                              e.label
                            }
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              overflowY:
                "auto",
            }}
          >
            {/* ===============================================================
                TOP INFLUENCERS
                =============================================================== */}

            <div
              style={{
                padding: 16,
                borderBottom:
                  "1px solid #0f1e36",
              }}
            >
              <h3
                style={{
                  fontFamily:
                    "Rajdhani",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing:
                    "0.08em",
                  textTransform:
                    "uppercase",
                  color:
                    "#64748b",
                  margin:
                    "0 0 12px",
                }}
              >
                Top Influencers
              </h3>

              {influencers.length ===
                0 && (
                <p
                  style={{
                    fontSize: 12,
                    color:
                      "#475569",
                    margin: 0,
                  }}
                >
                  {caseId
                    ? "No influencer data for this case yet."
                    : "No influencer data across the available cases."}
                </p>
              )}

              {influencers.map(
                (inf, i) => (
                  <div
                    key={i}
                    style={{
                      display:
                        "flex",
                      gap: 10,
                      alignItems:
                        "center",
                      padding:
                        "10px 0",
                      borderBottom:
                        i <
                        influencers.length -
                          1
                          ? "1px solid #0a1628"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius:
                          "50%",
                        background:
                          "#0f1e36",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        fontSize: 11,
                        fontFamily:
                          "JetBrains Mono",
                        color:
                          i === 0
                            ? "#f59e0b"
                            : "#64748b",
                        flexShrink: 0,
                      }}
                    >
                      #{i + 1}
                    </div>

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 13,
                          color:
                            "#e2e8f0",
                          margin: 0,
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          inf.name
                        }
                      </p>

                      <div
                        style={{
                          display:
                            "flex",
                          gap: 8,
                          marginTop: 4,
                          alignItems:
                            "center",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 3,
                            background:
                              "#0f1e36",
                            borderRadius: 2,
                          }}
                        >
                          <div
                            style={{
                              height:
                                "100%",
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  Number(
                                    inf.score ??
                                      0
                                  )
                                )
                              )}%`,
                              background:
                                i ===
                                0
                                  ? "#ef4444"
                                  : i ===
                                      1
                                    ? "#f59e0b"
                                    : "#00d4ff",
                              borderRadius:
                                2,
                            }}
                          />
                        </div>

                        <span
                          style={{
                            fontSize: 10,
                            fontFamily:
                              "JetBrains Mono",
                            color:
                              "#64748b",
                            flexShrink: 0,
                          }}
                        >
                          {
                            inf.score
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* ===============================================================
                GRAPH STATS
                =============================================================== */}

            <div
              style={{
                padding: 16,
              }}
            >
              <h3
                style={{
                  fontFamily:
                    "Rajdhani",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing:
                    "0.08em",
                  textTransform:
                    "uppercase",
                  color:
                    "#64748b",
                  margin:
                    "0 0 12px",
                }}
              >
                Graph Stats
              </h3>

              {[
                {
                  label: "Nodes",
                  value:
                    nodes.length,
                },
                {
                  label:
                    "Connections",
                  value:
                    edges.length,
                },
                {
                  label:
                    "Persons",
                  value:
                    nodes.filter(
                      (n) =>
                        n.type ===
                        "person"
                    ).length,
                },
                {
                  label: "Orgs",
                  value:
                    nodes.filter(
                      (n) =>
                        n.type ===
                        "org"
                    ).length,
                },
                {
                  label:
                    "Locations",
                  value:
                    nodes.filter(
                      (n) =>
                        n.type ===
                        "location"
                    ).length,
                },
              ].map(
                (s) => (
                  <div
                    key={
                      s.label
                    }
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      padding:
                        "6px 0",
                      borderBottom:
                        "1px solid #0a1628",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color:
                          "#64748b",
                        fontFamily:
                          "Rajdhani",
                        fontWeight:
                          600,
                        letterSpacing:
                          "0.06em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      {
                        s.label
                      }
                    </span>

                    <span
                      style={{
                        fontSize: 13,
                        fontFamily:
                          "JetBrains Mono",
                        color:
                          "#94a3b8",
                      }}
                    >
                      {
                        s.value
                      }
                    </span>
                  </div>
                )
              )}

              {/* =============================================================
                  PRIORITY / SUSPECTS
                  Only visible for a selected case.
                  ============================================================= */}

              {caseId && (
                <div
                  style={{
                    marginTop: 20,
                    paddingTop:
                      16,
                    borderTop:
                      "1px solid #1a2d4a",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      marginBottom:
                        12,
                    }}
                  >
                    <h3
                      style={{
                        fontFamily:
                          "Rajdhani",
                        fontSize: 14,
                        fontWeight:
                          700,
                        letterSpacing:
                          "0.08em",
                        textTransform:
                          "uppercase",
                        color:
                          "#64748b",
                        margin: 0,
                      }}
                    >
                      Priority
                    </h3>

                    {suspectsLoading && (
                      <span
                        style={{
                          fontSize: 10,
                          color:
                            "#475569",
                          fontFamily:
                            "JetBrains Mono",
                        }}
                      >
                        ANALYZING…
                      </span>
                    )}
                  </div>

                  {suspectsError && (
                    <p
                      style={{
                        fontSize: 11,
                        color:
                          "#ef4444",
                        margin:
                          "0 0 10px",
                        lineHeight:
                          1.5,
                      }}
                    >
                      {
                        suspectsError
                      }
                    </p>
                  )}

                  {!suspectsLoading &&
                    !suspectsError &&
                    rankedSuspects.length ===
                      0 && (
                      <p
                        style={{
                          fontSize: 12,
                          color:
                            "#475569",
                          margin: 0,
                          lineHeight:
                            1.5,
                        }}
                      >
                        No suspect
                        priority
                        data for
                        this case
                        yet.
                      </p>
                    )}

                  {rankedSuspects
                    .slice(0, 5)
                    .map(
                      (
                        suspect,
                        index
                      ) => {
                        const score =
                          Math.max(
                            0,
                            Math.min(
                              100,
                              Number(
                                suspect.priority_score ??
                                  0
                              )
                            )
                          );

                        const scoreColor =
                          score >=
                          80
                            ? "#ef4444"
                            : score >=
                                60
                              ? "#f59e0b"
                              : "#22c55e";

                        return (
                          <div
                            key={`${suspect.entity_id ?? suspect.entity_name}-${index}`}
                            style={{
                              padding:
                                "9px 0",
                              borderBottom:
                                index <
                                Math.min(
                                  5,
                                  rankedSuspects.length
                                ) -
                                  1
                                  ? "1px solid #0a1628"
                                  : "none",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                alignItems:
                                  "center",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  color:
                                    "#e2e8f0",
                                  overflow:
                                    "hidden",
                                  textOverflow:
                                    "ellipsis",
                                  whiteSpace:
                                    "nowrap",
                                  flex: 1,
                                }}
                              >
                                {index +
                                  1}
                                .{" "}
                                {
                                  suspect.entity_name
                                }
                              </span>

                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily:
                                    "JetBrains Mono",
                                  color:
                                    scoreColor,
                                  flexShrink: 0,
                                }}
                              >
                                {score.toFixed(
                                  0
                                )}
                              </span>
                            </div>

                            <div
                              style={{
                                height: 4,
                                marginTop: 5,
                                background:
                                  "#0f1e36",
                                borderRadius: 2,
                                overflow:
                                  "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height:
                                    "100%",
                                  width: `${score}%`,
                                  background:
                                    scoreColor,
                                  borderRadius:
                                    2,
                                }}
                              />
                            </div>
                          </div>
                        );
                      }
                    )}
                </div>
              )}

              <p
                style={{
                  fontSize: 12,
                  color:
                    "#475569",
                  marginTop: 16,
                  lineHeight: 1.6,
                }}
              >
                Click any node
                in the graph to
                view
                detailed
                entity
                information
                and
                connections.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          GRAPH LEGEND — pinned with `position: fixed` to the true bottom
          of the browser viewport, using the graph canvas's measured
          left edge (graphCanvasEl / legendLeft, tracked above) for
          horizontal placement.
          
          Earlier this used `position: absolute` anchored to this
          component's own wrapper, but that wrapper doesn't necessarily
          stretch to fill the full page height (that depends on the
          surrounding page layout, outside this component's control) —
          so "bottom: 16" was landing at the bottom of a short box, not
          the true bottom of the screen, making the legend appear to
          "float up" whenever the graph content was short.
          `position: fixed` is always relative to the viewport itself,
          so this now stays visually pinned to the real bottom of the
          screen regardless of graph height, node count, pan, zoom, or
          node selection. It only shows on the Network Graph tab, once
          the canvas has been measured.
          ===================================================================== */}

      {tab === "graph" &&
        hasSession &&
        !graphLoading &&
        !graphError &&
        nodes.length > 0 &&
        legendLeft !== null && (
          <div
            style={{
              position: "fixed",
              bottom: 16,
              left: legendLeft,
              display: "flex",
              gap: 14,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(5,10,18,0.85)",
              backdropFilter: "blur(4px)",
              border: "1px solid #1a2d4a",
              zIndex: 50,
            }}
          >
            {Object.entries(typeColors).map(([t, c]) => (
              <div
                key={t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: t === "location" ? 2 : "50%",
                    background: c,
                  }}
                />

                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "JetBrains Mono",
                    color: "#64748b",
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </span>
              </div>
            ))}

            <div
              style={{
                width: 1,
                background: "#1a2d4a",
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 3,
                  background:
                    "linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)",
                  borderRadius: 2,
                }}
              />

              <span
                style={{
                  fontSize: 11,
                  fontFamily: "JetBrains Mono",
                  color: "#64748b",
                }}
              >
                Risk score
              </span>
            </div>
          </div>
        )}
    </div>
  );
}

// ─── Alerts Page ──────────────────────────────────────────────────────────────
// GET /api/alerts?severity= and PATCH /api/alerts/{alertId}/acknowledge
// (ADMIN/SENIOR only). Response shapes confirmed against the backend's
// AlertResponse.java — see apiAlertToUiAlert() near the top of this file.
// Severity is fetched once as ALL and filtered client-side so the per-tab
// counts stay accurate without refetching on every click.
function AlertsPage({ setPage, role, onOpenCase }: { setPage: (p: Page) => void; role: Role; onOpenCase: (caseId: string) => void }) {
  const hasSession = api.hasSession();
  const [alerts, setAlerts] = useState<UiAlert[]>([]);
  const [loading, setLoading] = useState(hasSession);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UiAlert | null>(null);
  const [filter, setFilter] = useState("All");
  const [acking, setAcking] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);

  const canManage = hasSession && (role === "Admin" || role === "Senior Investigator");

  const refresh = useCallback(() => {
    if (!hasSession) { setLoading(false); return; }
    setLoading(true);
    api.getAlerts("ALL")
      .then(list => { setAlerts(list.map(apiAlertToUiAlert)); setLoadError(null); })
      .catch(e => setLoadError(e instanceof api.ApiError ? e.message : "Couldn't load alerts from the server."))
      .finally(() => setLoading(false));
  }, [hasSession]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = alerts.filter(a => filter === "All" || a.severity === filter);

  async function handleAcknowledge(id: string) {
    setAcking(id);
    setAckError(null);
    try {
      const updated = await api.acknowledgeAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? apiAlertToUiAlert(updated) : a));
    } catch (e) {
      setAckError(e instanceof api.ApiError ? e.message : "Couldn't acknowledge the alert.");
    } finally {
      setAcking(null);
    }
  }

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["All", "Critical", "High", "Medium", "Info"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 16px", borderRadius: 6, fontFamily: "Rajdhani", fontWeight: 600, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s", border: filter === f ? "1px solid rgba(0,212,255,0.4)" : "1px solid #1a2d4a", background: filter === f ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.02)", color: filter === f ? "#00d4ff" : "#64748b" }}>
              {f}
              {f !== "All" && <span style={{ marginLeft: 6, fontSize: 11, color: "#475569" }}>({alerts.filter(a => a.severity === f).length})</span>}
            </button>
          ))}
        </div>

        {loading && <p style={{ padding: "24px 0", textAlign: "center", color: "#475569", fontFamily: "JetBrains Mono", fontSize: 13 }}>Loading alerts…</p>}
        {!loading && loadError && <p style={{ padding: "24px 0", textAlign: "center", color: "#ef4444", fontFamily: "JetBrains Mono", fontSize: 13 }}>{loadError}</p>}
        {!loading && !loadError && filtered.length === 0 && <p style={{ padding: "24px 0", textAlign: "center", color: "#475569", fontFamily: "JetBrains Mono", fontSize: 13 }}>{hasSession ? "No alerts in this category." : "Log in to view alerts."}</p>}

        {ackError && <p style={{ padding: "8px 0 16px", color: "#ef4444", fontFamily: "JetBrains Mono", fontSize: 12 }}>{ackError}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(a => (
            <div key={a.id} className="card" onClick={() => setSelected(selected?.id === a.id ? null : a)} style={{ padding: "16px 20px", cursor: "pointer", borderColor: selected?.id === a.id ? "rgba(0,212,255,0.3)" : undefined, transition: "all 0.2s", opacity: a.acknowledged ? 0.6 : 1 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a.severity === "Critical" ? "rgba(239,68,68,0.12)" : a.severity === "High" ? "rgba(249,115,22,0.12)" : a.severity === "Medium" ? "rgba(245,158,11,0.10)" : "rgba(0,212,255,0.08)", color: a.severity === "Critical" ? "#ef4444" : a.severity === "High" ? "#f97316" : a.severity === "Medium" ? "#f59e0b" : "#00d4ff" }}>
                  <Icon name="alert" size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                    <span className={`badge ${a.severity === "Critical" ? "badge-critical" : a.severity === "High" || a.severity === "Medium" ? "badge-warning" : "badge-info"}`}>{a.severity}</span>
                    <span className="badge badge-closed">{a.type}</span>
                    {a.acknowledged && <span className="badge badge-active">Acknowledged</span>}
                    <span style={{ fontSize: 11, fontFamily: "JetBrains Mono", color: "#475569", marginLeft: "auto" }}>{a.time}</span>
                  </div>
                  <p style={{ fontSize: 14, color: "#e2e8f0", margin: "0 0 4px", fontWeight: 500 }}>{a.title}</p>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0, fontFamily: "JetBrains Mono" }}>{a.case}</p>
                  {selected?.id === a.id && (
                    <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(0,212,255,0.04)", borderRadius: 6, borderLeft: "2px solid rgba(0,212,255,0.3)" }}>
                      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 12px", lineHeight: 1.6 }}>{a.desc}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={e => { e.stopPropagation(); onOpenCase(a.case); }}>View in Network Graph →</button>
                        {canManage && !a.acknowledged && (
                          <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }} disabled={acking === a.id} onClick={e => { e.stopPropagation(); handleAcknowledge(a.id); }}>{acking === a.id ? "Acknowledging..." : "Acknowledge"}</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Reports Page ─────────────────────────────────────────────────────────────
// GET /api/reports/{caseId} for history, POST /api/reports/generate
// ({caseId, reportType}, ADMIN/SENIOR only) to create one. Reports are
// per-case, so — like Upload — this page needs a case selected first; either
// passed in via caseId or picked from the dropdown below. Response shapes
// confirmed against the backend's ReportResponse.java / ReportService.java —
// see ApiReport in lib/api.ts. downloadUrl is a relative, auth-protected path
// (e.g. /api/reports/download/{id}) on BACKEND_BASE_URL — it can't be used as
// a plain <a href>, since that resolves against the frontend's own origin and
// carries no Authorization header. downloadReport() below fetches it manually
// with the bearer token and triggers the save via a blob URL instead.
function ReportsPage({ role, caseId, onChangeCaseId }: { role: Role; caseId: string; onChangeCaseId: (id: string) => void }) {
  const hasSession = api.hasSession();
  const [caseOptions, setCaseOptions] = useState<{ id: string; name: string }[]>([]);
  const [reports, setReports] = useState<api.ApiReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const canManage = hasSession && (role === "Admin" || role === "Senior Investigator");

  useEffect(() => {
    if (!hasSession) return;
    api.getCases({ status: "ALL" })
      .then(list => setCaseOptions(list.map(c => ({ id: c.id, name: c.operationName }))))
      .catch(() => { /* picker just stays empty */ });
  }, [hasSession]);

  const refresh = useCallback(() => {
    if (!hasSession || !caseId) { setReports([]); return; }
    setLoading(true);
    api.getReports(caseId)
      .then(list => { setReports(list ?? []); setLoadError(null); })
      .catch(e => setLoadError(e instanceof api.ApiError ? e.message : "Couldn't load reports for this case."))
      .finally(() => setLoading(false));
  }, [caseId, hasSession]);

  useEffect(() => { refresh(); }, [refresh]);

  async function generate(reportType: "FULL_REPORT" | "GRAPH_EXPORT" | "FINANCIAL", key: string) {
    if (!caseId) return;
    setGenerating(key);
    setGenError(null);
    try {
      await api.generateReport({ caseId, reportType });
      refresh();
    } catch (e) {
      setGenError(e instanceof api.ApiError ? e.message : "Couldn't generate the report. Try again.");
    } finally {
      setGenerating(null);
    }
  }

  async function downloadReport(r: api.ApiReport) {
    if (!r.downloadUrl) return;
    setDownloading(r.id);
    setDownloadError(null);
    try {
      const url = r.downloadUrl.startsWith("http") ? r.downloadUrl : `${api.BACKEND_BASE_URL}${r.downloadUrl}`;
      const token = api.getAccessToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${r.title || "report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Couldn't download the report.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", flex: 1 }}>
      {/* Case picker */}
      <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
        <h3 style={{ fontFamily: "Rajdhani", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", margin: 0, flexShrink: 0 }}>Case</h3>
        <div style={{ width: 280 }}>
          <Dropdown
            value={caseOptions.find(o => o.id === caseId)?.name ?? "Select a case"}
            options={caseOptions.length ? caseOptions.map(o => o.name) : ["No cases yet"]}
            onChange={name => { const found = caseOptions.find(o => o.name === name); if (found) onChangeCaseId(found.id); }}
          />
        </div>
      </div>

      {/* Generate new */}
      <div className="card-glow" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        {genError && (
          <p style={{ fontSize: 12.5, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, padding: "8px 12px", margin: 0 }}>{genError}</p>
        )}
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: "Rajdhani", fontSize: 22, fontWeight: 700, color: "#e2e8f0", margin: "0 0 8px" }}>Generate Case Report</h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6 }}>Auto-generate a comprehensive PDF report with entity timeline, network graph image, financial summary, and alert history — ready for court or senior briefing.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
            <button className="btn-secondary">Export Graph as PNG</button>
            <button className="btn-primary" disabled={!canManage || !caseId || generating === "new"} title={canManage ? (caseId ? "" : "Select a case first") : "Admin/Senior Investigator only"} onClick={() => generate("FULL_REPORT", "new")}>
              {generating === "new" ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </div>
      </div>

      {/* Report options */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { icon: "reports", label: "Full Case Summary", desc: "All entities, events, connections, alerts", type: "FULL_REPORT" as const, key: "opt-full" },
          { icon: "network", label: "Network Graph Report", desc: "Graph image + influencer rankings", type: "GRAPH_EXPORT" as const, key: "opt-graph" },
          { icon: "timeline", label: "Financial Audit Trail", desc: "Transactions, accounts, flow diagram", type: "FINANCIAL" as const, key: "opt-fin" },
        ].map(r => (
          <button key={r.key} disabled={!canManage || !caseId} onClick={() => generate(r.type, r.key)} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1a2d4a", borderRadius: 10, padding: "20px", textAlign: "left", cursor: canManage && caseId ? "pointer" : "not-allowed", opacity: canManage && caseId ? 1 : 0.5, transition: "all 0.2s", color: "#e2e8f0" }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.3)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a2d4a"; }}>
            <div style={{ color: "#00d4ff", marginBottom: 12 }}><Icon name={r.icon} size={22} /></div>
            <p style={{ fontFamily: "Rajdhani", fontSize: 15, fontWeight: 700, color: "#e2e8f0", margin: "0 0 6px" }}>{r.label}</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{r.desc}</p>
            {generating === r.key && <div style={{ marginTop: 10, height: 3, background: "#0f1e36", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", background: "linear-gradient(90deg, #00d4ff, #a855f7)", width: "60%" }} /></div>}
          </button>
        ))}
      </div>

      {/* Past reports */}
      <div className="card" style={{ padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "Rajdhani", fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e2e8f0", margin: "0 0 16px" }}>Generated Reports</h3>
        {!caseId && <p style={{ padding: "20px 0", textAlign: "center", color: "#475569", fontFamily: "JetBrains Mono", fontSize: 13, margin: 0 }}>{hasSession ? "Select a case above to see its reports." : "Log in to view reports."}</p>}
        {caseId && loading && <p style={{ padding: "20px 0", textAlign: "center", color: "#475569", fontFamily: "JetBrains Mono", fontSize: 13, margin: 0 }}>Loading reports…</p>}
        {caseId && !loading && loadError && <p style={{ padding: "20px 0", textAlign: "center", color: "#ef4444", fontFamily: "JetBrains Mono", fontSize: 13, margin: 0 }}>{loadError}</p>}
        {caseId && !loading && !loadError && reports.length === 0 && <p style={{ padding: "20px 0", textAlign: "center", color: "#475569", fontFamily: "JetBrains Mono", fontSize: 13, margin: 0 }}>No reports generated for this case yet.</p>}
        {caseId && !loading && !loadError && reports.length > 0 && (
          <>
            {downloadError && <p style={{ fontSize: 12, color: "#ef4444", margin: "0 0 12px" }}>{downloadError}</p>}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #0f1e36" }}>
                  {["Report Title", "Type", "Pages", "Generated", ""].map(h => (
                    <th key={h} style={{ padding: "0 14px 10px 0", textAlign: "left", fontSize: 11, fontFamily: "Rajdhani", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="table-row">
                    <td style={{ padding: "12px 14px 12px 0", fontSize: 13, color: "#e2e8f0" }}>{r.title}</td>
                    <td style={{ padding: "12px 14px 12px 0" }}><span className="badge badge-info">{r.type}</span></td>
                    <td style={{ padding: "12px 14px 12px 0", fontFamily: "JetBrains Mono", fontSize: 12, color: "#64748b" }}>{r.pages != null ? `${r.pages}pp` : "—"}</td>
                    <td style={{ padding: "12px 14px 12px 0", fontFamily: "JetBrains Mono", fontSize: 12, color: "#64748b" }}>{r.generatedAt ?? "—"}</td>
                    <td style={{ padding: "12px 0 12px 0" }}>
                      <button
                        className="btn-secondary"
                        disabled={!r.downloadUrl || downloading === r.id}
                        style={{ padding: "4px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 6, opacity: r.downloadUrl ? 1 : 0.5 }}
                        onClick={() => downloadReport(r)}
                      >
                        <Icon name="download" size={12} />
                        {downloading === r.id ? "Downloading..." : "PDF"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page titles ──────────────────────────────────────────────────────────────
const PAGE_TITLES: Record<Page, string> = {
  login: "Login",
  signup: "Create Account",
  dashboard: "Dashboard",
  cases: "Case Management",
  upload: "Upload & Ingest Data",
  network: "Network Analysis",
  alerts: "Alerts & Anomalies",
  reports: "Reports",
};

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [role, setRole] = useState<Role>("Senior Investigator");
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [hydrating, setHydrating] = useState(true);

  // Which case Network Graph / Reports are currently scoped to. Set when
  // opening a case from the Cases page or an alert; also changeable directly
  // from the case picker on either of those pages.
  const [selectedCaseId, setSelectedCaseId] = useState("");


  function openCaseNetwork(caseId: string) {
    setSelectedCaseId(caseId);
    setPage("network");
  }

  // On first load, if a token is already stored (from a previous session),
  // try to restore it via GET /api/users/me instead of forcing a fresh login.
  useEffect(() => {
    const token = api.getAccessToken();
    if (!token) { setHydrating(false); return; }
    api.getMe()
      .then(user => { setApiUser(user); setRole(roleFromApi(user.role)); setPage("dashboard"); })
      .catch(() => { api.clearTokens(); })
      .finally(() => setHydrating(false));
  }, []);

  function handleLogin(user: ApiUser, accessToken: string, refreshToken: string) {
    api.setTokens(accessToken, refreshToken);
    setApiUser(user);
    setRole(roleFromApi(user.role));
    setPage("dashboard");
  }

  function handleLogout() {
    api.apiLogout().catch(() => { /* best-effort */ });
    api.clearTokens();
    setApiUser(null);
    setPage("login");
  }

  if (hydrating) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050a12", color: "#64748b", fontFamily: "JetBrains Mono", fontSize: 13 }}>
        Loading session...
      </div>
    );
  }

  if (page === "login") {
    return <LoginPage onLogin={handleLogin} onGoToSignup={() => setPage("signup")} />;
  }

  if (page === "signup") {
    return (
      <SignupPage
        onLogin={handleLogin}
        onGoToLogin={() => setPage("login")}
      />
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#050a12" }}>
      <Sidebar page={page} setPage={setPage} role={role} apiUser={apiUser} onLogout={handleLogout} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar title={PAGE_TITLES[page]} setPage={setPage} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            {page === "dashboard" && <Dashboard setPage={setPage} />}
            {page === "cases" && <CaseManagement setPage={setPage} role={role} onOpenCase={openCaseNetwork} />}
            {page === "upload" && <DataUpload />}
            {page === "network" && <NetworkGraph caseId={selectedCaseId} onChangeCaseId={setSelectedCaseId} />}
            {page === "alerts" && <AlertsPage setPage={setPage} role={role} onOpenCase={openCaseNetwork} />}
            {page === "reports" && <ReportsPage role={role} caseId={selectedCaseId} onChangeCaseId={setSelectedCaseId} />}

          </div>
        </div>
      </div>
    </div>
  );
}
