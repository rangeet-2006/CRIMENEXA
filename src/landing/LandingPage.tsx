import { useState, type CSSProperties, type ReactNode } from "react";
import HeroVisual from "./HeroVisual";
import LandingNav from "./LandingNav";
import MiniGraph from "./MiniGraph";
import PriorityList from "./PriorityList";
import useInView from "./useInView";
import { scrollToSection } from "./scroll";
import { FEATURES, SAFEGUARDS, STEPS, TYPE_COLOR, TYPE_LABEL, type EntityType } from "./landingData";
import { STACK_LOGOS } from "./stackLogos";
import TeamGraph from "./TeamGraph";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo-wordmark.png`;

const PRIMARY_BTN =
  "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-[linear-gradient(135deg,#00d4ff,#0099bb)] px-7 font-display text-[15px] font-bold uppercase tracking-[0.08em] text-background transition duration-200 hover:-translate-y-px hover:shadow-[0_0_24px_rgba(0,212,255,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan";

/**
 * The public front door. Every navbar link scrolls within this one page, and
 * "Get started" / "Sign in" hand over to the app's existing login.
 */
export default function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  // Shared by the graph and the priority list, so hovering either one
  // highlights the same entity in both.
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="min-h-dvh bg-background text-text">
      <LandingNav onSignIn={onEnterApp} />

      <main id="main" tabIndex={-1} className="outline-none">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section id="top" tabIndex={-1} className="relative overflow-hidden pt-16 outline-none">
          <div
            aria-hidden="true"
            className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_75%)]"
          />
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,212,255,0.10),transparent_70%)]"
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-32 lg:pt-24">
            <div>
              <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/[0.06] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">
                <span className="animate-pulse-cyan h-1.5 w-1.5 rounded-full bg-cyan" aria-hidden="true" />
                AI-powered criminal network analysis
              </p>
              <h1 className="m-0 text-[44px] font-bold leading-[1.02] sm:text-6xl lg:text-[68px]">
                See the network <span className="text-cyan">behind every case.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted2 sm:text-lg">
                CrimeNexa turns call records, bank statements, FIRs and location data into one investigation graph,
                then ranks who matters most and shows you why.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <button type="button" onClick={onEnterApp} className={PRIMARY_BTN}>
                  Get started
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("how-it-works")}
                  className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-md border border-border bg-white/[0.03] px-6 font-display text-[15px] font-semibold uppercase tracking-[0.08em] text-text transition-colors duration-150 hover:border-cyan/40 hover:text-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
                >
                  See how it works
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="pb-10 lg:pb-0">
              <HeroVisual />
            </div>
          </div>

          {/* Built-with strip: the counterpart of the reference's logo row. The
              list is doubled so the scroll loops seamlessly; the copy is hidden
              from screen readers so each name is announced once. */}
          <div className="relative border-y border-border bg-surface/40">
            <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-5 sm:px-8">
              <p className="m-0 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-muted2">Built with</p>
              <div className="lp-marquee-wrap relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
                <ul className="lp-marquee m-0 flex w-max list-none items-center gap-14 p-0">
                  {[...STACK_LOGOS, ...STACK_LOGOS].map((logo, i) => (
                    <li
                      key={`${logo.slug}-${i}`}
                      aria-hidden={i >= STACK_LOGOS.length ? true : undefined}
                      title={logo.name}
                      className="flex text-muted2 transition-colors duration-200 hover:text-[var(--brand)]"
                      style={{ ["--brand" as string]: logo.hex } as CSSProperties}
                    >
                      <svg role="img" aria-label={logo.name} viewBox="0 0 24 24" width="32" height="32" fill="currentColor" className="block h-8 w-8">
                        <path d={logo.path} />
                      </svg>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section id="features" tabIndex={-1} className="scroll-mt-16 outline-none">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
            <SectionHeading
              eyebrow="Features"
              title="Everything an investigation leaves behind, in one place."
              body="From a stack of uploads to a ranked list of leads, without re-keying a single record."
            />

            {/* gap-px over a border-coloured backdrop draws hairline dividers
                between cards without doubling borders where they meet. */}
            <Reveal className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(f => (
                <article key={f.tag} className="bg-background p-7 transition-colors duration-200 hover:bg-surface">
                  <p className="m-0 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">{f.tag}</p>
                  <h3 className="mt-4 mb-0 text-2xl font-bold">{f.title}</h3>
                  <p className="mt-3 mb-0 text-[15px] leading-relaxed text-muted2">{f.body}</p>
                </article>
              ))}
            </Reveal>

            <ul className="mt-8 grid list-none gap-3 p-0 sm:grid-cols-3">
              {SAFEGUARDS.map(s => (
                <li key={s} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted2">
                  <svg className="mt-0.5 shrink-0 text-cyan" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how-it-works" tabIndex={-1} className="scroll-mt-16 border-t border-border bg-surface/30 outline-none">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
            <SectionHeading eyebrow="How it works" title="From raw evidence to a ranked list of leads." />

            <ol className="mt-14 grid list-none gap-8 p-0 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="border-t border-border pt-6">
                  <p className="m-0 font-mono text-sm text-cyan">0{i + 1}</p>
                  <h3 className="mt-3 mb-0 text-2xl font-bold">{s.title}</h3>
                  <p className="mt-2 mb-0 text-[15px] leading-relaxed text-muted2">{s.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-16 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                  <h3 className="m-0 text-sm font-bold uppercase tracking-[0.1em] text-muted2">Network graph</h3>
                  <p className="m-0 font-mono text-[10.5px] text-muted2">Hover, tap or tab to a node</p>
                </div>
                <div className="grid-bg p-3 sm:p-5">
                  <MiniGraph activeId={activeId} onActiveChange={setActiveId} />
                </div>
                <Legend />
              </div>
              <PriorityList activeId={activeId} onActiveChange={setActiveId} />
            </div>
          </div>
        </section>

        {/* ── About us ─────────────────────────────────────────────────── */}
        <section id="about" tabIndex={-1} className="scroll-mt-16 border-t border-border outline-none">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
            <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.25fr]">
              <SectionHeading
                eyebrow="About us"
                title="Built by Team X--COM."
                body="We are a team of six building CrimeNexa for Smart India Hackathon 2026, so investigators can spend their hours on the right leads instead of the paperwork around them."
              />
              <TeamGraph />
            </div>
          </div>
        </section>

        {/* ── Closing call to action ───────────────────────────────────── */}
        <section className="border-t border-border bg-surface/30">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="m-0 text-4xl font-bold sm:text-5xl">Ready to see the network?</h2>
              <p className="mt-3 mb-0 max-w-lg text-muted2">Sign in with your department account, or create one to explore a case.</p>
            </div>
            <button type="button" onClick={onEnterApp} className={`${PRIMARY_BTN} shrink-0`}>
              Get started
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted2 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <img src={LOGO_SRC} alt="CrimeNexa" width={110} height={22} className="block h-auto w-[110px] opacity-80" />
          <p className="m-0">© 2026 Team X--COM · Smart India Hackathon 2026</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  const [ref, visible] = useInView<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className={`lp-reveal max-w-3xl ${visible ? "is-visible" : ""}`}>
      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">{eyebrow}</p>
      <h2 className="mt-4 mb-0 text-4xl font-bold leading-[1.05] sm:text-5xl">{title}</h2>
      {body && <p className="mt-5 mb-0 text-base leading-relaxed text-muted2 sm:text-lg">{body}</p>}
    </div>
  );
}

function Reveal({ className = "", children }: { className?: string; children: ReactNode }) {
  const [ref, visible] = useInView<HTMLDivElement>(0.15);
  return (
    <div ref={ref} className={`lp-reveal ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3">
      {(Object.keys(TYPE_COLOR) as EntityType[]).map(t => (
        <span key={t} className="flex items-center gap-1.5 text-xs text-muted2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} aria-hidden="true" />
          {TYPE_LABEL[t]}
        </span>
      ))}
      <span className="ml-auto font-mono text-[10.5px] text-muted2">Ring = risk score</span>
    </div>
  );
}