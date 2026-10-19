"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Icon, type IconData } from "../ui/icon";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { useNewKeys } from "../motion";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { pageCount } from "../lib/paging";
import { Pagination } from "./pagination";
import { EmptyState, ErrorState } from "./states";

export type Column<T> = {
  key: string; header: string; cell: (r: T) => ReactNode;
  /** Optional 14 px icon before the header label (spec §5.7). */
  icon?: IconData;
  /** Server-sorted column: the header button toggles `sort` (with `aria-sort`); the rows are never re-sorted here. */
  sortable?: boolean;
  align?: "left" | "right"; className?: string;
};

export type SortDir = "asc" | "desc";

/**
 * Paging is always the server's (the table standard: no table pages or sorts by itself). `rows` = the current page
 * as returned, never re-sorted here. Footer = `Pagination` with the page-size select. `busy` = the next page or sort
 * is loading while the previous rows stay on screen. `maxPage` = deepest page the endpoint serves. Without `paging`
 * the table shows `rows` as given: only for short fixed lists from a record (e.g. its last 20 actions).
 */
export type DataTablePaging = {
  mode: "server"; page: number; pageSize: number; total: number; totalCapped?: boolean; maxPage?: number; busy?: boolean;
  pageSizes: readonly number[]; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void;
};

type Props<T> = {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; label: string;
  loading?: boolean; error?: { title: string; cause: string; onRetry?: () => void } | null;
  empty: { title: string; description: string; icon: IconData };
  sort?: { key: string; dir: SortDir }; onSortChange?: (s: { key: string; dir: SortDir }) => void;
  rowActions?: (r: T) => ReactNode;
  paging?: DataTablePaging;
  /** Selected rows: --row-selected tint + 2 px primary mark on the left edge (spec §5.7). */
  isSelected?: (r: T) => boolean;
  /**
   * Row height (spec §5.7): `default` 44 (compact 36) for single-line rows; `identity` 52 (compact 44) for rows
   * whose first cell is an identity (28 px avatar + name + secondary line, e.g. developer + NIP). Use `identity`
   * on every table that shows people or items, so all rows share one height whatever their content.
   */
  rowHeight?: "default" | "identity";
  /** Rows whose key first appears after the initial load flash once (R4). Never on load, sort, paging or a same-data refetch. */
  highlightNew?: boolean;
  /** Filter / query signature of the list: when it changes, the rows shown are a different list and nothing flashes. */
  highlightScope?: string;
  /** Skeleton rows while loading (default 8; `server` paging uses its page size): match the loaded row count, no layout shift. */
  skeletonRows?: number;
};

/**
 * DataTable (spec §5.7). Put it in a `Panel flush`: the table is the card. Header 40 px on the tray tint (label
 * fg-3, optional icon, sort caret); rows --row-h 44 (compact 36), or --row-h-identity 52 (compact 44) with
 * `rowHeight="identity"`;
 * 1 px dividers, no zebra, no vertical rules; hover tray @ 60 %; `isSelected` tint; row actions (secondary) show on row
 * hover, on keyboard focus anywhere in the row, and while one of their menus is open; they stay in the tab order.
 * Footer 48 px (server paging): `Pagination` ("Showing 1–15 of 312" left, first / previous / numbers / next / last right). The body fades in
 * once after loading (never staggered). Desktop only: no stacked list.
 */
