// Copy and demo data for the landing page, kept apart from layout code so
// either can change without touching the other.

export type EntityType = "person" | "org" | "location" | "phone" | "account";

export type DemoNode = {
  id: string;
  name: string;
  /** Label drawn under the node - shorter than `name` where space is tight. */
  short: string;
  type: EntityType;
  /** 0-100, the same scale as the app's priority score. */
  risk: number;
  x: number;
  y: number;
};

export type DemoEdge = { from: string; to: string; relation: string };

/** Same palette as NetworkGraph's typeColors in App.tsx. */
export const TYPE_COLOR: Record<EntityType, string> = {
  person: "#00d4ff",
  org: "#a855f7",
  location: "#f59e0b",
  phone: "#22c55e",
  account: "#ef4444",
};

export const TYPE_LABEL: Record<EntityType, string> = {
  person: "Person",
  org: "Organisation",
  location: "Location",
  phone: "Phone number",
  account: "Bank account",
};

/** Risk ring colour, using the same thresholds as the app's graph. */
export function riskColor(risk: number): string {
  return risk > 80 ? "#ef4444" : risk > 60 ? "#f59e0b" : "#22c55e";
}

export const GRAPH_VIEWBOX = { width: 560, height: 380 };

// A fictional case. Codenames rather than realistic names on purpose: a public
// page should not pin "suspect" on a name that reads as a real person or
// community.
export const NODES: DemoNode[] = [
  { id: "a", name: "Subject A", short: "Subject A", type: "person", risk: 91, x: 110, y: 115 },
  { id: "co", name: "Front Co. X", short: "Front Co. X", type: "org", risk: 69, x: 280, y: 58 },
  { id: "acc", name: "A/C ••4821", short: "A/C ••4821", type: "account", risk: 83, x: 450, y: 112 },
  { id: "b", name: "Subject B", short: "Subject B", type: "person", risk: 76, x: 470, y: 250 },
  { id: "p1", name: "+91 98••• ••210", short: "••210", type: "phone", risk: 72, x: 110, y: 265 },
  { id: "p2", name: "+91 70••• ••033", short: "••033", type: "phone", risk: 41, x: 245, y: 318 },
  { id: "c", name: "Subject C", short: "Subject C", type: "person", risk: 58, x: 305, y: 212 },
  { id: "d", name: "Subject D", short: "Subject D", type: "person", risk: 34, x: 195, y: 170 },
  { id: "loc", name: "Tower 5, Sector-5", short: "Tower 5", type: "location", risk: 22, x: 405, y: 335 },
];

export const EDGES: DemoEdge[] = [
  { from: "a", to: "co", relation: "CONTROLS" },
  { from: "co", to: "acc", relation: "TRANSFERRED" },
  { from: "b", to: "acc", relation: "OWNS" },
  { from: "a", to: "p1", relation: "USES" },
  { from: "p1", to: "p2", relation: "CALLED" },
  { from: "c", to: "p2", relation: "USES" },
  { from: "b", to: "loc", relation: "SEEN_AT" },
  { from: "c", to: "loc", relation: "SEEN_AT" },
  { from: "d", to: "c", relation: "MET" },
];

/** Highest risk first - what the priority list shows. */
export const RANKED = [...NODES].sort((x, y) => y.risk - x.risk);

// The scorer's real factors and weights (priority_scoring.WEIGHTS), with demo
// values chosen so the contributions sum to Subject A's 91.0. Like the app,
// only the top entity shows its breakdown, and only the first four factors.
export const TOP_FACTORS = [
  { name: "Evidence strength", contribution: 19.0 },
  { name: "Communication relevance", contribution: 14.4 },
  { name: "Location correlation", contribution: 13.2 },
  { name: "Witness corroboration", contribution: 12.6 },
];

export const FEATURES = [
  {
    tag: "01 · Ingest",
    title: "Every source, one case",
    body: "Call records, bank statements, FIRs, location logs and forensic reports. Messy column names are mapped automatically, and scanned FIRs are read with OCR.",
  },
  {
    tag: "02 · Extract",
    title: "Entities, not just text",
    body: "People, organisations, places, phone numbers, bank accounts, vehicles and IPC sections are pulled out of every document.",
  },
  {
    tag: "03 · Connect",
    title: "The network, drawn for you",
    body: "Every entity and link lands in one graph per case, so a phone shared by two suspects stands out at a glance.",
  },
  {
    tag: "04 · Prioritise",
    title: "Ranked, with reasons",
    body: "Suspects are scored on seven weighted factors, from evidence strength to network position, and every score shows its breakdown.",
  },
  {
    tag: "05 · Verify",
    title: "Claims checked against data",
    body: "Timelines are rebuilt from the evidence, unusual transfers are flagged, and location claims are tested against tower and GPS records.",
  },
  {
    tag: "06 · Ask",
    title: "Answers grounded in evidence",
    body: "Ask questions about a case in plain language. Answers come only from that case's evidence, with the sources listed.",
  },
];

export const SAFEGUARDS = [
  "Two-step sign-in with email OTP",
  "Role-based access for admins, senior and field officers",
  "SHA-256 hash recorded for every uploaded file",
];

export const STEPS = [
  {
    title: "Upload the evidence",
    body: "Drop in CDRs, bank records, FIRs or GPS logs. Each file is hashed on arrival and processed in the background.",
  },
  {
    title: "Build the network",
    body: "Entities are extracted, matched and linked into a single graph for the case.",
  },
  {
    title: "Act on the ranking",
    body: "Suspects are ranked with the factors behind each score, so the next move is clear and defensible.",
  },
];

export type TeamMember = {
  name: string;
  role: string;
  /** Profile handle, as in github.com/<handle> - also where the picture comes from. */
  github: string;
  /** Ring and highlight colour in the team graph. */
  color: string;
  /** Optional file in public/team/, with extension, to show instead of the GitHub avatar. */
  photo?: string;
};

/** Listed clockwise from the top of the team hexagon. */
export const TEAM: TeamMember[] = [
  { name: "Souhardya Saha", role: "Team Lead", github: "Bouhardo", color: "#fbbf24" },
  { name: "Ankur Banik", role: "Backend Dev, Presenter", github: "AnkurBanik124", color: "#00d4ff" },
  { name: "Rangeet Majumder", role: "UI/UX Designer", github: "rangeet-2006", color: "#a855f7" },
  { name: "Raunak Biswas", role: "Full-Stack Dev", github: "R0nMann", color: "#22c55e" },
  { name: "Sushree Jana", role: "AI Engineer", github: "JANA-SUSHREE", color: "#f472b6" },
  { name: "Ankita Nandi", role: "Frontend Dev", github: "ankitanandi685-commits", color: "#60a5fa" },
];