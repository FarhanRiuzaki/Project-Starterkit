"use client";

import { type ComponentType, createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { createLoader, whenIdle } from "./gate";

/** What the deferred chunk (framer.tsx) provides once loaded. Nothing here is in the first-load JS. */
export type MotionKit = {
  /** Shared-layout indicator (`layoutId`, spec §7.3 spring). Render it inside the active option only. */
  Indicator: ComponentType<{ layoutId: string; className?: string; radius?: number }>;
  /** AnimatePresence page crossfade keyed by `routeKey` (spec §7.2). */
  PageSwap: ComponentType<{ routeKey: string; reduced: boolean; children: ReactNode }>;
  /** Spring from → to over ~`seconds` (no overshoot); returns stop. Ends exactly on `to`. */
  tween: (o: { from: number; to: number; seconds: number; onUpdate: (v: number) => void }) => () => void;
  /** FLIP: play `el` from an offset of (dx, dy) back to its new place; returns stop. */
  flip: (el: HTMLElement, dx: number, dy: number) => () => void;
};

const loader = createLoader<MotionKit>(() => import("./framer").then((m) => m.kit));
const Ctx = createContext<MotionKit | null>(null);

/**
 * Deferred Framer Motion layer. Renders its children unchanged (same tree before and after load, so nothing
 * remounts) and, once the main thread is idle after hydration, imports the framer chunk (LazyMotion + domMax,
 * MotionConfig reducedMotion="user" inside each piece). Until then — and for good if the chunk is late or blocked —
 * every consumer keeps its CSS motion, so content is always visible and usable.
 */
export function MotionLayer({ children }: { children: ReactNode }) {
  const [kit, setKit] = useState<MotionKit | null>(null);
  useEffect(() => {
    let live = true;
    const go = () => void loader.load().then((k) => { if (live && k) setKit(k); });
    // Already loaded (the layout remounted after a client navigation): resolve on the next microtask, no idle wait.
    const cancel = loader.get() ? (go(), () => undefined) : whenIdle(go);
    return () => { live = false; cancel(); };
  }, []);
  return <Ctx.Provider value={kit}>{children}</Ctx.Provider>;
}

/** The loaded framer kit, or null (not loaded yet, blocked, or outside a MotionLayer): fall back to CSS. */
export function useMotionLayer(): MotionKit | null {
  return useContext(Ctx);
}