export function DataTable<T>({ columns, rows, rowKey, label, loading, error, empty, sort, onSortChange, rowActions, paging, isSelected, rowHeight = "default", highlightNew = false, highlightScope, skeletonRows }: Props<T>) {
  const fresh = useNewKeys(rows.map(rowKey), { enabled: highlightNew, scope: highlightScope });
  const topRef = useRef<HTMLDivElement>(null);
  // Fokus ke atas tabel hanya bila halaman benar-benar berganti ke target (kedaluwarsa 3 dtk bila diabaikan).
  const focusTarget = useRef<{ page: number; at: number } | null>(null);

  // Fade the body in once when the first load finishes (not on refreshes, not when data was ready at mount).
  const [loadedLate, setLoadedLate] = useState(false);
  const [wasLoading, setWasLoading] = useState(!!loading);
  if (wasLoading && !loading) { setWasLoading(false); setLoadedLate(true); }

  const server = paging ?? null;
  const last = server ? Math.min(pageCount(server.total, server.pageSize), server.maxPage ?? Infinity) : 1;
  const page = server ? Math.min(Math.max(1, server.page), last) : 1;

  useEffect(() => {
    const t = focusTarget.current;
    if (!t) return;
    focusTarget.current = null;
    if (t.page === page && Date.now() - t.at < 3000) topRef.current?.focus();
  }, [page]);

  if (error) return <div className="p-4"><ErrorState title={error.title} cause={error.cause} onRetry={error.onRetry} /></div>;
  const data = rows;

  function toggle(c: Column<T>) {
    if (!c.sortable || !onSortChange) return;
    onSortChange({ key: c.key, dir: sort?.key === c.key && sort.dir === "asc" ? "desc" : "asc" });
  }

  function goTo(p: number) {
    if (!server) return;
    const next = Math.min(Math.max(1, p), last);
    if (next === page) { focusTarget.current = null; return; }
    focusTarget.current = { page: next, at: Date.now() };
    server.onPageChange(next);
  }

  const table = (
    <>
      <Table aria-label={label} aria-busy={loading || server?.busy || undefined} data-status-static="">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const sortIcon = !active ? ChevronsUpDownIcon : sort?.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
              return (
                <TableHead key={c.key} className={cn(c.align === "right" && "text-right", c.className)}
                  aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortable && onSortChange ? (
                    <button type="button" onClick={() => toggle(c)} className={cn("inline-flex cursor-pointer items-center gap-1 rounded-xs hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary outline-none", active && "text-fg-2")}>
                      {c.icon && <Icon icon={c.icon} className="size-3.5" />}{c.header}<Icon icon={sortIcon} className="size-3" />
                    </button>
                  ) : c.icon ? <span className="inline-flex items-center gap-1"><Icon icon={c.icon} className="size-3.5" />{c.header}</span> : c.header}
                </TableHead>
              );
            })}
            {rowActions && <TableHead><span className="sr-only">Actions</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody className={cn(loadedLate && "animate-reveal-in", server && "transition-opacity duration-(--dur-fast)", server?.busy && "opacity-60")}>
          {loading
            ? <SkeletonRows count={skeletonRows ?? server?.pageSize ?? 8} columns={columns} actions={!!rowActions} identity={rowHeight === "identity"} />
            : data.map((r) => {
                const isNew = fresh.has(rowKey(r));
                return (
                <TableRow key={rowKey(r)} data-state={isSelected?.(r) ? "selected" : undefined}
                  data-new={isNew ? "true" : undefined}
                  className={isNew ? "motion-safe:animate-row-new" : undefined}>
                  {columns.map((c) => <TableCell key={c.key} className={cn("max-w-80", rowHeight === "identity" && "h-(--row-h-identity)", c.align === "right" && "text-right tabular", c.className)}>{c.cell(r)}</TableCell>)}
                  {rowActions && (
                    <TableCell className={cn("w-px text-right", rowHeight === "identity" && "h-(--row-h-identity)")}>
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity duration-(--dur-fast) group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-data-[state=open]:opacity-100">{rowActions(r)}</div>
                    </TableCell>
                  )}
                </TableRow>
                );
              })}
        </TableBody>
      </Table>


      {!loading && data.length === 0 && <div className="p-4"><EmptyState icon={empty.icon} title={empty.title} description={empty.description} /></div>}
    </>
  );

  if (!server) return table;
  // The footer keeps its 48 px while loading, so the table doesn't jump when the pagination arrives.
  const footer = loading ? <div aria-hidden="true" data-slot="pagination-placeholder" className="min-h-12 border-t border-line" /> : server.total > 0 && (
    <Pagination label={label} page={page} pageSize={server.pageSize} total={server.total} totalCapped={server.totalCapped} maxPage={server.maxPage}
      pageSizes={server.pageSizes} onPageChange={goTo} onPageSizeChange={server.onPageSizeChange} />
  );
  return (
    <div ref={topRef} tabIndex={-1} role="region" aria-label={`${label}, page ${page} of ${last}`} className="scroll-mt-16 outline-none">
      {table}
      {footer}
    </div>
  );
}

function SkeletonRows<T>({ count, columns, actions, identity }: { count: number; columns: Column<T>[]; actions: boolean; identity: boolean }) {
  const h = identity ? "h-(--row-h-identity)" : undefined;
  return Array.from({ length: count }, (_, i) => (
    <TableRow key={`sk-${i}`} className="hover:bg-transparent" aria-hidden="true">
      {columns.map((c) => <TableCell key={c.key} className={h}><Skeleton className="h-2.5 w-3/4" /></TableCell>)}
      {actions && <TableCell className={h} />}
    </TableRow>
  ));
}
