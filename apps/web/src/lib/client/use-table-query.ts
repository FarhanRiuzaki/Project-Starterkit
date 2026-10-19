"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import type { DataTablePaging } from "@starterkit/ui/ds";
import { api } from "@/lib/client/api";
import type { Page } from "@/lib/shared/contracts/common";
import { MAX_PAGE, PAGE_SIZES, type PageSize } from "@/lib/shared/paging";
import { readTable, type SortState, sortState, type TableSpec, type TableState, toSortParam, writeTable } from "@/lib/shared/table-state";

const clean = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== ""));

/**
 * A server-driven table: page, page size, sort and filters live in the URL (shareable; a change other than the page
 * goes back to page 1), the server pages, sorts and filters (`GET path?…` → `Page<T>`), and the result plugs into
 * `DataTable` (`rows`, `sort`, `onSortChange`, `paging`).
 *
 * - `spec` must be a module constant (it keys the memo). `params` turns the URL filters into API parameters (e.g. a
 *   range preset into from/to); by default the filters are sent as they are. Empty values are never sent.
 * - While the next page or sort loads, the previous rows stay on screen (`paging.busy`).
 * - `loadError` = nothing valid to show (first load, or the rows on screen belong to other filters) → DataTable `error`;
 *   `staleError` = a refetch failed while the shown rows still match → page `Notice`.
 * - A page past the end (rows were deleted, an old link) moves to the last page.
 * - `filterQuery` = the same filters without paging, for an export (`${path}?${filterQuery}&format=csv`).
 */
export function useTableQuery<T, F extends Record<string, string>>({ key, path, spec, params }: {
  key: string; path: `/api/${string}`; spec: TableSpec<F>; params?: (filters: F) => Record<string, string>;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state: TableState<F> = useMemo(() => readTable(sp, spec), [sp, spec]);

  const set = useCallback((patch: Partial<TableState<F>>) => {
    const next = writeTable(state, patch, spec);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [state, spec, router, pathname]);

  const filters = Object.fromEntries(Object.keys(spec.filters).map((k) => [k, state[k]])) as F;
  const filterQuery = new URLSearchParams(clean(params ? params(filters) : filters)).toString();
  const url = `${path}?${filterQuery}${filterQuery ? "&" : ""}${new URLSearchParams({ page: String(state.page), pageSize: String(state.pageSize), sort: state.sort })}`;
  const q = useQuery({ queryKey: [key, url], queryFn: () => api<Page<T>>(url), placeholderData: keepPreviousData });

  const data = q.data;
  useEffect(() => {
    if (data && !q.isPlaceholderData && data.items.length === 0 && data.total > 0 && state.page > 1) {
      set({ page: Math.min(Math.ceil(data.total / state.pageSize), MAX_PAGE) } as Partial<TableState<F>>);
    }
  }, [data, q.isPlaceholderData, state.page, state.pageSize, set]);

  const paging = {
    mode: "server", page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, totalCapped: data?.totalCapped,
    maxPage: MAX_PAGE, pageSizes: PAGE_SIZES, busy: q.isPlaceholderData && q.isFetching,
    onPageChange: (page: number) => set({ page } as Partial<TableState<F>>),
    onPageSizeChange: (size: number) => set({ pageSize: size as PageSize } as Partial<TableState<F>>),
  } satisfies DataTablePaging;

  return {
    state, set, query: q, filterQuery, paging,
    rows: data?.items ?? [],
    total: data?.total,
    totalCapped: !!data?.totalCapped,
    sort: sortState(state.sort),
    onSortChange: (s: SortState) => set({ sort: toSortParam(s) } as Partial<TableState<F>>),
    loading: q.isPending,
    loadError: q.error && (!data || q.isPlaceholderData) ? q.error : null,
    staleError: q.error && data && !q.isPlaceholderData ? q.error : null,
  };
}
