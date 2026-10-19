"use client";

import { useEffect, useReducer, useRef } from "react";
import { DUR } from "./tokens";

const EMPTY: ReadonlySet<string> = new Set();

export type NewKeysState = { scope: string; seen: ReadonlySet<string> | null };
export type NewKeysOpts = {
  enabled: boolean;
  /** Signature of the list's filter / query. A different scope is a different list: it re-baselines, nothing is new. */
  scope?: string;
};

/**
 * R4. The first non-empty key list of a scope is the baseline, so a page load, a filter change or a new query never
 * flashes. After that, a key not seen before is `fresh` in the render it first appears in only (the hook below holds
 * it for the flash). Paging back to or reordering seen keys is never new. Pure: the hook only stores `state`.
 */
export function nextNewKeys(prev: NewKeysState | null, keys: readonly string[], { enabled, scope = "" }: NewKeysOpts): { state: NewKeysState | null; fresh: ReadonlySet<string> } {
  if (!enabled) return { state: null, fresh: EMPTY };
  if (prev == null || prev.scope !== scope || prev.seen == null) {
    return { state: { scope, seen: keys.length > 0 ? new Set(keys) : null }, fresh: EMPTY };
  }
  const fresh = new Set<string>();
  let next: Set<string> | null = null;
  for (const k of keys) {
    if (prev.seen.has(k)) continue;
    next ??= new Set(prev.seen);
    next.add(k);
    fresh.add(k);
  }
  return { state: next ? { scope, seen: next } : prev, fresh: fresh.size ? fresh : EMPTY };
}

/** Flash expiry: drop keys whose time is up, then give each fresh key `ms` from `now`. Pure. */
export function nextUntil(until: ReadonlyMap<string, number>, fresh: ReadonlySet<string>, now: number, ms: number): Map<string, number> {
  const next = new Map<string, number>();
  for (const [k, t] of until) if (t > now) next.set(k, t);
  for (const k of fresh) next.set(k, now + ms);
  return next;
}

/**
 * Keys that arrived since the baseline, held for the flash (`DUR.flash`), unlike `nextNewKeys`, which reports them in
 * their first render only: a re-render inside the flash (a query settling, a menu closing) must not drop the row's
 * class and cancel its CSS animation. After the flash, one timer re-renders so a stale `data-new` is removed even when
 * no data changes; a refetch of the same keys never re-adds them. Mutates a ref during render; that is safe under
 * StrictMode's double render because the second pass sees an unchanged `seen` and keeps the held keys.
 */
export function useNewKeys(keys: readonly string[], opts: NewKeysOpts): ReadonlySet<string> {
  const store = useRef<{ state: NewKeysState | null; until: ReadonlyMap<string, number> }>({ state: null, until: new Map() });
  /* eslint-disable react-hooks/refs, react-hooks/purity -- deliberate: see above */
  const r = nextNewKeys(store.current.state, keys, opts);
  const until = nextUntil(store.current.until, r.fresh, Date.now(), DUR.flash * 1000);
  store.current = { state: r.state, until };
  /* eslint-enable react-hooks/refs, react-hooks/purity */
  const [, expire] = useReducer((n: number) => n + 1, 0);
  const lastEnd = until.size === 0 ? 0 : Math.max(...until.values());
  useEffect(() => {
    if (lastEnd === 0) return;
    const id = setTimeout(expire, Math.max(0, lastEnd - Date.now()) + 20);
    return () => clearTimeout(id);
  }, [lastEnd]);
  return until.size === 0 ? EMPTY : new Set(until.keys());
}
