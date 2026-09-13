import { useEffect, useState } from "react";
import { scrollToSection } from "./scroll";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo-wordmark.png`;

const LINKS = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How It Works" },
  { id: "about", label: "About Us" },
];

/**
 * Fixed top bar. Every link scrolls to a section on this page rather than
 * opening a new one, and the link for the section in view is highlighted.
 */
export default function LandingNav({ onSignIn }: { onSignIn: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight whichever section occupies the middle band of the viewport.
  useEffect(() => {
    const els = LINKS.map(l => document.getElementById(l.id)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function go(id: string) {
    setOpen(false);
    scrollToSection(id);
  }

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        solid ? "border-border bg-background/85 backdrop-blur-md" : "border-transparent bg-transparent"
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-cyan focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
      >
        Skip to content
      </a>

      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <button
          type="button"
          onClick={() => go("top")}
          className="cursor-pointer border-0 bg-transparent p-0"
          aria-label="CrimeNexa, back to top"
        >
          <img src={LOGO_SRC} alt="" width={132} height={26} className="block h-auto w-[132px]" />
        </button>

        <ul className="m-0 hidden list-none items-center gap-1 p-0 md:flex">
          {LINKS.map(l => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                onClick={e => {
                  e.preventDefault();
                  go(l.id);
                }}
                aria-current={active === l.id ? "location" : undefined}
                className={`rounded-md px-3.5 py-2 text-sm no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-cyan ${
                  active === l.id ? "text-cyan" : "text-muted2 hover:text-text"
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSignIn}
            className="hidden h-10 cursor-pointer items-center rounded-md border border-cyan/40 bg-transparent px-4 font-display text-sm font-semibold uppercase tracking-[0.08em] text-cyan transition-colors duration-150 hover:bg-cyan/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan sm:inline-flex"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-controls="lp-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-text md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div id="lp-mobile-menu" className="border-t border-border px-5 pb-5 pt-2 md:hidden">
          <ul className="m-0 list-none p-0">
            {LINKS.map(l => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  onClick={e => {
                    e.preventDefault();
                    go(l.id);
                  }}
                  className="block py-3 text-base text-text no-underline"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onSignIn} className="btn-secondary mt-2 w-full">
            Sign in
          </button>
        </div>
      )}
    </header>
  );
}