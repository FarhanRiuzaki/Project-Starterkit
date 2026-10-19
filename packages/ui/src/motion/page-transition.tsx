"use client";

import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { armPageSwap, type PageSwapState } from "./gate";
import { useMotionLayer } from "./layer";
import { usePrefersReducedMotion } from "./reduced-motion";

const Swapping = createContext(false);
type Hold = (shape: ReactNode, until: number) => void;
const HoldContext = createContext<Hold>(() => undefined);

/**
 * For a route loading shape (`loading.tsx`): Next drops it the moment the page is ready, so a shape that has been on
 * screen for less than its minimum (LOADING.minVisible) calls this as it goes, with itself and the time it may leave;
 * PageTransition keeps it over the page, which waits hidden underneath, until then. No flash at route level either.
 */
export const useHoldShape = (): Hold => useContext(HoldContext);

/**
 * Page enter (spec §7.2), mounted by `app/(main)/template.tsx`, which Next re-creates per route segment (never on
 * search-param changes; the shell never animates). Default: a CSS animation (`animate-page-enter`: opacity 0 → 1 +
 * y 6 → 0 over --dur-page, reduced motion opacity only) that runs without waiting for JavaScript, so server HTML is
 * never stuck hidden. Once `PageTransitionRoot` has switched to the Framer crossfade it owns the enter and this
 * wrapper drops its CSS animation. It also holds a route loading shape for its minimum time (useHoldShape); the page
 * then fades in under it. `data-page` marks the page's box (a route loading shape copies it while it waits).
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const swapping = useContext(Swapping);
  const [held, setHeld] = useState<{ shape: ReactNode; until: number } | null>(null);
  const [wasHeld, setWasHeld] = useState(false);
  const hold = useCallback<Hold>((shape, until) => { if (until > performance.now()) { setHeld({ shape, until }); setWasHeld(true); } }, []);
  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(null), held.until - performance.now());
    return () => clearTimeout(t);
  }, [held]);
  return (
    <HoldContext.Provider value={hold}>
      <div className={cn("grid min-w-0 gap-section *:col-start-1 *:row-start-1", !swapping && "animate-page-enter", className)}>
        {held && <div className="min-w-0">{held.shape}</div>}
        <div data-page="" className={cn("grid min-w-0 gap-section", held ? "invisible" : wasHeld && "animate-reveal-in")}>{children}</div>
      </div>
    </HoldContext.Provider>
  );
}

/**
 * Layout-level page transitions, in `app/(main)/layout.tsx` around the page slot. Renders `children` as is until
 * the deferred Framer layer is loaded; from the first route change after that (`armPageSwap`: the page subtree is
 * replaced then anyway, so no open page remounts) it wraps them in AnimatePresence keyed by pathname, giving the
 * exit fade CSS cannot do. Blocked or late framer chunk → the CSS enter keeps working.
 */
export function PageTransitionRoot({ children }: { children: ReactNode }) {
  const kit = useMotionLayer();
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<PageSwapState>({ loadedOn: null, armed: false });
  const next = armPageSwap(state, kit != null, pathname);
  if (next !== state) setState(next);
  const on = kit != null && next.armed;
  return (
    <Swapping.Provider value={on}>
      {on ? <kit.PageSwap routeKey={pathname} reduced={reduced}>{children}</kit.PageSwap> : children}
    </Swapping.Provider>
  );
}
