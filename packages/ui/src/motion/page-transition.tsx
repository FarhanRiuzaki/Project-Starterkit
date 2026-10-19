"use client";

import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useState } from "react";
import { cn } from "../lib/cn";
import { armPageSwap, type PageSwapState } from "./gate";
import { useMotionLayer } from "./layer";
import { usePrefersReducedMotion } from "./reduced-motion";

const Swapping = createContext(false);

/**
 * Page enter (spec §7.2), mounted by `app/(main)/template.tsx`, which Next re-creates per route segment (never on
 * search-param changes; the shell never animates). Default: a CSS animation (`animate-page-enter`: opacity 0 → 1 +
 * y 6 → 0 over --dur-page, reduced motion opacity only) that runs without waiting for JavaScript, so server HTML is
 * never stuck hidden. Once `PageTransitionRoot` has switched to the Framer crossfade it owns the enter and this
 * wrapper drops its CSS animation.
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const swapping = useContext(Swapping);
  return <div className={cn("grid min-w-0 gap-section", !swapping && "animate-page-enter", className)}>{children}</div>;
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
