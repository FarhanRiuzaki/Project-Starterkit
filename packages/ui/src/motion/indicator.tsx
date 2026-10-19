"use client";

import { useMotionLayer } from "./layer";

/**
 * Shared-layout indicator (spec §7.3) for Segmented and Tabs: render it inside the active option only, with one
 * `layoutId` per control instance; Framer moves it between options with the indicator spring. Renders nothing until
 * the deferred layer is loaded — the control then draws its CSS indicator instead (check `useMotionLayer()`).
 */
export function SharedIndicator({ layoutId, className, radius }: { layoutId: string; className?: string; radius?: number }) {
  const kit = useMotionLayer();
  return kit ? <kit.Indicator layoutId={layoutId} className={className} radius={radius} /> : null;
}
