import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import useInView from "./useInView";
import { GITHUB_MARK } from "./githubMark";
import { TEAM } from "./landingData";

// A pointy-top regular hexagon in a 720x580 box, with members placed clockwise
// from the top in TEAM order. The box keeps this aspect ratio at every width,
// so the SVG edges and the percentage-positioned HTML nodes always line up.
const W = 720;
const H = 580;
const CX = 360;
const CY = 285;
const R = 210;

type Side = "below" | "above" | "left" | "right";
type Member = (typeof TEAM)[number] & { x: number; y: number; side: Side };

const MEMBERS: Member[] = TEAM.map((m, i) => {
  const angle = ((-90 + (i * 360) / TEAM.length) * Math.PI) / 180;
  const x = CX + R * Math.cos(angle);
  const y = CY + R * Math.sin(angle);
  // Details open towards the middle of the hexagon, where there is room.
  const side: Side = Math.abs(x - CX) < 1 ? (y < CY ? "below" : "above") : x > CX ? "left" : "right";
  return { ...m, x, y, side };
});

const COUNT = MEMBERS.length;

/**
 * Each member picture: their current GitHub avatar, fetched live so it follows
 * profile changes, unless TEAM names a file in public/team/ to use instead.
 * 160px covers the largest node (80px) on a 2x display.
 */
const avatarSrc = (m: Member) =>
  m.photo ? `${import.meta.env.BASE_URL}team/${m.photo}` : `https://github.com/${encodeURIComponent(m.github)}.png?size=160`;

// The padding on the card's inner edge touches the node, so the pointer never
// crosses empty space on its way from a member to their GitHub link.
const PLACEMENT: Record<Side, string> = {
  below: "left-1/2 top-full -translate-x-1/2 pt-3",
  above: "left-1/2 bottom-full -translate-x-1/2 pb-3",
  left: "right-full top-1/2 -translate-y-1/2 pr-3",
  right: "left-full top-1/2 -translate-y-1/2 pl-3",
};

// ── Cursor response, in viewBox units (about 0.9px each at full width) ─────
/** How far the whole graph leans towards the cursor, per unit from the centre. */
const LEAN = 0.025;
/** Radius within which a node is drawn towards the cursor. */
const PULL_RANGE = 170;
/** Share of the node-to-cursor distance a node travels, before falloff. */
const PULL = 0.22;
/**
 * Hard cap on any one node's travel. Nodes only ever move towards the pointer,
 * so the cap just keeps the effect subtle - it can never carry a node away
 * from the cursor and make it harder to click.
 */
const MAX_PULL = 14;
/** Fraction of the remaining distance covered each frame. */
const EASE = 0.16;

type Vec = { x: number; y: number };
const zero = (): Vec => ({ x: 0, y: 0 });
const rest = () => ({ lean: zero(), pull: MEMBERS.map(zero) });

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * The team as a network, in the same visual language as the How It Works
 * graph. Hovering, tapping or tabbing to a member lights their two edges and
 * opens a card with their name, role and GitHub profile. With a mouse, the
 * nearest node and the graph as a whole drift towards the cursor.
 */
