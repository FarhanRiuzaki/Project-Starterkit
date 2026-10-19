"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useCallback, useId, useState } from "react";
import { BlockedButton, type Column, DataTable, type LegendItem, Notice, Panel, QueryInput, RelativeTime, TimeRangePicker, Toolbar } from "@starterkit/ui/ds";
import { APP_TIME_ZONE_LABEL, appDayStart, formatDateTimeLong, formatDateWIB, formatNumber } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { Icon, type IconData } from "@starterkit/ui/ui/icon";
import { ExportIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { toast } from "@starterkit/ui/ui/toast";
import { PageHeader } from "@/components/shell/page-header";
import { download, errorText } from "@/lib/client/api";
import { useTableQuery } from "@/lib/client/use-table-query";
import { AUDIT_RANGES, CSV_MAX_ROWS, MAX_RANGE_DAYS, RANGE_LABEL, rangeProblem } from "@/lib/shared/audit";
import { type AuditFilters, customRange, type TableDef } from "@/lib/shared/queries";
import type { FilterParser, TableState } from "@/lib/shared/table-state";

const EntryDialog = dynamic(() => import("./entry-dialog").then((m) => m.EntryDialog), { ssr: false });

/** Filters that set the time range, not the match: "Clear filters" leaves them. */
const RANGE_KEYS = new Set(["range", "from", "to"]);

const RANGE_ERROR = {
  pair: "Pick an end date too.",
  order: "The start date must be on or before the end date.",
  span: `Pick ${MAX_RANGE_DAYS} days or fewer.`,
} as const;

/**
 * Custom from–to (native date inputs). A valid pair is applied at once; a broken one stays a draft with its problem
 * announced (aria-live), and the list keeps its last range. Clearing both dates returns to the preset.
 */
function CustomRange({ from, to, onCommit }: { from: string; to: string; onCommit: (from: string, to: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState({ from, to });
  // The URL changed elsewhere (a preset picked, Back): adopt it while rendering.
  const [synced, setSynced] = useState(`${from}|${to}`);
  if (synced !== `${from}|${to}`) { setSynced(`${from}|${to}`); setDraft({ from, to }); }
  const problem = draft.from || draft.to ? rangeProblem(draft.from || undefined, draft.to || undefined) : null;

  function change(next: { from: string; to: string }) {
    setDraft(next);
    if (!next.from && !next.to) onCommit("", "");
    else if (customRange(next)) onCommit(next.from, next.to);
  }
  const field = (key: "from" | "to", label: string) => (
    <label className="flex items-center gap-1.5 text-body-sm text-fg-3">
      {label}
      <Input type="date" value={draft[key]} onChange={(e) => change({ ...draft, [key]: e.target.value })} className="w-38 font-mono text-body-sm"
        aria-invalid={problem && problem !== "pair" ? true : undefined} aria-describedby={`${id}-msg`} />
    </label>
  );
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Custom date range, {APP_TIME_ZONE_LABEL}</legend>
      {field("from", "From")}
      {field("to", "to")}
      <p id={`${id}-msg`} aria-live="polite" className={problem === "pair" ? "text-body-sm text-fg-3" : "text-body-sm text-down-ink"}>
        {problem ? RANGE_ERROR[problem] : ""}
      </p>
    </fieldset>
  );
}

/** Time column cell: relative, with the absolute time under it. */
export const timeCell = (at: string) => (
  <span className="grid"><RelativeTime at={Date.parse(at)} /><span className="font-mono text-caption text-fg-3">{formatDateTimeLong(Date.parse(at))}</span></span>
);

const day = (d: string) => formatDateWIB(appDayStart(d));
const rangeText = (r: { from: string; to: string }) => (r.from === r.to ? day(r.from) : `${day(r.from)} – ${day(r.to)}`);

export type AuditDetail = { title: string; rows: [string, ReactNode][]; extra?: ReactNode };

/**
 * The page both audit logs share: header with the range picker, user search + the log's own filters, a server-driven
 * table (paging, sort, filters in the URL), CSV export of the same filters, and a read-only detail dialog per row.
 * `table` is a lib/shared/queries constant (ACTIVITY, AUTH_LOG): its filters include the shared audit filters.
 */
export function AuditTable<T extends { id: string; at: string }, F extends AuditFilters>({
  title, description, noun, icon, table, columns, rowLabel, filters, legend, emptyHint, detail,
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
  filters: (f: TableState<F>, set: (patch: Partial<TableState<F>>) => void) => ReactNode;
  /** Statuses the table shows: the info button in its card header. */
  legend?: readonly LegendItem[];
  /** Empty state with no filters: when entries appear. */
  emptyHint: string;
  detail: (r: T) => AuditDetail;
}) {
  const { path, spec } = table;
  const t = useTableQuery<T, F>(table);
  const f = t.state;
  const [open, setOpen] = useState<T | null>(null);
  const [exporting, setExporting] = useState(false);
  const set = t.set;
  const onUser = useCallback((user: string) => set({ user } as Partial<TableState<F>>), [set]);

  const narrowed = Object.entries(spec.filters).filter(([k, parse]) => !RANGE_KEYS.has(k) && (f as Record<string, unknown>)[k] !== (parse as FilterParser<string>)(null));
  const clear = () => set(Object.fromEntries(narrowed.map(([k, parse]) => [k, (parse as FilterParser<string>)(null)])) as Partial<TableState<F>>);

  async function exportCsv() {
    setExporting(true);
    try {
      const name = await download(`${path}?${t.filterQuery}&format=csv`, "audit.csv");
      toast(`Saved ${name}`, { description: `Every matching entry, newest first, up to ${formatNumber(CSV_MAX_ROWS)} rows.` });
    } catch (e) {
      toast.error(`Couldn't export the ${noun}`, { description: errorText(e) });
    } finally {
      setExporting(false);
    }
  }

  const shown = open && detail(open);
  const custom = customRange(f);
  return (
    <div className="grid gap-section">
      <PageHeader title={title} description={description}
        actions={<TimeRangePicker value={custom ? null : f.range} ranges={AUDIT_RANGES} onChange={(range) => set({ range, from: "", to: "" } as Partial<TableState<F>>)} />} />
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the {noun}; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      <Toolbar end={<>
        <BlockedButton variant="secondary" reason={t.total === 0 ? `No ${noun} match, so there is nothing to export.` : null}
          aria-disabled={exporting || undefined} onClick={() => { if (!exporting) void exportCsv(); }}>
          <Icon icon={ExportIcon} />{exporting ? "Exporting…" : "Export CSV"}
        </BlockedButton>
      </>}>
        <div className="w-full max-w-80"><QueryInput value={f.user} onChange={onUser} keys={[]} label="Search by user" placeholder="Search by user name or email" /></div>
        {filters(f, set)}
        {narrowed.length > 0 && <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}
        {/* Keyed by the preset: picking another one drops a half-filled custom pair and its hint. */}
        <CustomRange key={f.range} from={f.from} to={f.to} onCommit={(from, to) => set({ from, to } as Partial<TableState<F>>)} />
      </Toolbar>
      <Panel flush icon={icon} title={title} legend={legend} count={t.count}
        description={`${custom ? rangeText(custom) : RANGE_LABEL[f.range]} · times in ${APP_TIME_ZONE_LABEL}`}
        footnote={`Export CSV saves every matching entry, newest first, up to ${formatNumber(CSV_MAX_ROWS)} rows.`}>
        <DataTable label={title} rowHeight="identity" columns={columns} rows={t.rows} rowKey={(r) => r.id} loading={t.loading}
          sort={t.sort} onSortChange={t.onSortChange} paging={t.paging}
          error={t.loadError ? { title: `Couldn't load ${noun}`, cause: errorText(t.loadError), onRetry: () => void t.query.refetch() } : null}
          empty={narrowed.length > 0
            ? { icon, title: `No ${noun} match`, description: "Change the search or filters, or clear them. A longer time range may also help." }
            : { icon, title: `No ${noun} in this time range`, description: `${emptyHint} Pick a longer time range to see older ones.` }}
          rowActions={(r) => <Button size="sm" variant="ghost" aria-label={`View entry: ${rowLabel(r)}`} onClick={() => setOpen(r)}>View entry</Button>} />
      </Panel>
      {shown && <EntryDialog title={shown.title} rows={shown.rows} onClose={() => setOpen(null)}>{shown.extra}</EntryDialog>}
    </div>
  );
}
