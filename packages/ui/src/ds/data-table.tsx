"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Icon, type IconData } from "../ui/icon";
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { useNewKeys } from "../motion";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatNumber } from "../lib/format";
import { clampPage, PAGE_SIZE, pageCount, pageSlice, pageWindow, rangeLabel } from "../lib/paging";
import { type SortDir, sortRows } from "../lib/sort";
import { EmptyState, ErrorState } from "./states";

export type Column<T> = {
  key: string; header: string; cell: (r: T) => ReactNode;
  /** Optional 14 px icon before the header label (spec §5.7). */
  icon?: IconData;
  sortValue?: (r: T) => string | number | null | undefined;
  align?: "left" | "right"; className?: string;
};

/**
 * Pemuatan bertahap.
 * - `paged`: data di memori, 25 baris/halaman; halaman dikendalikan pemanggil (mis. dari URL). Pemanggil yang
 *   mengembalikan `page` ke 1 saat filter/urutan berubah; nilai di luar rentang hanya di-clamp untuk tampilan.
 * - `infinite`: data server berhalaman; `rows` = semua baris yang sudah dimuat. `error` = pemuatan halaman
 *   berikutnya gagal: baris tetap tampil, observer berhenti, tombol "Load more" menjadi coba lagi manual.
 * Tanpa `paging`: > 25 baris otomatis berhalaman (state lokal, kembali ke halaman 1 saat himpunan baris atau
 * urutan berubah), ≤ 25 baris tampil semua.
 */
export type DataTablePaging =
  | { mode: "paged"; page: number; pageSize?: number; onPageChange: (page: number) => void }
  | { mode: "infinite"; hasMore: boolean; loadingMore: boolean; onLoadMore: () => void; total?: number; error?: boolean };

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
};

/**
 * DataTable (spec §5.7). Put it in a `Panel flush`: the table is the card. Header 40 px on the tray tint (label
 * fg-3, optional icon, sort caret); rows --row-h 44 (compact 36), or --row-h-identity 52 (compact 44) with
 * `rowHeight="identity"`;
 * 1 px dividers, no zebra, no vertical rules; hover tray @ 60 %; `isSelected` tint; row actions (secondary) show on row
 * hover, on keyboard focus anywhere in the row, and while one of their menus is open; they stay in the tab order.
 * Footer 48 px: range left, pagination right (28 px square buttons, current = tray fill + line). The body fades in
 * once after loading (never staggered). Desktop only: no stacked list.
 */
