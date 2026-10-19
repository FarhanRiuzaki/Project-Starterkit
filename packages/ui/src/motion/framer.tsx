"use client";

/**
 * The deferred motion (motion.dev) chunk: imported only by layer.tsx with a dynamic `import()` after idle, so none of
 * motion is in any route's first-load JS (gate test in layer.test.ts). Each piece wraps itself in
 * LazyMotion (domMax: `layoutId` needs it) + MotionConfig reducedMotion="user" (no transform / layout animation
 * under prefers-reduced-motion, opacity kept), so the app tree never gains or loses a provider.
 */
import { animate, AnimatePresence, domMax, LazyMotion, m, MotionConfig, useIsPresent } from "motion/react";
// Internal Next API, pinned to Next 16.3.8: recheck (rename or split context instance) on every Next upgrade.
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { type ReactNode, useContext, useState } from "react";
import type { MotionKit } from "./layer";
import { DUR, EASE, SHIFT_ENTER, SPRING_FLIP, SPRING_INDICATOR, SPRING_TWEEN } from "./tokens";

function Scope({ children }: { children: ReactNode }) {
  return <LazyMotion features={domMax} strict><MotionConfig reducedMotion="user">{children}</MotionConfig></LazyMotion>;
}

function Indicator({ layoutId, className, radius }: { layoutId: string; className?: string; radius?: number }) {
  // borderRadius in style lets the projection correct the radius while the box scales between options.
  return <Scope><m.span aria-hidden="true" data-slot="motion-indicator" layoutId={layoutId} className={className}
    transition={SPRING_INDICATOR} style={radius == null ? undefined : { borderRadius: radius }} /></Scope>;
}

/**
 * Keeps an exiting page on the route it was rendered for: the App Router swaps the context under `children` on
 * navigation, so without this the old page would re-render as the new one during its exit. The present page
 * always follows the live context (search-param changes, refreshes).
 */
function Frozen({ children }: { children: ReactNode }) {
  const live = useContext(LayoutRouterContext);
  const present = useIsPresent();
  const [kept, setKept] = useState(live);
  if (present && kept !== live) setKept(live);
  // The exiting copy is inert and hidden from assistive tech: for --dur-exit both pages are in the DOM, and only the
  // new one may be read, focused or matched (one h1 per page).
  return (
    <div className="grid min-w-0" inert={!present} aria-hidden={present ? undefined : true}>
      <LayoutRouterContext.Provider value={present ? live : kept}>{children}</LayoutRouterContext.Provider>
    </div>
  );
}

/**
 * Page crossfade (spec §7.2): popLayout, so the new page is in place at once (navigation never waits for the
 * exit) while the old one is lifted out of flow and fades over --dur-exit without movement; the new one fades +
 * rises 6 px over --dur-page. Reduced motion: opacity only, 100 ms. The exiting page takes no pointer input; a page
 * that comes back while still leaving (quick Back, A → B → A) gets it again (`pointerEvents: "auto"` in animate).
 */
function PageSwap({ routeKey, reduced, children }: { routeKey: string; reduced: boolean; children: ReactNode }) {
  const enter = reduced ? { duration: DUR.instant, ease: EASE.linear } : { duration: DUR.page, ease: EASE.out };
  const exit = reduced ? { duration: DUR.instant, ease: EASE.linear } : { duration: DUR.exit, ease: EASE.in };
  return (
    <Scope>
      <div className="relative grid min-w-0">
        <AnimatePresence mode="popLayout">
          <m.div key={routeKey} data-page-swap="" className="grid min-w-0"
            initial={{ opacity: 0, y: reduced ? 0 : SHIFT_ENTER }} animate={{ opacity: 1, y: 0, pointerEvents: "auto", transition: enter }}
            exit={{ opacity: 0, pointerEvents: "none", transition: exit }}>
            <Frozen>{children}</Frozen>
          </m.div>
        </AnimatePresence>
      </div>
    </Scope>
  );
}

export const kit: MotionKit = {
  Indicator,
  PageSwap,
  tween({ from, to, seconds, onUpdate }) {
    const c = animate(from, to, { ...SPRING_TWEEN, duration: seconds, onUpdate, onComplete: () => onUpdate(to) });
    return () => c.stop();
  },
  flip(el, dx, dy) {
    const c = animate(el, { x: [dx, 0], y: [dy, 0] }, SPRING_FLIP);
    return () => c.stop();
  },
};
