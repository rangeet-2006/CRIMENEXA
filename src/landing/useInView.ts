import { useEffect, useRef, useState } from "react";

/**
 * True once the element has scrolled into view. It never flips back, so an
 * entrance animation plays once instead of replaying on every scroll pass.
 *
 * IntersectionObserver does the work, backed by a plain geometry check on mount
 * and on scroll. Callers hide content until this turns true, so a missed
 * observer callback (a throttled background tab, for one) must not be able to
 * leave it invisible.
 */
export default function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    const check = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (vh <= 0 || r.height <= 0) return;
      // Measured against the viewport as well as the element, so a section
      // taller than the screen can still reach the threshold. The observer's
      // own ratio never can, for anything over 1/threshold screens tall.
      const onScreen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (onScreen >= Math.min(r.height, vh) * threshold) setInView(true);
    };

    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    // Last-resort poll. Scroll events and observer callbacks are both delivered
    // during the browser rendering steps, so a page that is not painting - a
    // preview pane, a throttled background tab - can receive neither while its
    // layout still scrolls. Cheap, and it stops as soon as the element shows.
    const poll = window.setInterval(check, 400);

    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        entries => {
          if (entries.some(e => e.isIntersecting)) setInView(true);
        },
        { threshold },
      );
      io.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.clearInterval(poll);
      io?.disconnect();
    };
  }, [inView, threshold]);

  return [ref, inView] as const;
}