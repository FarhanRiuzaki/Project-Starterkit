"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Icon, type IconData } from "../ui/icon";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { useDelayedFlag, useNewKeys } from "../motion";
import { Select } from "../ui/select";
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
  /**
   * Place on a phone card (below 768 px, stacked rows): `title` = the card's heading (exactly one column), `meta` =
   * a label–value line (the header is the label), `hidden` = not on the card, `lead` = a control left of the title (the
   * row checkbox). Without one: the first column without a role is the title when none says so, the others `meta`.
   */
  mobile?: MobileRole;
};

export type MobileRole = "title" | "meta" | "hidden" | "lead";

/** Each column's phone role (see `Column.mobile`); a development build throws unless exactly one column is the title. */
export function mobileRoles<T>(columns: readonly Column<T>[]): MobileRole[] {
  const roles = columns.map((c) => c.mobile ?? "meta");
  if (!roles.includes("title")) {
    const i = columns.findIndex((c) => c.mobile === undefined);
    if (i >= 0) roles[i] = "title";
  }
  const titles = roles.filter((r) => r === "title").length;
  if (titles !== 1 && process.env.NODE_ENV !== "production") {
    throw new Error(`DataTable: exactly one column must be mobile "title" (found ${titles}: ${columns.map((c, i) => `${c.key}=${roles[i]}`).join(", ")}).`);
  }
  return roles;
}

/**
 * Phone card (below md): the row is a 3-column grid (lead control · title · row actions on the first line, then one
 * meta line each under the title; a value wider than the rest of its line wraps under its label); the table, its
 * body and cells drop their table layout and the header row hides.
 * From md nothing here applies, so tablet and desktop render the table as before.
 */
