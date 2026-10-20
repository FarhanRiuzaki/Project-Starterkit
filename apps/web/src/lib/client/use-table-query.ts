"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import type { DataTablePaging } from "@starterkit/ui/ds";
import { api } from "@/lib/client/api";
import { usePrefs } from "@/lib/client/prefs-context";
import type { Page } from "@starterkit/shared/contracts/common";
import { MAX_PAGE, PAGE_SIZES, type PageSize } from "@starterkit/shared/paging";
import { savedView, VIEW_PAGES, type ViewPage } from "@/lib/shared/prefs";
import { historyMode, readTable, type SortState, sortState, tableRequest, tableView, type TableSpec, type TableState, toSortParam, writeTable } from "@/lib/shared/table-state";

/**
 * A server-driven table: page, page size, sort and filters live in the URL (shareable; a change other than the page
 * goes back to page 1; a patch that changes nothing does nothing), the server pages, sorts and filters
 * (`GET path?…` → `Page<T>`), and the result plugs into `DataTable` (`rows`, `sort`, `onSortChange`, `paging`).
 * Committed changes push a history entry (Back undoes them); search keystrokes (`spec.search`) replace it.
 *
 * - `spec` must be a module constant (it keys the memo). `params` turns the URL filters into API parameters (e.g. a
 *   range preset into from/to); by default the filters are sent as they are. Empty values are never sent.
 * - `enabled = false` (second argument) stops fetching, e.g. while the owner of the rows is gone.
 * - While the next page or sort loads, the previous rows stay on screen (`paging.busy`).
 * - `loadError` = nothing valid to show (first load, or the rows on screen belong to other filters) → DataTable `error`;
 *   `staleError` = a refetch failed while the shown rows still match → page `Notice`.
 * - A page past the end (rows were deleted, an old link) moves to the last page, showing the loading shape meanwhile
 *   (never a "no match" flash).
 * - `filterQuery` = the same filters without paging, for an export (`${path}?${filterQuery}&format=csv`).
 * - `count` = the Panel count ("12,345", "100,000+"); rows, loading and errors come from `tableView` (table-state.ts).
 * - On a list page (`VIEW_PAGES`) the view (filters, sort, rows per page; not the page or the search) is remembered in
 *   the prefs cookie, and the navigation links reopen it (`viewHref`).
 */
export function useTableQuery<T, F extends Record<string, string>>({ key, path, spec, params }: {
  key: string; path: `/api/${string}`; spec: TableSpec<F>; params?: (filters: F) => Record<string, string>;
}, enabled = true) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const state: TableState<F> = useMemo(() => readTable(sp, spec), [sp, spec]);
  const { prefs, update } = usePrefs();
  const view = (VIEW_PAGES as readonly string[]).includes(pathname) ? savedView(new URLSearchParams(sp.toString()), spec.search) : null;
  useEffect(() => {
    if (view === null || view === (prefs.views[pathname as ViewPage] ?? "")) return;
    update({ views: { ...prefs.views, [pathname]: view } });
  }, [view, pathname, prefs.views, update]);

  const set = useCallback((patch: Partial<TableState<F>>) => {
    const next = writeTable(state, patch, spec);
    if (!next) return;
    const href = next.size ? `${pathname}?${next}` : pathname;
    // Native history (Next keeps useSearchParams in sync): the URL changes in place, without a server round trip for
    // the page, so the next page loads from /api with the previous rows kept and the busy dim. The server prefetch
    // covers document loads and route changes only.
    if (historyMode(patch, spec) === "replace") window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, [state, spec, pathname]);

  const { filterQuery, url } = tableRequest(path, state, spec, params);
  const q = useQuery({ queryKey: [key, url], queryFn: () => api<Page<T>>(url), enabled, placeholderData: keepPreviousData });

  const tv = tableView(q, state.page);
  const lastPage = tv.pastEnd && tv.total ? Math.min(Math.ceil(tv.total / state.pageSize), MAX_PAGE) : 0;
  useEffect(() => {
    // replace, not push: Back should not return to the empty page.
    if (!lastPage) return;
    const next = writeTable(state, { page: lastPage } as Partial<TableState<F>>, spec);
    if (next) window.history.replaceState(null, "", next.size ? `${pathname}?${next}` : pathname);
  }, [lastPage, state, spec, pathname]);

  const paging = {
    mode: "server", page: state.page, pageSize: state.pageSize, total: tv.total ?? 0, totalCapped: tv.totalCapped,
    maxPage: MAX_PAGE, pageSizes: PAGE_SIZES, busy: tv.busy,
    onPageChange: (page: number) => set({ page } as Partial<TableState<F>>),
    onPageSizeChange: (size: number) => set({ pageSize: size as PageSize } as Partial<TableState<F>>),
  } satisfies DataTablePaging;

  return {
    state, set, query: q, filterQuery, paging,
    rows: tv.rows, total: tv.total, totalCapped: tv.totalCapped, count: tv.count,
    sort: sortState(state.sort),
    onSortChange: (s: SortState) => set({ sort: toSortParam(s) } as Partial<TableState<F>>),
    loading: tv.loading, loadError: tv.loadError, staleError: tv.staleError,
  };
}
