// URL state of a server-driven table: page, pageSize, sort and the page's own filters. Pure (no React, no zod), so
// the browser hook (lib/client/use-table-query.ts) and tests share it.
import { DEFAULT_PAGE_SIZE, MAX_PAGE, PAGE_SIZES, type PageSize } from "./paging";

/** Reads one filter from the URL: the raw value (null when absent) → the value to use, its own fallback on junk. */
export type FilterParser<V extends string> = (raw: string | null) => V;
export type TableSpec<F extends Record<string, string>> = {
  /** Sort keys the endpoint whitelists (`sortParam`). */
  sorts: readonly string[];
  /** "key" or "-key"; also what an absent or unknown `sort` falls back to. */
  defaultSort: string;
  filters: { [K in keyof F]: FilterParser<F[K]> };
  /** Filters written while the user types (debounced search): they replace the history entry instead of adding one. */
  search?: readonly (keyof F & string)[];
};
export type TableState<F extends Record<string, string>> = { page: number; pageSize: PageSize; sort: string } & F;
export type SortState = { key: string; dir: "asc" | "desc" };

/** Free text, trimmed and cut to `max` characters; absent → "". */
export const text = (max: number): FilterParser<string> => (raw) => (raw ?? "").trim().slice(0, max);
/** One of `values`, else `fallback`. */
export const oneOf = <V extends string>(values: readonly V[], fallback: V): FilterParser<V> => (raw) =>
  (values as readonly string[]).includes(raw ?? "") ? ((raw ?? "") as V) : fallback;

/** A real calendar date "YYYY-MM-DD", else "". */
export const isoDate: FilterParser<string> = (raw) => {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const t = Date.parse(`${raw}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === raw ? raw : "";
};

const int = (raw: string | null) => (raw != null && /^\d+$/.test(raw) ? Number(raw) : NaN);

export function readTable<F extends Record<string, string>>(sp: URLSearchParams, spec: TableSpec<F>): TableState<F> {
  const p = int(sp.get("page"));
  const size = int(sp.get("pageSize"));
  const sort = sp.get("sort") ?? "";
  const filters = Object.fromEntries(Object.entries(spec.filters).map(([k, parse]) => [k, (parse as FilterParser<string>)(sp.get(k))])) as F;
  return {
    page: p >= 1 ? Math.min(p, MAX_PAGE) : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? (size as PageSize) : DEFAULT_PAGE_SIZE,
    sort: spec.sorts.includes(sort.startsWith("-") ? sort.slice(1) : sort) ? sort : spec.defaultSort,
    ...filters,
  };
}

function serialize<F extends Record<string, string>>(t: TableState<F>, spec: TableSpec<F>): URLSearchParams {
  const out = new URLSearchParams();
  if (t.page !== 1) out.set("page", String(t.page));
  if (t.pageSize !== DEFAULT_PAGE_SIZE) out.set("pageSize", String(t.pageSize));
  if (t.sort !== spec.defaultSort) out.set("sort", t.sort);
  for (const [k, parse] of Object.entries(spec.filters)) {
    const v = t[k as keyof F] as string;
    if (v !== (parse as FilterParser<string>)(null)) out.set(k, v);
  }
  return out;
}

/**
 * The URL search params after `patch`, or null when the patch changes nothing (then: no navigation, no page reset).
 * Filter values go through their parser first (text trimmed, unknown choices fall back). A change to anything but
 * `page` (filters, sort, page size) goes back to page 1. Defaults (page 1, 15 rows, the default sort, each filter's
 * fallback) stay out of the URL.
 */
export function writeTable<F extends Record<string, string>>(state: TableState<F>, patch: Partial<TableState<F>>, spec: TableSpec<F>): URLSearchParams | null {
  const clean: Record<string, unknown> = { ...patch };
  for (const [k, parse] of Object.entries(spec.filters)) {
    if (k in clean) clean[k] = (parse as FilterParser<string>)(clean[k] as string);
  }
  const merged = { ...state, ...clean } as TableState<F>;
  const before = serialize(state, spec).toString();
  if (serialize(merged, spec).toString() === before) return null;
  const onlyPage = Object.keys(clean).every((k) => k === "page") || serialize({ ...merged, page: state.page }, spec).toString() === before;
  return serialize(onlyPage ? merged : { ...merged, page: 1 }, spec);
}

/** History entry for a URL change: search keystrokes (`spec.search` keys only) replace it; anything else pushes one, so Back undoes it. */
export function historyMode(patch: object, spec: { search?: readonly string[] }): "push" | "replace" {
  const keys = Object.keys(patch);
  return keys.length > 0 && keys.every((k) => spec.search?.includes(k)) ? "replace" : "push";
}

export const sortState = (sort: string): SortState => (sort.startsWith("-") ? { key: sort.slice(1), dir: "desc" } : { key: sort, dir: "asc" });
export const toSortParam = (s: SortState): string => (s.dir === "desc" ? `-${s.key}` : s.key);