export default function TeamGraph() {
  const [active, setActive] = useState<number | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [ref, visible] = useInView<HTMLDivElement>(0.3);

  // Motion state lives in refs and is written straight to the DOM each frame,
  // so following the cursor never re-renders the component. React sets the
  // edges' coordinates once, at their resting positions, and never again -
  // their props do not change - so the per-frame writes are not overwritten.
  const stageRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const target = useRef(rest());
  const current = useRef(rest());
  const scale = useRef(1);
  const frame = useRef(0);

  useEffect(
    () => () => {
      window.clearTimeout(closeTimer.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  function paint() {
    const c = current.current;
    const s = scale.current;
    if (stageRef.current) stageRef.current.style.transform = `translate3d(${c.lean.x * s}px, ${c.lean.y * s}px, 0)`;
    c.pull.forEach((p, i) => {
      const node = nodeRefs.current[i];
      if (node) node.style.transform = `translate3d(${p.x * s}px, ${p.y * s}px, 0)`;
      // Edge i joins member i to member i + 1, so both ends follow their nodes.
      const line = lineRefs.current[i];
      if (line) {
        const a = MEMBERS[i];
        const b = MEMBERS[(i + 1) % COUNT];
        const q = c.pull[(i + 1) % COUNT];
        line.setAttribute("x1", String(a.x + p.x));
        line.setAttribute("y1", String(a.y + p.y));
        line.setAttribute("x2", String(b.x + q.x));
        line.setAttribute("y2", String(b.y + q.y));
      }
    });
  }

  function step() {
    const c = current.current;
    const t = target.current;
    let moving = false;
    const ease = (from: Vec, to: Vec) => {
      from.x += (to.x - from.x) * EASE;
      from.y += (to.y - from.y) * EASE;
      if (Math.abs(to.x - from.x) > 0.05 || Math.abs(to.y - from.y) > 0.05) moving = true;
      else {
        from.x = to.x;
        from.y = to.y;
      }
    };
    ease(c.lean, t.lean);
    c.pull.forEach((p, i) => ease(p, t.pull[i]));
    paint();
    // The loop stops once everything has settled, so an idle page costs nothing.
    frame.current = moving ? requestAnimationFrame(step) : 0;
  }

  function kick() {
    if (!frame.current) frame.current = requestAnimationFrame(step);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    // Touch has no hover, and a node sliding under a finger is harder to tap.
    if (e.pointerType === "touch" || reducedMotion()) return;
    // Measured on the box, which never moves - measuring the stage would feed
    // its own lean back into the next reading.
    const box = e.currentTarget.getBoundingClientRect();
    const s = box.width / W;
    scale.current = s;
    const px = (e.clientX - box.left) / s;
    const py = (e.clientY - box.top) / s;
    target.current = {
      lean: { x: (px - CX) * LEAN, y: (py - CY) * LEAN },
      pull: MEMBERS.map(m => {
        const dx = px - m.x;
        const dy = py - m.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= PULL_RANGE) return zero();
        const f = PULL * (1 - dist / PULL_RANGE);
        let x = dx * f;
        let y = dy * f;
        const len = Math.hypot(x, y);
        if (len > MAX_PULL) {
          x *= MAX_PULL / len;
          y *= MAX_PULL / len;
        }
        return { x, y };
      }),
    };
    kick();
  }

  function onPointerLeave() {
    target.current = rest();
    kick();
  }

  const open = (i: number) => {
    window.clearTimeout(closeTimer.current);
    setActive(i);
  };
  const close = (i: number) => {
    window.clearTimeout(closeTimer.current);
    setActive(a => (a === i ? null : a));
  };
  // A short grace period, so moving from a node onto its card does not close it.
  const closeSoon = (i: number) => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setActive(a => (a === i ? null : a)), 180);
  };

  const lit = (i: number) =>
    active === null || i === active || i === (active + 1) % COUNT || i === (active + COUNT - 1) % COUNT;
  const edgeOn = (i: number) => active !== null && (i === active || (i + 1) % COUNT === active);

  return (
    // No panel around it: the graph sits straight on the page background. The
    // vertical padding only makes room for the name under the bottom node.
    <div className="py-6">
      <div
        ref={ref}
        className={`lp-graph relative mx-auto aspect-[36/29] w-full max-w-[640px] ${visible ? "is-visible" : ""}`}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={e => {
          if (e.target === e.currentTarget || e.target === stageRef.current) setActive(null);
        }}
      >
        <div ref={stageRef} className="absolute inset-0 will-change-transform">
          <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {MEMBERS.map((m, i) => {
              const next = MEMBERS[(i + 1) % COUNT];
              const on = edgeOn(i);
              return (
                <line
                  key={`${m.github}-${next.github}`}
                  ref={el => {
                    lineRefs.current[i] = el;
                  }}
                  className="lp-edge"
                  pathLength={1}
                  x1={m.x}
                  y1={m.y}
                  x2={next.x}
                  y2={next.y}
                  stroke={on && active !== null ? MEMBERS[active].color : "#1f3a5c"}
                  strokeWidth={on ? 2.4 : 1.6}
                  strokeOpacity={active !== null && !on ? 0.3 : on ? 0.9 : 1}
                  style={{ animationDelay: `${i * 90}ms`, transition: "stroke-opacity 180ms ease, stroke 180ms ease" }}
                />
              );
            })}
          </svg>

          {MEMBERS.map((m, i) => (
            <MemberNode
              key={m.github}
              nodeRef={el => {
                nodeRefs.current[i] = el;
              }}
              member={m}
              index={i}
              isActive={active === i}
              isLit={lit(i)}
              onOpen={() => open(i)}
              onClose={() => close(i)}
              onCloseSoon={() => closeSoon(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberNode({
  nodeRef,
  member: m,
  index,
  isActive,
  isLit,
  onOpen,
  onClose,
  onCloseSoon,
}: {
  nodeRef: (el: HTMLDivElement | null) => void;
  member: Member;
  index: number;
  isActive: boolean;
  isLit: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCloseSoon: () => void;
}) {
  // If the picture never arrives the circle simply stays blank, rather than
  // showing a broken-image icon.
  const [picture, setPicture] = useState<"loading" | "loaded" | "failed">("loading");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardId = `lp-team-${m.github}`;

  return (
    // Three layers, each owning one property: the outer element takes the
    // cursor pull (transform, written per frame) and the entrance fade
    // (opacity animation); the inner one takes the dimming (opacity). An
    // animation with fill-mode "forwards" would otherwise pin the opacity.
    <div
      ref={nodeRef}
      className="lp-node absolute will-change-transform"
      style={{
        left: `${(m.x / W) * 100}%`,
        top: `${(m.y / H) * 100}%`,
        zIndex: isActive ? 20 : 1,
        animationDelay: `${250 + index * 80}ms`,
      }}
    >
      <div
        className="relative -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200"
        style={{ opacity: isLit ? 1 : 0.3 }}
        onMouseEnter={onOpen}
        onMouseLeave={onCloseSoon}
        onFocus={onOpen}
        onBlur={e => {
          // Tabbing from the node into its own card keeps the card open.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onClose();
        }}
        onKeyDown={e => {
          if (e.key === "Escape") {
            // Focus first, then close: focusing the button would reopen it.
            buttonRef.current?.focus();
            onClose();
          }
        }}
      >
        <button
          ref={buttonRef}
          type="button"
          onClick={onOpen}
          aria-expanded={isActive}
          aria-controls={isActive ? cardId : undefined}
          aria-label={`${m.name}, ${m.role}`}
          className="relative block h-12 w-12 cursor-pointer rounded-full border-2 border-solid bg-transparent p-0 transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan motion-reduce:transition-none sm:h-16 sm:w-16 lg:h-20 lg:w-20"
          style={{
            borderColor: m.color,
            boxShadow: isActive ? `0 0 0 6px ${m.color}22, 0 0 28px ${m.color}59` : `0 0 18px ${m.color}26`,
          }}
        >
          <span
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{ background: `radial-gradient(circle at 35% 30%, ${m.color}40, ${m.color}0d 70%), #0a1628` }}
          >
            {/* no-referrer: GitHub has no need to learn which page is asking. */}
            {picture !== "failed" && (
              <img
                src={avatarSrc(m)}
                alt=""
                width={160}
                height={160}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={() => setPicture("loaded")}
                onError={() => setPicture("failed")}
                className={`block h-full w-full object-cover transition-opacity duration-300 ${picture === "loaded" ? "opacity-100" : "opacity-0"}`}
              />
            )}
          </span>
        </button>

        <span
          className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] transition-colors duration-200 sm:text-xs"
          style={{ color: isActive ? "#e2e8f0" : "#94a3b8" }}
        >
          {m.name.split(" ")[0]}
        </span>

        {isActive && (
          <div id={cardId} className={`absolute z-20 w-48 sm:w-56 ${PLACEMENT[m.side]}`}>
            <div
              className="rounded-md border border-border bg-[#081222]/95 px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm"
              style={{ borderTopColor: m.color }}
            >
              <p className="m-0 text-sm font-medium text-text">{m.name}</p>
              <p className="m-0 mt-1 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: m.color }}>
                {m.role}
              </p>
              <a
                href={`https://github.com/${m.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-flex max-w-full items-start gap-1.5 font-mono text-xs leading-snug text-muted2 no-underline transition-colors duration-150 hover:text-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" className="mt-px shrink-0">
                  <path d={GITHUB_MARK} />
                </svg>
                <span className="min-w-0 [overflow-wrap:anywhere]">{m.github}</span>
                <span className="sr-only">, {m.name} on GitHub (opens in a new tab)</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}