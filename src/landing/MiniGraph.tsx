import { useId, useMemo } from "react";
import useInView from "./useInView";
import {
  EDGES,
  GRAPH_VIEWBOX,
  NODES,
  TYPE_COLOR,
  TYPE_LABEL,
  riskColor,
  type DemoNode,
  type EntityType,
} from "./landingData";

type Props = {
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
};

const RADIUS: Record<EntityType, number> = { person: 20, org: 19, account: 17, phone: 16, location: 16 };
const { width: W, height: H } = GRAPH_VIEWBOX;

/**
 * A hand-laid-out cut of what the real Network Graph shows: the same type
 * colours and risk rings, on a fictional nine-entity case. Hovering, tapping or
 * tabbing to a node shows its name, type and risk score, and dims everything
 * it is not directly linked to.
 */
export default function MiniGraph({ activeId, onActiveChange }: Props) {
  const gradId = `lp-grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const tipId = `${gradId}-tip`;
  const [ref, visible] = useInView<HTMLDivElement>(0.3);

  const byId = useMemo(() => new Map(NODES.map(n => [n.id, n])), []);
  const links = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of EDGES) {
      if (!m.has(e.from)) m.set(e.from, new Set());
      if (!m.has(e.to)) m.set(e.to, new Set());
      m.get(e.from)!.add(e.to);
      m.get(e.to)!.add(e.from);
    }
    return m;
  }, []);

  const active = activeId ? byId.get(activeId) ?? null : null;
  const lit = (id: string) => !active || id === active.id || !!links.get(active.id)?.has(id);
  const touches = (e: { from: string; to: string }) => !!active && (e.from === active.id || e.to === active.id);

  return (
    <div ref={ref} className={`lp-graph relative ${visible ? "is-visible" : ""}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="group"
        aria-label="Example investigation graph. Tab to a node, or hover or tap it, to see its name, type and risk score."
        onClick={e => {
          if (e.target === e.currentTarget) onActiveChange(null);
        }}
      >
        <defs>
          {(Object.keys(TYPE_COLOR) as EntityType[]).map(t => (
            <radialGradient key={t} id={`${gradId}-${t}`} cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor={TYPE_COLOR[t]} stopOpacity="0.9" />
              <stop offset="100%" stopColor={TYPE_COLOR[t]} stopOpacity="0.28" />
            </radialGradient>
          ))}
        </defs>

        {EDGES.map((e, i) => {
          const a = byId.get(e.from)!;
          const b = byId.get(e.to)!;
          const on = touches(e);
          return (
            <line
              key={`${e.from}-${e.to}`}
              className="lp-edge"
              pathLength={1}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={on ? "#00d4ff" : "#1f3a5c"}
              strokeWidth={on ? 1.6 : 1.2}
              strokeOpacity={active && !on ? 0.25 : on ? 0.85 : 1}
              style={{ animationDelay: `${i * 70}ms`, transition: "stroke-opacity 180ms ease" }}
            />
          );
        })}

        {/* Relation names show only for the active node's edges. Showing all
            nine at once turns the graph into a word cloud. */}
        {active &&
          EDGES.filter(touches).map(e => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            return (
              <text
                key={`label-${e.from}-${e.to}`}
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 4}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
                fontFamily="JetBrains Mono, monospace"
                stroke="#050a12"
                strokeWidth="4"
                paintOrder="stroke"
                style={{ pointerEvents: "none" }}
              >
                {e.relation}
              </text>
            );
          })}

        {NODES.map((n, i) => {
          const r = RADIUS[n.type];
          const color = TYPE_COLOR[n.type];
          const isActive = active?.id === n.id;
          const ring = 2 * Math.PI * (r - 3);
          return (
            // Entrance animation on the outer group, dimming on the inner one.
            // An animation with fill-mode "forwards" would otherwise pin the
            // opacity and silently override the dimming.
            <g key={n.id} className="lp-node" style={{ animationDelay: `${300 + i * 60}ms` }}>
              <g
                role="button"
                tabIndex={0}
                aria-label={`${n.name}, ${TYPE_LABEL[n.type]}, risk score ${n.risk}, ${links.get(n.id)?.size ?? 0} links`}
                aria-describedby={isActive ? tipId : undefined}
                onMouseEnter={() => onActiveChange(n.id)}
                onMouseLeave={() => onActiveChange(null)}
                onFocus={() => onActiveChange(n.id)}
                onBlur={() => onActiveChange(null)}
                onClick={() => onActiveChange(n.id)}
                onKeyDown={e => {
                  if (e.key === "Escape") {
                    onActiveChange(null);
                    e.currentTarget.blur();
                  }
                }}
                className="lp-node-hit cursor-pointer"
                style={{ opacity: lit(n.id) ? 1 : 0.22, transition: "opacity 180ms ease" }}
              >
                {/* Invisible, generous hit area so small nodes are easy to tap. */}
                <circle cx={n.x} cy={n.y} r={r + 12} fill="transparent" />
                {n.risk > 85 && (
                  <circle className="lp-pulse" cx={n.x} cy={n.y} r={r} fill="none" stroke={riskColor(n.risk)} strokeWidth="1.5" />
                )}
                {isActive && <circle cx={n.x} cy={n.y} r={r + 9} fill={color} opacity="0.14" />}
                <circle cx={n.x} cy={n.y} r={r} fill={`url(#${gradId}-${n.type})`} stroke={color} strokeWidth={isActive ? 2 : 1.3} />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r - 3}
                  fill="none"
                  stroke={riskColor(n.risk)}
                  strokeWidth="2"
                  strokeDasharray={`${(n.risk / 100) * ring} ${ring}`}
                  transform={`rotate(-90 ${n.x} ${n.y})`}
                  opacity="0.75"
                />
                <text
                  x={n.x}
                  y={n.y + r + 14}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill={isActive ? "#e2e8f0" : "#94a3b8"}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {n.short}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {active && <Tooltip id={tipId} node={active} links={links.get(active.id)?.size ?? 0} />}
    </div>
  );
}

function Tooltip({ id, node, links }: { id: string; node: DemoNode; links: number }) {
  const r = RADIUS[node.type];
  const color = TYPE_COLOR[node.type];
  // Near the top edge the card opens downwards, and near the sides it shifts
  // inwards, so it never spills out of the panel.
  const below = node.y < 120;
  const fx = node.x / W;
  const tx = fx < 0.3 ? "-18%" : fx > 0.7 ? "-82%" : "-50%";
  const ty = below ? `${r + 12}px` : `calc(-100% - ${r + 12}px)`;

  return (
    <div
      id={id}
      role="tooltip"
      className="pointer-events-none absolute z-10 w-52 rounded-md border border-border bg-[#081222]/95 px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm"
      style={{ left: `${fx * 100}%`, top: `${(node.y / H) * 100}%`, transform: `translate(${tx}, ${ty})` }}
    >
      <p className="m-0 truncate text-sm font-medium text-text">{node.name}</p>
      <p className="m-0 mt-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
        {TYPE_LABEL[node.type]}
      </p>
      <div className="mt-2.5 flex items-baseline justify-between">
        <span className="text-[11px] text-muted2">Risk score</span>
        <span className="font-mono text-sm" style={{ color: riskColor(node.risk) }}>
          {node.risk}
          <span className="text-muted2">/100</span>
        </span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-surface2">
        <div className="h-full rounded-full" style={{ width: `${node.risk}%`, background: riskColor(node.risk) }} />
      </div>
      <p className="m-0 mt-2 text-[11px] text-muted2">
        {links} direct link{links === 1 ? "" : "s"}
      </p>
    </div>
  );
}