import type { ReactNode } from "react";
import { Icon } from "../ui/icon";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { clampPage, pageCount, pageWindow, showingLabel } from "../lib/paging";
import { Select } from "../ui/select";

/**
 * Table footer (spec §5.7), 48 px: "Showing 16–30 of 12,345" left; page size select, then first / previous / page
 * numbers / next / last (28 px square buttons, current = tray fill + line) right. `maxPage` caps the last page
 * offered (the server refuses deeper pages); `totalCapped` = the server stopped counting ("of 100,000+").
 * The page-size select shows only with `onPageSizeChange`.
 */
export function Pagination({ label, page, pageSize, total, totalCapped, maxPage, pageSizes, onPageChange, onPageSizeChange }: {
  label: string; page: number; pageSize: number; total: number; totalCapped?: boolean; maxPage?: number;
  pageSizes?: readonly number[]; onPageChange: (page: number) => void; onPageSizeChange?: (size: number) => void;
}) {
  const last = Math.min(pageCount(total, pageSize), maxPage ?? Infinity);
  const current = Math.min(clampPage(page, total, pageSize), last);
  const go = (p: number) => { if (p !== current && p >= 1 && p <= last) onPageChange(p); };
  return (
    <nav aria-label={`${label} pages`} className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
      <p className="text-body-sm text-fg-3 tabular" aria-live="polite">{showingLabel(current, pageSize, total, totalCapped)}</p>
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange && pageSizes && (
          <label className="flex items-center gap-2 text-body-sm text-fg-3">
            Rows
            <Select aria-label="Rows per page" className="h-7 px-1.5 text-body-sm" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
              {pageSizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <PageButton onClick={() => go(1)} disabled={current <= 1} label="First page"><Icon icon={ChevronsLeftIcon} className="size-4" /></PageButton>
          <PageButton onClick={() => go(current - 1)} disabled={current <= 1} label="Previous page"><Icon icon={ChevronLeftIcon} className="size-4" /></PageButton>
          {pageWindow(current, last).map((p, i) => p === "gap"
            ? <span key={`gap-${i}`} aria-hidden="true" className="inline-grid size-7 place-items-center text-body-sm text-fg-3">…</span>
            : <PageButton key={p} onClick={() => go(p)} current={p === current} label={`Page ${p}`}>{formatNumber(p)}</PageButton>)}
          <PageButton onClick={() => go(current + 1)} disabled={current >= last} label="Next page"><Icon icon={ChevronRightIcon} className="size-4" /></PageButton>
          <PageButton onClick={() => go(last)} disabled={current >= last} label="Last page"><Icon icon={ChevronsRightIcon} className="size-4" /></PageButton>
        </div>
      </div>
    </nav>
  );
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
