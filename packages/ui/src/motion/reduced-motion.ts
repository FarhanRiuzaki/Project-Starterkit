"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotionScope } from "./preference";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const read = () => typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches;

/** prefers-reduced-motion as a hook (server: false). A few bytes instead of motion's useReducedMotion. */
export function usePrefersReducedMotion(): boolean {
  const scoped = useReducedMotionScope();
  const system = useSyncExternalStore(subscribe, read, () => false);
  return scoped || system;
}
