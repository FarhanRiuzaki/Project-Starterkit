"use client";

import { useRef } from "react";

type ChangeState = { value: unknown; n: number };

const same = (a: unknown, b: unknown) => Object.is(a, b) || (typeof a === "object" && a !== null && JSON.stringify(a) === JSON.stringify(b));

/** R5, pure: the first call sets the baseline (n = 0); every later change of `value` increments n. */
export function nextChangeKey(prev: ChangeState | null, value: unknown): ChangeState {
  if (prev == null) return { value, n: 0 };
  return same(prev.value, value) ? prev : { value, n: prev.n + 1 };
}

/**
 * 0 until `value` changes after the first render, then +1 per change: key an element on it to replay a CSS enter.
 * The count only ever grows, so the key (and the running animation) survives incidental re-renders.
 */
export function useChangeKey(value: unknown): number {
  const s = useRef<ChangeState | null>(null);
  // eslint-disable-next-line react-hooks/refs -- a render-phase ref fold is idempotent for equal values (same as useNewKeys)
  s.current = nextChangeKey(s.current, value);
  // eslint-disable-next-line react-hooks/refs
  return s.current.n;
}
