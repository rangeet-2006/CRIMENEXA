/**
 * Scroll to a landing-page section by id, honouring reduced motion. The hash
 * is updated without a jump so the address stays shareable, and focus moves to
 * the section so keyboard and screen-reader users land where they asked to.
 */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", id === "top" ? window.location.pathname : `#${id}`);
  el.focus({ preventScroll: true });
}