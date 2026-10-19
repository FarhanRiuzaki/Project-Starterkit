"use client";

import { type RefObject, useCallback } from "react";
import { DUR } from "../motion";

/** Longest chart mount animation: bar grow (DUR.slow) + its 200 ms stagger cap, and the 400 ms line draw, + margin. */
const SETTLE_MS = Math.round((DUR.slow + 0.32) * 1000);

/**
 * Mount animations (bar grow, line draw, label fade) play once per chart. Recharts remounts a series' shapes whenever
 * the series re-renders (it keys them on the identity of its props: a hover, a refetch, a resize), which would replay
 * them: the flicker. Once they have played, `data-settled` on the plot turns them off (charts.css), so a remount shows
 * the final state. Returns a callback ref (the plot may mount after the component, e.g. after an empty state);
 * `hostRef`, when given, also receives the element.
 */
export function useSettled(hostRef?: RefObject<HTMLDivElement | null>) {
  return useCallback((el: HTMLDivElement | null) => {
    if (hostRef) hostRef.current = el;
    if (!el || el.hasAttribute("data-settled")) return;
    setTimeout(() => el.setAttribute("data-settled", ""), SETTLE_MS);
  }, [hostRef]);
}
