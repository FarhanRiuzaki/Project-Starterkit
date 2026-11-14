import { useEffect } from "react";

/**
 * A page body mounts after hydration, so the browser (and Next's router) found no element for the URL's #hash when the
 * page arrived. Called by the body: once it is mounted, jump to that element. Never animated, so there is nothing to
 * reduce under prefers-reduced-motion; the target's own `scroll-mt-*` keeps it clear of the top bar.
 */
export function useHashScroll() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
  }, []);
}
