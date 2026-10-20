import "server-only";
import type { Page } from "@starterkit/shared/contracts/common";

/** Sort keys an endpoint offers → the value each row sorts by. null / "" = no value (sorts last both ways). */
export type Sorters<T> = Record<string, (row: T) => string | number | null>;

/** One collator for every string sort (much faster than localeCompare per pair). */
const collator = new Intl.Collator("en", { numeric: true });
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * `items` ordered by `sort` ("key" ascending, "-key" descending; key from `sorters`). Empty values go last in both
 * directions; equal values fall back to `id` ascending, so a page boundary never moves between requests. The input
 * array is left as it was. The route's zod schema has already limited `sort` to these keys (`sortParam`), so an
 * unknown key is a programming error and throws. Sort timestamps as numbers (`Date.parse`), not strings.
 */
export function sortRows<T extends { id: string }>(items: readonly T[], sort: string, sorters: Sorters<T>): T[] {
  const desc = sort.startsWith("-");
  const key = sorters[desc ? sort.slice(1) : sort];
  if (!key) throw new Error(`sortRows: no sorter for "${sort}"`);
  const dir = desc ? -1 : 1;
  const vals = new Map(items.map((r) => [r, key(r)]));
  return [...items].sort((a, b) => {
    const x = vals.get(a) ?? null, y = vals.get(b) ?? null;
    const ex = x === null || x === "", ey = y === null || y === "";
    if (ex || ey) return ex === ey ? byId(a, b) : ex ? 1 : -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
    return c === 0 ? byId(a, b) : dir * c;
  });
}

/**
 * One page of an in-memory list, sorted server-side: the mock store's version of `ORDER BY … LIMIT … OFFSET …`.
 * `fallbackSort` applies when the query has no `sort`. A page past the end is empty, with the real `total`.
 */
// ponytail: sorts the whole filtered set per request (fine for the mock's ≤ 10,000 rows); a real backend pages in the database.
export function paginate<T extends { id: string }>(items: readonly T[], q: { page: number; pageSize: number; sort?: string }, sorters: Sorters<T>, fallbackSort: string): Page<T> {
  const rows = sortRows(items, q.sort ?? fallbackSort, sorters);
  return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length, page: q.page, pageSize: q.pageSize };
}
