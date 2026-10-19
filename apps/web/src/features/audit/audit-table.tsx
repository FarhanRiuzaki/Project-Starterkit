"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useCallback, useState } from "react";
import { BlockedButton, type Column, DataTable, Notice, Panel, QueryInput, RelativeTime, TimeRangePicker, Toolbar } from "@starterkit/ui/ds";
import { APP_TIME_ZONE_LABEL, formatDateTimeLong, formatNumber } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { Icon, type IconData } from "@starterkit/ui/ui/icon";
import { ExportIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/sonner";
import { PageHeader } from "@/components/shell/page-header";
import { download, errorText } from "@/lib/client/api";
import { useTableQuery } from "@/lib/client/use-table-query";
import { AUDIT_RANGES, type AuditRange, CSV_MAX_ROWS, presetRange, RANGE_LABEL } from "@/lib/shared/audit";
import { type FilterParser, oneOf, type TableSpec, type TableState, text } from "@/lib/shared/table-state";

const EntryDialog = dynamic(() => import("./entry-dialog").then((m) => m.EntryDialog), { ssr: false });

/** Filters both logs share: who (free text, debounced) and the range preset. */
export type AuditFilters = { user: string; range: AuditRange };
export const AUDIT_FILTERS = { user: text(64), range: oneOf(AUDIT_RANGES, "7d") } satisfies { [K in keyof AuditFilters]: FilterParser<AuditFilters[K]> };

/** API parameters: the range preset becomes from/to calendar dates (app time zone, today included). */
const toParams = ({ range, ...rest }: AuditFilters & Record<string, string>) => ({ ...rest, ...presetRange(range, Date.now()) });

/** Time column cell: relative, with the absolute time under it. */
export const timeCell = (at: string) => (
  <span className="grid"><RelativeTime at={Date.parse(at)} /><span className="font-mono text-caption text-fg-3">{formatDateTimeLong(Date.parse(at))}</span></span>
);

export type AuditDetail = { title: string; rows: [string, ReactNode][]; extra?: ReactNode };

/**
 * The page both audit logs share: header with the range picker, user search + the log's own filters, a server-driven
 * table (paging, sort, filters in the URL), CSV export of the same filters, and a read-only detail dialog per row.
 * `spec` must be a module constant whose filters include AUDIT_FILTERS.
 */
export function AuditTable<T extends { id: string; at: string }, F extends AuditFilters>({
  title, description, noun, icon, path, spec, columns, rowLabel, filters, legend, emptyHint, detail,
}: {
  title: string; description: string;
  /** Plural, lower case: "activity entries". */
  noun: string;
  icon: IconData;
  path: "/api/audit/activity" | "/api/audit/auth";
  spec: TableSpec<F>;
  columns: Column<T>[];
  /** Names the row for its "View entry" button. */
  rowLabel: (r: T) => string;
  /** The log's own filter controls. */
  filters: (f: TableState<F>, set: (patch: Partial<TableState<F>>) => void) => ReactNode;
  legend?: ReactNode;
  /** Empty state with no filters: when entries appear. */
  emptyHint: string;
  detail: (r: T) => AuditDetail;
}) {
  const t = useTableQuery<T, F>({ key: path, path, spec, params: toParams });
  const f = t.state;
  const [open, setOpen] = useState<T | null>(null);
  const [exporting, setExporting] = useState(false);
  const set = t.set;
  const onUser = useCallback((user: string) => set({ user } as Partial<TableState<F>>), [set]);

  const narrowed = Object.entries(spec.filters).filter(([k, parse]) => k !== "range" && (f as Record<string, unknown>)[k] !== (parse as FilterParser<string>)(null));
  const clear = () => set(Object.fromEntries(narrowed.map(([k, parse]) => [k, (parse as FilterParser<string>)(null)])) as Partial<TableState<F>>);

  async function exportCsv() {
    setExporting(true);
    try {
      await download(`${path}?${t.filterQuery}&format=csv`, "audit.csv");
    } catch (e) {
      toast.error(`Couldn't export the ${noun}`, { description: errorText(e) });
    } finally {
      setExporting(false);
    }
  }

  const shown = open && detail(open);
  return (
    <div className="grid gap-section">
      <PageHeader title={title} description={description}
        actions={<><TimeRangePicker value={f.range} ranges={AUDIT_RANGES} onChange={(range) => set({ range } as Partial<TableState<F>>)} />{legend}</>} />
      {t.staleError && <Notice tone="warn" live>Couldn&apos;t refresh the {noun}; showing the ones loaded before. {errorText(t.staleError)}</Notice>}
      <Toolbar end={<>
        {narrowed.length > 0 && <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}
        <BlockedButton variant="secondary" reason={t.total === 0 ? `No ${noun} match, so there is nothing to export.` : null}
          aria-disabled={exporting || undefined} onClick={() => { if (!exporting) void exportCsv(); }}>
          <Icon icon={ExportIcon} />{exporting ? "Exporting…" : "Export CSV"}
        </BlockedButton>
      </>}>
        <div className="w-full max-w-80"><QueryInput value={f.user} onChange={onUser} keys={[]} label="Search by user" placeholder="Search by user name or email" /></div>
        {filters(f, set)}
      </Toolbar>
      <Panel flush icon={icon} title={title} count={t.total != null ? `${formatNumber(t.total)}${t.totalCapped ? "+" : ""}` : undefined}
        description={`${RANGE_LABEL[f.range]} · times in ${APP_TIME_ZONE_LABEL}`}
        footnote={`Export CSV saves every matching entry, newest first, up to ${formatNumber(CSV_MAX_ROWS)} rows.`}>
        <DataTable label={title} rowHeight="identity" columns={columns} rows={t.rows} rowKey={(r) => r.id} loading={t.loading}
          sort={t.sort} onSortChange={t.onSortChange} paging={t.paging}
          error={t.loadError ? { title: `Couldn't load the ${noun}`, cause: errorText(t.loadError), onRetry: () => void t.query.refetch() } : null}
          empty={narrowed.length > 0
            ? { icon, title: `No ${noun} match`, description: "Change the search or filters, or clear them. A longer time range may also help." }
            : { icon, title: `No ${noun} in this time range`, description: `${emptyHint} Pick a longer time range to see older ones.` }}
          rowActions={(r) => <Button size="sm" variant="ghost" aria-label={`View entry: ${rowLabel(r)}`} onClick={() => setOpen(r)}>View entry</Button>} />
      </Panel>
      {shown && <EntryDialog title={shown.title} rows={shown.rows} onClose={() => setOpen(null)}>{shown.extra}</EntryDialog>}
    </div>
  );
}