const CARD_ROW = "max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)_auto] max-md:items-center max-md:gap-y-1 max-md:border-b max-md:border-line max-md:px-3 max-md:py-2.5 max-md:last:border-b-0 max-md:data-[state=selected]:row-mark max-md:data-[state=selected]:[&>td:first-child]:shadow-none";
const CARD_CELL = "max-md:h-auto max-md:max-w-none max-md:min-w-0 max-md:border-b-0 max-md:p-0 max-md:text-left max-md:whitespace-normal";
const CARD_PLACE: Record<MobileRole | "actions", string> = {
  lead: "max-md:col-start-1 max-md:row-start-1 max-md:pr-2",
  title: "max-md:col-start-2 max-md:row-start-1",
  meta: "max-md:col-span-2 max-md:col-start-2 max-md:flex max-md:flex-wrap max-md:items-baseline max-md:gap-x-2 max-md:text-body-sm",
  hidden: "max-md:hidden",
  actions: "max-md:col-start-3 max-md:row-start-1 max-md:w-auto max-md:self-start max-md:pl-2",
};
/** A meta cell's label on the card: its column header, phone only. */
const MetaLabel = ({ children }: { children: ReactNode }) => <span className="w-24 shrink-0 text-label text-fg-3 md:hidden">{children}</span>;

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
 * hover, on keyboard focus anywhere in the row, and while one of their menus is open; on a touch screen (no hover)
 * always; they stay in the tab order.
 * Footer 48 px (server paging): `Pagination` ("Showing 1–15 of 312" left, first / previous / numbers / next / last right). The body fades in
 * once after loading (never staggered). The table scrolls sideways inside its card when it is wider than the screen
 * (ui/table.tsx).
 * Below 768 px (stacked rows): the same rows are cards (`Column.mobile`: title, meta label–value lines, the lead
 * checkbox, the row actions always shown), sorting is a "Sort by" select and the pagination is compact (previous /
 * "Page x of y" / next + rows per page). One DOM for every width, switched in CSS: no second render, no hydration
 * difference. The table semantics stay (explicit ARIA roles, which survive the phone's display change), so a screen
 * reader meets the same rows and cells on every width; on the card each meta value is preceded by its header.
 */
export function DataTable<T>({ columns, rows, rowKey, label, loading, error, empty, sort, onSortChange, rowActions, paging, isSelected, rowHeight = "default", highlightNew = false, highlightScope, skeletonRows }: Props<T>) {
  const fresh = useNewKeys(rows.map(rowKey), { enabled: highlightNew, scope: highlightScope });
  const roles = mobileRoles(columns);
  const sortId = useId();
  const topRef = useRef<HTMLDivElement>(null);
  // Fokus ke atas tabel hanya bila halaman benar-benar berganti ke target (kedaluwarsa 3 dtk bila diabaikan).
  const focusTarget = useRef<{ page: number; at: number } | null>(null);

  // No flash (LOADING tokens): the skeleton rows and the busy dim show only after 150 ms of loading, then stay at
  // least 300 ms. Until then the skeleton rows hold the table's height, hidden.
  const showSkeleton = useDelayedFlag(!!loading);
  const showBusy = useDelayedFlag(!!paging?.busy);
  const skeleton = !!loading || showSkeleton;
  // Fade the body in once when the first load finishes (not on refreshes, not when data was ready at mount).
  const [loadedLate, setLoadedLate] = useState(false);
  const [wasLoading, setWasLoading] = useState(skeleton);
  if (wasLoading && !skeleton) { setWasLoading(false); setLoadedLate(true); }

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

  const sortable = onSortChange ? columns.filter((c) => c.sortable) : [];
  // A sort the select doesn't list (none, or a key without a sortable column) shows the placeholder, not a wrong option.
  const sortValue = sort && sortable.some((c) => c.key === sort.key) ? `${sort.key}:${sort.dir}` : "";
  const sortBy = sortable.length > 0 && (
    <div className="flex items-center gap-2 border-b border-line px-3 py-2 md:hidden">
      <label htmlFor={sortId} className="text-body-sm text-fg-3">Sort by</label>
      <Select id={sortId} className="min-w-0 flex-1 text-body-sm" value={sortValue}
        onChange={(e) => { const [key, dir] = e.target.value.split(":"); onSortChange?.({ key: key!, dir: dir as SortDir }); }}>
        {!sortValue && <option value="" disabled>Choose a column</option>}
        {sortable.flatMap((c) => [
          <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.header}, ascending</option>,
          <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.header}, descending</option>,
        ])}
      </Select>
    </div>
  );

  const table = (
    <>
      {sortBy}
      <Table aria-label={label} aria-busy={showSkeleton || showBusy || undefined} data-status-static="" role="table" className="max-md:block">
        <TableHeader role="rowgroup" className="max-md:hidden">
          <TableRow role="row" className="hover:bg-transparent">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const sortIcon = !active ? ChevronsUpDownIcon : sort?.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
              return (
                <TableHead key={c.key} role="columnheader" className={cn(c.align === "right" && "text-right", c.className)}
                  aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortable && onSortChange ? (
                    <button type="button" onClick={() => toggle(c)} className={cn("inline-flex cursor-pointer items-center gap-1 rounded-xs hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary outline-none", active && "text-fg-2")}>
                      {c.icon && <Icon icon={c.icon} className="size-3.5" />}{c.header}<Icon icon={sortIcon} className="size-3" />
                    </button>
                  ) : c.icon ? <span className="inline-flex items-center gap-1"><Icon icon={c.icon} className="size-3.5" />{c.header}</span> : c.header}
                </TableHead>
              );
            })}
            {rowActions && <TableHead role="columnheader"><span className="sr-only">Actions</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody role="rowgroup" className={cn("max-md:block", loadedLate && "animate-reveal-in", server && "transition-opacity duration-(--dur-fast)", showBusy && "opacity-60")}>
          {skeleton
            ? <SkeletonRows count={skeletonRows ?? server?.pageSize ?? 8} columns={columns} roles={roles} actions={!!rowActions} identity={rowHeight === "identity"} hidden={!showSkeleton} />
            : data.map((r) => {
                const isNew = fresh.has(rowKey(r));
                return (
                <TableRow key={rowKey(r)} role="row" data-state={isSelected?.(r) ? "selected" : undefined}
                  data-new={isNew ? "true" : undefined}
                  className={cn(CARD_ROW, isNew && "motion-safe:animate-row-new")}>
                  {columns.map((c, i) => (
                    <TableCell key={c.key} role="cell" data-mobile={roles[i]}
                      className={cn("max-w-80", rowHeight === "identity" && "h-(--row-h-identity)", c.align === "right" && "text-right tabular", c.className, CARD_CELL, CARD_PLACE[roles[i]!])}>
                      {roles[i] === "meta" && <MetaLabel>{c.header}</MetaLabel>}{c.cell(r)}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell role="cell" data-mobile="actions" className={cn("w-px text-right", rowHeight === "identity" && "h-(--row-h-identity)", CARD_CELL, CARD_PLACE.actions)}>
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity duration-(--dur-fast) group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-data-[state=open]:opacity-100 pointer-coarse:opacity-100 max-md:opacity-100">{rowActions(r)}</div>
                    </TableCell>
                  )}
                </TableRow>
                );
              })}
        </TableBody>
      </Table>


      {!skeleton && data.length === 0 && <div className="p-4"><EmptyState icon={empty.icon} title={empty.title} description={empty.description} /></div>}
    </>
  );

  if (!server) return table;
  // The footer keeps its 48 px while loading, so the table doesn't jump when the pagination arrives.
  const footer = skeleton ? <div aria-hidden="true" data-slot="pagination-placeholder" className="min-h-12 border-t border-line" /> : server.total > 0 && (
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

/** The loading shape: the rows' shape on every width (a card on a phone: the same cell roles, a bar per line). */
function SkeletonRows<T>({ count, columns, roles, actions, identity, hidden }: { count: number; columns: Column<T>[]; roles: MobileRole[]; actions: boolean; identity: boolean; hidden: boolean }) {
  const h = identity ? "h-(--row-h-identity)" : undefined;
  return Array.from({ length: count }, (_, i) => (
    <TableRow key={`sk-${i}`} role="row" className={cn(CARD_ROW, "hover:bg-transparent", hidden && "invisible")} aria-hidden="true">
      {columns.map((c, j) => (
        <TableCell key={c.key} role="cell" data-mobile={roles[j]} className={cn(h, CARD_CELL, CARD_PLACE[roles[j]!], "max-md:h-5 max-md:items-center")}>
          <Skeleton className={cn("h-2.5 w-3/4", roles[j] === "lead" && "max-md:size-4")} />
        </TableCell>
      ))}
      {actions && <TableCell role="cell" data-mobile="actions" className={cn(h, CARD_CELL, CARD_PLACE.actions)} />}
    </TableRow>
  ));
}
