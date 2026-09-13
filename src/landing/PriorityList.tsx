import { RANKED, TOP_FACTORS, TYPE_COLOR, TYPE_LABEL } from "./landingData";

type Props = {
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
};

/** #1 red, #2 amber, the rest cyan - the same scheme as the app's panel. */
const BAR = ["#ef4444", "#f59e0b"];

/**
 * Mirrors the app's Priority Ranking panel: rank, name, score and a bar, with
 * the factor breakdown shown for the top entity only. Each row is linked to
 * the graph beside it - hovering or focusing a row highlights that entity.
 */
export default function PriorityList({ activeId, onActiveChange }: Props) {
  const rows = RANKED.slice(0, 5);

  return (
    <div className="card flex h-full flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 font-display text-sm font-bold uppercase tracking-[0.1em] text-muted2">Priority ranking</h3>
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted2">
          Demo case
        </span>
      </div>

      <ol className="m-0 list-none p-0">
        {rows.map((n, i) => {
          const isActive = activeId === n.id;
          return (
            <li key={n.id} className={i < rows.length - 1 ? "border-b border-surface2" : ""}>
              <button
                type="button"
                onMouseEnter={() => onActiveChange(n.id)}
                onMouseLeave={() => onActiveChange(null)}
                onFocus={() => onActiveChange(n.id)}
                onBlur={() => onActiveChange(null)}
                onClick={() => onActiveChange(n.id)}
                aria-label={`Rank ${i + 1}: ${n.name}, ${TYPE_LABEL[n.type]}, priority score ${n.risk.toFixed(1)}. Highlights it in the graph.`}
                className={`w-full cursor-pointer rounded-md border-0 px-2 py-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan ${
                  isActive ? "bg-cyan/[0.07]" : "bg-transparent hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[10px] text-muted2">#{i + 1}</span>
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: TYPE_COLOR[n.type] }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text">{n.name}</span>
                  <span className="shrink-0 font-mono text-[11px]" style={{ color: i === 0 ? "#ef4444" : "#94a3b8" }}>
                    {n.risk.toFixed(1)}
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] rounded-full bg-surface2">
                  <div className="h-full rounded-full" style={{ width: `${n.risk}%`, background: BAR[i] ?? "#00d4ff" }} />
                </div>
                {/* An unexplained ranking is not usable in an investigation, so
                    the top entity shows what its score is made of. */}
                {i === 0 && (
                  <div className="mt-2 pl-0.5">
                    {TOP_FACTORS.map(f => (
                      <div key={f.name} className="flex justify-between py-px font-mono text-[10.5px] text-muted2">
                        <span>{f.name}</span>
                        <span>+{f.contribution.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <p className="m-0 mt-auto pt-3 text-[11.5px] leading-relaxed text-muted2">
        Scores combine seven weighted factors. Hover or tab through the list to find each entity in the graph.
      </p>
    </div>
  );
}