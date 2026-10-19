"use client";

import { type ReactNode, useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { DUR } from "./tokens";
import { useDelayedFlag } from "./use-delayed-flag";

/**
 * Skeleton → content crossfade (spec §7.2), in CSS, without flashes. Both layers share one grid cell, so the region
 * keeps the skeleton's height and nothing shifts. The skeleton holds the place hidden for the first 150 ms of
 * loading and shows only after that; once shown it stays at least 300 ms (useDelayedFlag, LOADING tokens), then fades
 * out in 150 ms (`animate-reveal-out`) while the content fades in over 220 ms (`animate-reveal-in`). A fast load never
 * shows the skeleton. Content that is ready on the first render (server-prefetched or cached) shows without
 * animation. Pure CSS keyframes: the server HTML is visible as is (reduced motion: 100 ms opacity, globals.css).
 */
export function Reveal({ loading, skeleton, children, className }: {
  loading: boolean; skeleton: ReactNode; children: ReactNode; className?: string;
}) {
  const shown = useDelayedFlag(loading);
  const [startedLoading] = useState(loading);
  const [wasShown, setWasShown] = useState(shown);
  const [fading, setFading] = useState(false);
  // The skeleton was on screen and goes away: fade it out. Adjusted while rendering.
  if (wasShown !== shown) { setWasShown(shown); setFading(!shown); }
  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => setFading(false), DUR.enter * 1000);
    return () => clearTimeout(t);
  }, [fading]);
  const waiting = loading || shown;

  return (
    <div className={cn("grid *:col-start-1 *:row-start-1", className)} aria-busy={shown || undefined}>
      {(waiting || fading) && (
        <div aria-hidden="true" data-reveal="skeleton" className={cn("min-w-0", !shown && !fading && "invisible", fading && "pointer-events-none animate-reveal-out")}>{skeleton}</div>
      )}
      {!waiting && <div data-reveal="content" className={cn("min-w-0", startedLoading && "animate-reveal-in")}>{children}</div>}
    </div>
  );
}