export function DataTable<T>({ columns, rows, rowKey, label, loading, error, empty, sort, onSortChange, rowActions, paging, isSelected, rowHeight = "default", highlightNew = false, highlightScope }: Props<T>) {
  const fresh = useNewKeys(rows.map(rowKey), { enabled: highlightNew, scope: highlightScope, infinite: paging?.mode === "infinite" });
  const topRef = useRef<HTMLDivElement>(null);
  // Fokus ke atas tabel hanya bila halaman benar-benar berganti ke target (kedaluwarsa 3 dtk bila diabaikan).
  const focusTarget = useRef<{ page: number; at: number } | null>(null);

  // Halaman lokal (mode otomatis): kembali ke halaman 1 saat urutan atau himpunan baris (kunci + jumlah) berubah.
  // Berdasarkan kunci, bukan identitas array, agar pemanggil yang memfilter inline tidak terus di-reset.
  const auto = !paging;
  const sig = auto ? `${sort ? `${sort.key}:${sort.dir}` : ""}|${rows.length}|${rows.map(rowKey).join("\u0000")}` : "";
  const [local, setLocal] = useState({ sig, page: 1 });
  if (local.sig !== sig) setLocal({ sig, page: 1 });
  // Fade the body in once when the first load finishes (not on refreshes, not when data was ready at mount).
  const [loadedLate, setLoadedLate] = useState(false);
  const [wasLoading, setWasLoading] = useState(!!loading);
  if (wasLoading && !loading) { setWasLoading(false); setLoadedLate(true); }

  const infinite = paging?.mode === "infinite" ? paging : null;
  const paged = paging?.mode === "paged" || (!paging && rows.length > PAGE_SIZE);
  const size = paging?.mode === "paged" ? (paging.pageSize ?? PAGE_SIZE) : PAGE_SIZE;
  const page = clampPage(paging?.mode === "paged" ? paging.page : local.page, rows.length, size);

  useEffect(() => {
    const t = focusTarget.current;
    if (!t) return;
    focusTarget.current = null;
    if (t.page === page && Date.now() - t.at < 3000) topRef.current?.focus();
  }, [page]);

  if (error) return <div className="p-4"><ErrorState title={error.title} cause={error.cause} onRetry={error.onRetry} /></div>;
  const col = sort ? columns.find((c) => c.key === sort.key) : undefined;
  const sorted = col?.sortValue && sort ? sortRows(rows, col.sortValue, sort.dir) : rows;
  const data = paged ? pageSlice(sorted, page, size) : sorted;
  const moreSkeleton = !loading && !!infinite?.loadingMore;

  function toggle(c: Column<T>) {
    if (!c.sortValue || !onSortChange) return;
    onSortChange({ key: c.key, dir: sort?.key === c.key && sort.dir === "asc" ? "desc" : "asc" });
  }

  function goTo(p: number) {
    const next = clampPage(p, rows.length, size);
    if (next === page) { focusTarget.current = null; return; }
    focusTarget.current = { page: next, at: Date.now() };
    if (paging?.mode === "paged") paging.onPageChange(next);
    else setLocal({ sig, page: next });
  }

  const table = (
    <>
      <Table aria-label={label} aria-busy={loading || moreSkeleton || undefined} data-status-static="">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const sortIcon = !active ? ChevronsUpDownIcon : sort?.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
              return (
                <TableHead key={c.key} className={cn(c.align === "right" && "text-right", c.className)}
                  aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortValue && onSortChange ? (
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
        <TableBody className={cn(loadedLate && "animate-reveal-in")}>
          {loading
            ? <SkeletonRows count={8} columns={columns} actions={!!rowActions} identity={rowHeight === "identity"} />
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
          {moreSkeleton && <SkeletonRows count={3} columns={columns} actions={!!rowActions} identity={rowHeight === "identity"} />}
        </TableBody>
      </Table>


      {!loading && data.length === 0 && !infinite?.loadingMore && <div className="p-4"><EmptyState icon={empty.icon} title={empty.title} description={empty.description} /></div>}
    </>
  );

  if (paged || auto) {
    const last = pageCount(rows.length, size);
    // Wrapper selalu ada di mode otomatis agar DOM tidak remount saat jumlah baris melewati 25.
    return (
      <div ref={topRef} tabIndex={paged ? -1 : undefined} role={paged ? "region" : undefined}
        aria-label={paged ? `${label}, page ${page} of ${last}` : undefined} className="scroll-mt-16 outline-none">
        {table}
        {paged && !loading && rows.length > 0 && (
          <nav aria-label={`${label} pages`} className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
            <p className="text-body-sm text-fg-3 tabular" aria-live="polite">{rangeLabel(page, size, rows.length)}</p>
            <div className="flex items-center gap-1">
              <PageButton onClick={() => goTo(page - 1)} disabled={page <= 1} label="Previous page"><Icon icon={ChevronLeftIcon} className="size-4" /></PageButton>
              {pageWindow(page, last).map((p, i) => p === "gap"
                ? <span key={`gap-${i}`} aria-hidden="true" className="inline-grid size-7 place-items-center text-body-sm text-fg-3">…</span>
                : <PageButton key={p} onClick={() => goTo(p)} current={p === page} label={`Page ${p}`}>{formatNumber(p)}</PageButton>)}
              <PageButton onClick={() => goTo(page + 1)} disabled={page >= last} label="Next page"><Icon icon={ChevronRightIcon} className="size-4" /></PageButton>
            </div>
          </nav>
        )}
      </div>
    );
  }

  if (infinite) {
    return (
      <div>
        {table}
        {!loading && <InfiniteFooter count={rows.length} paging={infinite} />}
      </div>
    );
  }

  return table;
}

/** Pagination button (spec §5.7): 28 px square, radius 8; current = --tray fill + line, aria-current. */
function PageButton({ children, onClick, disabled, current, label }: { children: ReactNode; onClick: () => void; disabled?: boolean; current?: boolean; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} aria-current={current ? "page" : undefined}
      className={cn("inline-grid h-7 min-w-7 cursor-pointer place-items-center rounded-md border px-1.5 text-body-sm tabular transition-colors duration-(--dur-fast) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40",
        current ? "border-line bg-tray text-fg" : "border-transparent text-fg-2 hover:bg-tray hover:text-fg")}>
      {children}
    </button>
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

type InfinitePaging = Extract<DataTablePaging, { mode: "infinite" }>;

/** Sentinel IntersectionObserver (rootMargin 200px) + tombol "Load more" sebagai fallback keyboard/pembaca layar. */
function InfiniteFooter({ count, paging }: { count: number; paging: InfinitePaging }) {
  const { hasMore, loadingMore, onLoadMore, total, error } = paging;
  const sentinel = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoadMore);
  useEffect(() => { loadRef.current = onLoadMore; }, [onLoadMore]);

  // Observer dibuat ulang setiap kali pemuatan selesai: satu panggilan per kemunculan sentinel.
  // Saat galat, observer tidak dibuat (mencegah loop coba ulang); pengguna memakai tombol "Load more".
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loadingMore || error || typeof IntersectionObserver === "undefined") return;
    let fired = false;
    const io = new IntersectionObserver((entries) => {
      if (fired || !entries.some((e) => e.isIntersecting)) return;
      fired = true;
      loadRef.current();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, error]);

  const status = total != null && Number.isFinite(total)
    ? `${formatNumber(count)} of ${formatNumber(total)} rows loaded`
    : `${formatNumber(count)} ${count === 1 ? "row" : "rows"} loaded`;

  return (
    <>
    <div ref={sentinel} aria-hidden="true" className="h-px" />
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
      <p className="text-body-sm text-fg-3 tabular" role="status" aria-live="polite">{status}</p>
      <div className="flex flex-wrap items-center gap-2">
      <p className="text-body-sm text-down-ink" aria-live="polite">{error && !loadingMore ? "Couldn't load more rows. Select Load more to try again." : ""}</p>
      {hasMore && (
        <Button size="sm" variant="secondary" className="aria-disabled:cursor-default aria-disabled:opacity-45" aria-disabled={loadingMore || undefined}
          onClick={() => { if (!loadingMore) onLoadMore(); }}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
      </div>
    </div>
    </>
  );
}
