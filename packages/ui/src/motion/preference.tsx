"use client";

import { createContext, useContext, type ReactNode } from "react";

const Reduced = createContext(false);
/** A local preview may reduce motion, but can never opt out of its parent's or the system's preference. */
export function ReducedMotionScope({ active, children }: { active: boolean; children: ReactNode }) {
  const parent = useContext(Reduced);
  return <Reduced.Provider value={parent || active}>{children}</Reduced.Provider>;
}
export function useReducedMotionScope(): boolean { return useContext(Reduced); }
