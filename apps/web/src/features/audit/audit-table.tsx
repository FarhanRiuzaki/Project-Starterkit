"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useRef, useState } from "react";
import { BlockedButton, type Column, ColumnsMenu, DataTable, FilterLayout, FilterSurface, FilterSearch, type FilterField, type LegendItem, Notice, Panel, RelativeTime, Toolbar } from "@starterkit/ui/ds";
import { APP_TIME_ZONE_LABEL, appDayStart, formatDateTimeLong, formatDate, formatNumber } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { Icon, type IconData } from "@starterkit/ui/ui/icon";
import { ExportIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/toast";
import { SavedViewsMenu } from "@/components/saved-views-menu";
import { PageHeader } from "@/components/shell/page-header";
import { errorText } from "@/lib/client/api";
import { useTableQuery } from "@/lib/client/use-table-query";
import { CSV_MAX_ROWS, RANGE_LABEL } from "@starterkit/shared/audit";
import { timeRange } from "@/lib/shared/time-controls";
import { type AuditFilters, customRange, type TableDef } from "@/lib/shared/queries";
import type { FilterParser, TableState } from "@/lib/shared/table-state";

const EntryDialog = dynamic(() => import("./entry-dialog").then((m) => m.EntryDialog), { ssr: false });

/** Filters that set the time range, not the match: "Clear filters" leaves them. */
const RANGE_KEYS = new Set(["range", "from", "to", "start", "end"]);

/** Time column cell: relative, with the absolute time under it. */
export const timeCell = (at: string) => (
  <span className="grid"><RelativeTime at={Date.parse(at)} touchDate={false} /><span className="font-mono text-caption text-fg-3">{formatDateTimeLong(Date.parse(at))}</span></span>
);

const day = (d: string) => formatDate(appDayStart(d));
const rangeText = (r: { from: string; to: string }) => (r.from === r.to ? day(r.from) : `${day(r.from)} – ${day(r.to)}`);

export type AuditDetail = { title: string; summary?: string; changes?: { action: string; before: unknown; after: unknown }; rows: [string, ReactNode][]; extra?: ReactNode };

/**
 * The page both audit logs share: header with the range picker, user search + the log's own filters, a server-driven
 * table (paging, sort, filters in the URL), CSV export of the same filters, and a read-only detail dialog per row.
 * `table` is a lib/shared/queries constant (ACTIVITY, AUTH_LOG): its filters include the shared audit filters.
 */
export function AuditTable<T extends { id: string; at: string }, F extends AuditFilters>({
  title, description, noun, icon, table, columns, rowLabel, filters, filterFields, legend, emptyHint, detail, onEntry, entryNotice, pendingEntry, exactFilters,
}: {
  title: string; description: string;
  /** Plural, lower case: "activity entries". */
  noun: string;
  icon: IconData;
  table: TableDef<F>;
  columns: Column<T>[];
  /** Names the row for its "View entry" button. */
  rowLabel: (r: T) => string;
  /** The log's own filter controls. */
  filters: (f: F, set: (patch: Partial<F>) => void) => ReactNode;
  filterFields: readonly FilterField<keyof F & string>[];
  /** Statuses the table shows: the info button in its card header. */
  legend?: readonly LegendItem[];
  /** Empty state with no filters: when entries appear. */
  emptyHint: string;
  detail?: (r: T) => AuditDetail;
  onEntry?: (row: T, trigger: HTMLButtonElement) => void;
  entryNotice?: ReactNode;
  pendingEntry?: string;
  exactFilters?: { values: Record<string, string>; fields: readonly FilterField[]; valid: boolean; clearPatch: (next: Record<string, string>, previous: Record<string, string>) => Partial<F> };
}) {
  const { path, spec } = table;
  const t = useTableQuery<T, F>(table);
  const f = t.state;
  const [open, setOpen] = useState<T | null>(null);
  const entryTrigger = useRef<HTMLButtonElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const set = t.set;

  const narrowed = Object.entries(spec.filters).filter(([k, parse]) => !RANGE_KEYS.has(k) && (f as Record<string, unknown>)[k] !== (parse as FilterParser<string>)(null));
  const matchKeys = Object.entries(spec.filters).filter(([k]) => !RANGE_KEYS.has(k) && !table.rawFilters?.includes(k));
  const values = { ...Object.fromEntries(matchKeys.map(([k]) => [k, String(f[k as keyof F])])), ...exactFilters?.values };
  const defaults = { ...Object.fromEntries(matchKeys.map(([k, parse]) => [k, (parse as FilterParser<string>)(null)])), ...Object.fromEntries(Object.keys(exactFilters?.values ?? {}).map(key => [key, ""])) };
  const exportBlocked = exactFilters && !exactFilters.valid ? "Clear the invalid exact filters before exporting." : t.total === 0 ? `No ${noun} match, so there is nothing to export.` : null;

  async function exportCsv() {
    if (exportBlocked) return;
    setExporting(true);
    try {
      const name = await (await import("@/lib/client/download")).download(`${path}?${t.filterQuery}&format=csv`, "audit.csv");
      toast(`Saved ${name}`, { description: `Every matching entry, newest first, up to ${formatNumber(CSV_MAX_ROWS)} rows.` });
    } catch (e) {
      toast.error(`Couldn't export the ${noun}`, { description: errorText(e) });
    } finally {
      setExporting(false);
    }
  }

  const shown = open && detail?.(open);
  const custom = customRange(f);
  const timeLabel = f.start && f.end ? timeRange(new URLSearchParams(f), 7).label : null;
  return (
    <div className="grid gap-section">
      <PageHeader title={title} description={description} />
      <FilterSurface>
      {entryNotice}
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the {noun}; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      {t.viewNotRemembered && <Notice>This filter selection works at this URL, but is too long to remember in navigation. Save a named view to reopen it.</Notice>}
      <FilterLayout<Record<string, string>> busy={t.paging.busy} values={values} defaults={defaults} fields={[{ key: "user", label: "User" }, ...filterFields, ...exactFilters?.fields ?? []]}
        onApply={(next, options) => {
          const patch = Object.fromEntries(matchKeys.filter(([key]) => next[key] !== values[key]).map(([key]) => [key, next[key]]));
          if (exactFilters) Object.assign(patch, exactFilters.clearPatch(next, values));
          set(patch as Partial<TableState<F>>, options);
        }}
        filters={(draft, patch) => <>
          <FilterSearch label="Search by user" value={draft.user!} onChange={user => patch({ user })} maxLength={64} placeholder="User name or email" />
          {filters({ ...f, ...draft }, next => patch(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v ?? "")]))))}
        </>}>
      {({ summary, flush }) => <Panel toolbar={<Toolbar end={<><SavedViewsMenu /><ColumnsMenu columns={columns} hidden={t.hidden} onChange={t.setHidden} />
          <BlockedButton variant="secondary" reason={exportBlocked}
            aria-disabled={exporting || undefined} onClick={() => { if (!exporting) void exportCsv(); }}>
            <Icon icon={ExportIcon} />{exporting ? "Exporting…" : "Export CSV"}
          </BlockedButton>
        </>}>{null}</Toolbar>}
        flush icon={icon} title="All entries" legend={legend} count={t.count}
        description={`${timeLabel ?? (custom ? rangeText(custom) : RANGE_LABEL[f.range])} · times in ${APP_TIME_ZONE_LABEL}`}
        footnote={`Export CSV saves every matching entry, newest first, up to ${formatNumber(CSV_MAX_ROWS)} rows.`}>
        {exactFilters ? <div className="[&_[data-slot=filter-chip]]:h-auto [&_[data-slot=filter-chip]]:min-h-6 [&_[data-slot=filter-chip]>span]:overflow-visible [&_[data-slot=filter-chip]>span]:whitespace-pre-wrap [&_[data-slot=filter-chip]>span]:wrap-anywhere">{summary}</div> : summary}
        <DataTable label={title} rowHeight="identity" columns={columns} hidden={t.hidden} rows={t.rows} rowKey={(r) => r.id} loading={t.loading}
          sort={t.sort} onSortChange={t.onSortChange} paging={t.paging}
          error={t.loadError ? { title: `Couldn't load ${noun}`, cause: errorText(t.loadError), onRetry: () => void t.query.refetch() } : null}
          empty={narrowed.length > 0
            ? { icon, title: `No ${noun} match`, description: "Change the search or filters, or clear them. A longer time range may also help." }
            : { icon, title: `No ${noun} in this time range`, description: `${emptyHint} Pick a longer time range to see older ones.` }}
          rowActions={(r) => <Button size="sm" variant="ghost" aria-label={`View entry: ${rowLabel(r)}`} aria-busy={pendingEntry?.toLowerCase() === r.id.toLowerCase() || undefined} onClick={event => { if (pendingEntry?.toLowerCase() === r.id.toLowerCase()) return; flush(); if (onEntry) onEntry(r, event.currentTarget); else { entryTrigger.current = event.currentTarget; setOpen(r); } }}>{pendingEntry?.toLowerCase() === r.id.toLowerCase() ? "Opening…" : "View entry"}</Button>} />
      </Panel>}
      </FilterLayout>
      </FilterSurface>
      {shown && <EntryDialog title={shown.title} summary={shown.summary} changes={shown.changes} rows={shown.rows} returnFocus={() => { if (entryTrigger.current?.isConnected) entryTrigger.current.focus(); }} onClose={() => setOpen(null)}>{shown.extra}</EntryDialog>}
    </div>
  );
}
