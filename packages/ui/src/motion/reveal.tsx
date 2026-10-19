"use client";

import { type ReactNode, useEffect, useState } from "react";
import { cn } from "../lib/cn";

/**
 * Skeleton → content crossfade (spec §7.2), in CSS. Both layers share one grid cell, so the region keeps the
 * skeleton's height and nothing shifts: the skeleton fades out in 150 ms (`animate-reveal-out`) while the content
 * fades in over 220 ms (`animate-reveal-in`); the skeleton is removed after its fade. Content that is ready on the
 * first render (cache hit) shows without animation. Pure CSS keyframes: the server HTML is visible as is, and
 * nothing waits for JavaScript or the lazy motion feature chunk (reduced motion: 100 ms opacity, globals.css).
 */
export function Reveal({ loading, skeleton, children, className }: {
  loading: boolean; skeleton: ReactNode; children: ReactNode; className?: string;
}) {
  const [startedLoading] = useState(loading);
  const [skeletonGone, setSkeletonGone] = useState(!loading);
  // Back to loading (e.g. a new filter with no cached data): show the skeleton again. Adjusted while rendering.
  if (loading && skeletonGone) setSkeletonGone(false);
  const fading = !loading && !skeletonGone;
  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => setSkeletonGone(true), 200);
    return () => clearTimeout(t);
  }, [fading]);

  return (
    <div className={cn("grid *:col-start-1 *:row-start-1", className)} aria-busy={loading || undefined}>
      {!skeletonGone && (
        <div aria-hidden="true" data-reveal="skeleton" className={cn("min-w-0", fading && "pointer-events-none animate-reveal-out")}>{skeleton}</div>
      )}
      {!loading && <div data-reveal="content" className={cn("min-w-0", startedLoading && "animate-reveal-in")}>{children}</div>}
    </div>
  );
}
