"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";
import { canAnimateReorder, reorderPass } from "./gate";
import { useMotionLayer } from "./layer";
import { usePrefersReducedMotion } from "./reduced-motion";

/**
 * Card grid whose items glide to their new place when sort or filter reorders them (FLIP: React keeps keyed DOM
 * nodes, so each child is measured after every commit and played back from its old offset with a Framer spring).
 * Transform only, nothing hidden. Skipped automatically above REORDER_MAX (60) items, under reduced motion and
 * until the deferred Framer layer is loaded (then items simply jump, as before).
 */
export function ReorderGroup({ children, className, as = "div", label }: {
  children: ReactNode; className?: string; as?: "div" | "ul" | "ol"; label?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const last = useRef(new WeakMap<object, { x: number; y: number }>());
  const kit = useMotionLayer();
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
    const play = kit != null && canAnimateReorder(items.length, reduced);
    return reorderPass(items, last.current, (item, dx, dy) => kit!.flip(item, dx, dy), play);
  });
  const C = as;
  return <C ref={ref as never} className={className} aria-label={label}>{children}</C>;
}
