"use client";

import { type RefObject, useEffect, useState } from "react";
import { frameScheduler } from "./frame";

export type IndicatorBox = { x: number; width: number };

/**
 * Shared-layout indicator in CSS (spec §7.3 without domMax): measures the active child of `ref` (matched by
 * `selector`) relative to the container and returns its x / width, re-measured on resize and whenever the active
 * child changes (attribute mutation). The caller renders one absolutely positioned element with
 * `transform: translateX(x)` + `width` and the `indicator-move` transition. `null` until measured: until then
 * (server HTML, no JS) the active child styles itself, so the selection is always visible.
 * Measured in the next animation frame (coalesced), never inside the React commit: a read there forced a full
 * synchronous layout in the hydration / navigation long task. ResizeObserver callbacks run after layout and read
 * directly.
 */
export function useIndicator(ref: RefObject<HTMLElement | null>, selector: string, deps: unknown[] = []): IndicatorBox | null {
  const [box, setBox] = useState<IndicatorBox | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const a = el.querySelector<HTMLElement>(selector);
      if (!a) { setBox(null); return; }
      const next = { x: a.offsetLeft, width: a.offsetWidth };
      setBox((b) => (b && b.x === next.x && b.width === next.width ? b : next));
    };
    const frame = frameScheduler(measure);
    frame.schedule();
    const mo = new MutationObserver(frame.schedule);
    mo.observe(el, { subtree: true, attributes: true, attributeFilter: ["data-state", "aria-checked", "aria-selected"] });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => { frame.cancel(); mo.disconnect(); ro?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's (e.g. the option list)
  }, [ref, selector, ...deps]);
  return box;
}
