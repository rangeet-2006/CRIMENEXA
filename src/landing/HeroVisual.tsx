import type { CSSProperties } from "react";
import { EDGES, GRAPH_VIEWBOX, NODES, RANKED, TYPE_COLOR } from "./landingData";

/** Base tilt, also exposed to the float animation so it keeps the angle. */
const tilt = (deg: number) => ({ "--lp-tilt": `${deg}deg`, transform: `rotate(${deg}deg)` }) as CSSProperties;

const BAR = ["#ef4444", "#f59e0b", "#00d4ff"];

/**
 * Product shot for the hero, drawn from the same demo data as the How It Works
 * graph instead of a screenshot, so it stays crisp and on-theme at any size.
 * Purely decorative - the copy beside it says the same thing - so it is hidden
 * from assistive technology.
 */
export default function HeroVisual() {
  const byId = new Map(NODES.map(n => [n.id, n]));
  const top3 = RANKED.slice(0, 3);

  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-hidden="true">
      <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(0,212,255,0.14),transparent_65%)]" />

      {/* Console window */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,212,255,0.06)]">
        <div className="flex items-center gap-2 border-b border-border bg-[#081222] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1f3a5c]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#1f3a5c]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#1f3a5c]" />
          <span className="ml-3 truncate font-mono text-[10.5px] tracking-[0.08em] text-muted2">OPS-2026-001 · NETWORK GRAPH</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-green">
            <span className="h-1.5 w-1.5 rounded-full bg-green" />
            LIVE
          </span>
        </div>
        <div className="grid-bg">
          <svg viewBox={`0 0 ${GRAPH_VIEWBOX.width} ${GRAPH_VIEWBOX.height}`} className="block h-auto w-full">
            {EDGES.map(e => {
              const a = byId.get(e.from)!;
              const b = byId.get(e.to)!;
              return <line key={`${e.from}-${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1f3a5c" strokeWidth="1.3" />;
            })}
            {NODES.map(n => (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.type === "person" ? 17 : 14}
                  fill={TYPE_COLOR[n.type]}
                  fillOpacity="0.28"
                  stroke={TYPE_COLOR[n.type]}
                  strokeWidth="1.3"
                />
                <circle cx={n.x} cy={n.y} r="4" fill={TYPE_COLOR[n.type]} />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Floating ranking card - the counterpart of the stacked phones in the
          reference design. */}
      <div
        className="lp-float absolute -bottom-8 -left-3 w-[210px] rounded-lg border border-border bg-[#081222]/95 p-3.5 shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur sm:-left-8"
        style={tilt(-3)}
      >
        <p className="m-0 mb-2 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-muted2">Priority ranking</p>
        {top3.map((n, i) => (
          <div key={n.id} className="py-1">
            <div className="flex items-baseline gap-2 text-[11.5px]">
              <span className="font-mono text-[9.5px] text-muted2">#{i + 1}</span>
              <span className="flex-1 truncate text-text">{n.name}</span>
              <span className="font-mono text-[10.5px]" style={{ color: i === 0 ? "#ef4444" : "#94a3b8" }}>
                {n.risk.toFixed(1)}
              </span>
            </div>
            <div className="mt-1 h-[3px] rounded-full bg-surface2">
              <div className="h-full rounded-full" style={{ width: `${n.risk}%`, background: BAR[i] }} />
            </div>
          </div>
        ))}
      </div>

      {/* Floating alert */}
      <div
        className="lp-float absolute -right-2 -top-5 flex items-center gap-2.5 rounded-lg border border-red/30 bg-[#140c12]/95 px-3 py-2.5 shadow-[0_14px_32px_rgba(0,0,0,0.5)] sm:-right-6"
        style={{ ...tilt(2), animationDelay: "-3s" }}
      >
        <span className="animate-pulse-cyan h-2 w-2 shrink-0 rounded-full bg-red" />
        <div>
          <p className="m-0 text-[11.5px] font-medium text-text">Anomaly flagged</p>
          <p className="m-0 font-mono text-[10px] text-muted2">Transfer 42× the case median</p>
        </div>
      </div>
    </div>
  );
}