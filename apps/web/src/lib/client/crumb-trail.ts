"use client";

import { useEffect, useSyncExternalStore } from "react";

/** A breadcrumb after the nav page: a link (`href`) to a parent, or the page itself (last, no href). */
export type TrailCrumb = { label: string; href?: string };
type Trail = { path: string; items: TrailCrumb[] };

let trail: Trail | null = null;
const subs = new Set<() => void>();
const publish = (t: Trail | null) => { trail = t; for (const f of subs) f(); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/**
 * The open page's crumbs after its nav page (PageHeader publishes its title, after any parents in `trail`), so the
 * top bar reads "Users / Rina Wulandari" on a record. Published after hydration (the top bar renders before the page).
 */
export function usePublishTrail(path: string, items: TrailCrumb[]) {
  const key = JSON.stringify(items);
  useEffect(() => {
    const t: Trail = { path, items: JSON.parse(key) as TrailCrumb[] };
    publish(t);
    return () => { if (trail === t) publish(null); };
  }, [path, key]);
}

/** The crumbs published for `path` (none for another page, on the server and while hydrating). */
export function useTrail(path: string): TrailCrumb[] {
  const t = useSyncExternalStore(subscribe, () => trail, () => null);
  return t && t.path === path ? t.items : [];
}
