// Bridges the AI service's graph format to what NetworkGraph renders.
//
// The API returns a flat EDGE LIST:
//   { source, source_type, relation, target, target_type }
// The UI needs NODES with ids, x/y pixel coordinates, a risk score and a role
// label. None of that exists server-side, so it is derived here:
//
//   id     - stable slug of the entity name (the API has no entity ids)
//   x, y   - computed by the force layout below
//   risk   - PROXY, scaled from connection count. The real score would come
//            from POST /api/priority/score per entity, which needs factor
//            inputs the graph endpoint does not return.
//   role   - the entity type, since the API carries no role concept
//
// Caveat: an edge list cannot express an isolated node. Entities added via
// POST /api/graph/{case}/entity with no relationship will not appear at all.

import type { GraphEdge, Influencer } from "./aiService";

export type UiNode = {
  id: string;
  label: string;
  type: "person" | "org" | "location";
  x: number;
  y: number;
  risk: number;
  role: string;
};

export type UiEdge = { from: string; to: string; label: string };

export type UiInfluencer = { name: string; score: number; connections: number };

const CANVAS = { width: 820, height: 520, padding: 70 };

/** NetworkGraph only styles these three; anything else would render colourless. */
function normaliseType(apiType: string): UiNode["type"] {
  const t = (apiType || "").toUpperCase();
  if (t.includes("ORG") || t.includes("COMPANY") || t.includes("FIRM")) return "org";
  if (t.includes("LOC") || t.includes("PLACE") || t.includes("GPE") || t.includes("CITY")) return "location";
  return "person";
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "node";
}

/**
 * Small deterministic force-directed layout: repulsion between every pair,
 * springs along edges, pulled toward the centre. Seeded from the node index so
 * the same graph always lays out identically instead of jumping between loads.
 */
function layout(ids: string[], edges: UiEdge[]): Map<string, { x: number; y: number }> {
  const n = ids.length;
  const pos = new Map<string, { x: number; y: number }>();
  const cx = CANVAS.width / 2;
  const cy = CANVAS.height / 2;

  if (n === 0) return pos;
  if (n === 1) {
    pos.set(ids[0], { x: cx, y: cy });
    return pos;
  }

  // Seed on a circle - deterministic, and avoids the degenerate all-same-point start.
  const radius = Math.min(CANVAS.width, CANVAS.height) / 2 - CANVAS.padding;
  ids.forEach((id, i) => {
    const a = (i / n) * Math.PI * 2;
    pos.set(id, { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  });

  const index = new Map(ids.map((id, i) => [id, i]));
  const adjacency = edges
    .map((e) => [index.get(e.from), index.get(e.to)])
    .filter((p): p is [number, number] => p[0] !== undefined && p[1] !== undefined);

  const REPULSION = 90_000;
  const SPRING = 0.012;
  const IDEAL = 130;
  const CENTRING = 0.006;

  for (let step = 0; step < 220; step++) {
    const cooling = 1 - step / 220;
    const fx = new Array(n).fill(0);
    const fy = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      const a = pos.get(ids[i])!;
      for (let j = i + 1; j < n; j++) {
        const b = pos.get(ids[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          // Coincident points would divide by zero; nudge them apart deterministically.
          dx = (i - j) || 1;
          dy = 1;
          d2 = 2;
        }
        const f = REPULSION / d2;
        const d = Math.sqrt(d2);
        fx[i] += (dx / d) * f;
        fy[i] += (dy / d) * f;
        fx[j] -= (dx / d) * f;
        fy[j] -= (dy / d) * f;
      }
    }

    for (const [i, j] of adjacency) {
      const a = pos.get(ids[i])!;
      const b = pos.get(ids[j])!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - IDEAL) * SPRING;
      fx[i] += (dx / d) * f * d * 0.1;
      fy[i] += (dy / d) * f * d * 0.1;
      fx[j] -= (dx / d) * f * d * 0.1;
      fy[j] -= (dy / d) * f * d * 0.1;
    }

    ids.forEach((id, i) => {
      const p = pos.get(id)!;
      const nx = p.x + (fx[i] + (cx - p.x) * CENTRING) * 0.08 * cooling;
      const ny = p.y + (fy[i] + (cy - p.y) * CENTRING) * 0.08 * cooling;
      p.x = Math.max(CANVAS.padding, Math.min(CANVAS.width - CANVAS.padding, nx));
      p.y = Math.max(CANVAS.padding, Math.min(CANVAS.height - CANVAS.padding, ny));
    });
  }

  return pos;
}

export function toUiGraph(apiEdges: GraphEdge[]): { nodes: UiNode[]; edges: UiEdge[] } {
  const meta = new Map<string, { label: string; type: UiNode["type"]; degree: number }>();

  const note = (name: string, apiType: string) => {
    const id = slug(name);
    const existing = meta.get(id);
    if (existing) existing.degree += 1;
    else meta.set(id, { label: name, type: normaliseType(apiType), degree: 1 });
  };

  for (const e of apiEdges) {
    note(e.source, e.source_type);
    note(e.target, e.target_type);
  }

  const edges: UiEdge[] = apiEdges.map((e) => ({
    from: slug(e.source),
    to: slug(e.target),
    label: e.relation,
  }));

  const ids = [...meta.keys()];
  const positions = layout(ids, edges);
  const maxDegree = Math.max(1, ...[...meta.values()].map((m) => m.degree));

  const nodes: UiNode[] = ids.map((id) => {
    const m = meta.get(id)!;
    const p = positions.get(id)!;
    return {
      id,
      label: m.label,
      type: m.type,
      x: Math.round(p.x),
      y: Math.round(p.y),
      // Proxy only - see the note at the top of this file.
      risk: Math.round(30 + (m.degree / maxDegree) * 65),
      role: m.type === "person" ? "Person" : m.type === "org" ? "Organisation" : "Location",
    };
  });

  return { nodes, edges };
}

export function toUiInfluencers(apiInfluencers: Influencer[]): UiInfluencer[] {
  const maxDegree = Math.max(1, ...apiInfluencers.map((i) => i.degree));
  return apiInfluencers.map((i) => ({
    name: i.name,
    // The API ranks by raw degree; the UI renders a 0-100 bar.
    score: Math.round((i.degree / maxDegree) * 100),
    connections: i.degree,
  }));
}
