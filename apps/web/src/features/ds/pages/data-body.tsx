"use client";

import { selectionValues } from "@starterkit/shared/filter-selection";
import { BarChart, CHART_HEIGHT, HBarChart, Heatmap } from "@starterkit/ui/charts";
import {
  ActionMenu, Avatar, BlockedButton, BulkActionBar, CategoryChip, ColumnsMenu, ConfirmActionDialog, CopyValue, DataRegion, DataTable, FilterChecks, FilterLayout, FilterSearch,
  LazyMount, Panel, ProgressBar, RelativeTime, Segmented, StatusChip, Toolbar, Truncate, UserCard,
  type Column, type SortDir,
} from "@starterkit/ui/ds";
import { APP_TIME_ZONE_LABEL, formatNumber } from "@starterkit/ui/lib/format";
import { HEALTH, type Health } from "@starterkit/ui/lib/status";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { HeatmapIcon, MoreIcon, SessionsIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { useState } from "react";
import { PermissionMatrix } from "@/components/permission-matrix";
import { AffectGroup } from "../affect/gallery";
import { DAYS, HEAT, MATRIX_MODULES, RESULTS, ROWS, type Row, TOP_ERRORS } from "../fixtures";
import { sample } from "../sample-toast";
import { SectionTitle } from "../section-title";
import { useHashScroll } from "../use-hash-scroll";

/** Matrix sample: the viewer holds every permission but role.delete and permission.create (those cells say why). */
const MATRIX_ALLOWED: ReadonlySet<string> = new Set(MATRIX_MODULES.flatMap((m) => m.actions.map((a) => `${m.key}.${a}`))
  .filter((p) => p !== "role.delete" && p !== "permission.create"));
const MATRIX_START = ["user.view", "user.create", "user.edit", "role.view", "role.delete", "audit.view"];

const HEALTHS = ["healthy", "degraded", "down", "stopped", "unknown"] as const satisfies readonly Health[];
const LEGEND = HEALTHS.map((h) => ({ health: h, label: HEALTH[h].label, description: HEALTH[h].description }));
const EMPTY = { icon: SessionsIcon, title: "No sessions yet", description: "Sessions appear here after someone signs in." };
const ROLES = [{ value: "", label: "Any" }, { value: "admin", label: "Admin" }, { value: "viewer", label: "Viewer" }] as const;
const STATUS_OPTIONS = [
  { value: "all", label: "All", count: ROWS.length },
  ...(["healthy", "degraded", "down"] as const).map((h) => ({ value: h, label: HEALTH[h].label, count: ROWS.filter((r) => r.status === h).length })),
] as const;

/** /ds/data below the first screen: the data table with its states, the permission matrix, charts, data compositions, affectUI's content group. */
export function DataSections() {
  useHashScroll();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [server, setServer] = useState({ page: 1, pageSize: 15, sort: { key: "name", dir: "asc" as SortDir } });
  const [perms, setPerms] = useState<ReadonlySet<string>>(() => new Set(MATRIX_START));
  const [hidden, setHidden] = useState<string[]>([]);
  const [count, setCount] = useState(3), [confirm, setConfirm] = useState(false);
  const [region, setRegion] = useState<"loading" | "empty" | "error" | "stale" | "data">("data");

  const columns: Column<Row>[] = [
    { key: "name", header: "User", sortable: true,
      cell: (r) => (
        <span className="flex min-w-0 max-w-72 items-center gap-2.5">
          <Avatar name={r.name} />
          <span className="grid min-w-0"><Truncate title={r.name}><span className="font-medium text-fg">{r.name}</span></Truncate><span className="truncate font-mono text-caption text-fg-3">{r.email}</span></span>
        </span>
      ) },
    { key: "status", header: "Status", sortable: true, cell: (r) => <StatusChip health={r.status} label={HEALTH[r.status].label} description={HEALTH[r.status].description} /> },
    { key: "city", header: "City", sortable: true, cell: (r) => r.city },
    { key: "seen", header: "Last seen", align: "right", cell: (r) => <span className="tabular">{r.lastSeen}</span> },
  ];
  const selectedStatuses = selectionValues(status);
  const rows = ROWS.filter(r => (!selectedStatuses.length || selectedStatuses.includes(r.status)) && (!query.trim() || `${r.name} ${r.email}`.toLowerCase().includes(query.trim().toLowerCase())));

  return (
    <>
      <div id="ds-tables" className="scroll-mt-20"><SectionTitle>Toolbar and data table</SectionTitle></div>
      <FilterLayout values={{ query, status, role }} defaults={{ query: "", status: "", role: "" }}
        fields={[{ key: "query", label: "Search" }, { key: "status", label: "Status", multiple: true, format: v => STATUS_OPTIONS.find(o => o.value === v)?.label ?? v }, { key: "role", label: "Role", multiple: true }]}
        onApply={v => { setQuery(v.query); setStatus(v.status); setRole(v.role); }}
        filters={(draft, patch) => <>
          <FilterSearch label="Search sample users" value={draft.query} onChange={query => patch({ query })} placeholder="Name or email" />
          <FilterChecks label="Status" value={draft.status} options={STATUS_OPTIONS.filter(option => option.value !== "all")} onChange={status => patch({ status })} />
          <FilterChecks label="Role" value={draft.role} options={ROLES} onChange={role => patch({ role })} />
        </>}>
      {({ summary }) => <Panel flush icon={UsersIcon} title="Users" count="12,345" legend={LEGEND}
        description="Sample data; live filters with selected-option badges and removable chips"
        toolbar={<Toolbar end={<><ColumnsMenu columns={columns} hidden={hidden} onChange={setHidden} /></>}>{null}</Toolbar>}>
        {summary}
        <DataTable label="Sample users" rowHeight="identity" columns={columns} hidden={hidden} rows={rows.slice(0, server.pageSize)} rowKey={(r) => r.id}
          isSelected={(r) => r.id === "row-2"} empty={EMPTY} sort={server.sort} onSortChange={(sort) => setServer((s) => ({ ...s, page: 1, sort }))}
          paging={{ mode: "server", page: server.page, pageSize: server.pageSize, total: 12_345, maxPage: 1000, pageSizes: [15, 25, 50, 100],
            onPageChange: (p) => setServer((s) => ({ ...s, page: p })), onPageSizeChange: (n) => setServer((s) => ({ ...s, page: 1, pageSize: n })) }}
          rowActions={(r) => <><Button size="sm" variant="ghost">Open</Button><ActionMenu label={`Actions for ${r.name}`} actions={[{ id: "edit", label: "Edit user" }, { id: "delete", label: "Delete user", destructive: true }]} /></>} />
      </Panel>}
      </FilterLayout>
      <Panel flush title="Table states" description="Loading, error and empty">
        <div className="grid divide-y divide-line">
          <DataTable label="Loading sample" columns={columns} hidden={hidden} rows={[]} rowKey={(r) => r.id} loading empty={EMPTY} />
          <DataTable label="Error sample" columns={columns} hidden={hidden} rows={[]} rowKey={(r) => r.id} error={{ title: "Couldn't load users", cause: "The server didn't answer. Try again in a minute." }} empty={EMPTY} />
          <DataTable label="Empty sample" columns={columns} hidden={hidden} rows={[]} rowKey={(r) => r.id} empty={EMPTY} />
        </div>
      </Panel>

      <Panel flush title="Permission matrix" description="Sticky header and module column; on a phone it scrolls inside the card. Press a read-only cell for its reason">
        <PermissionMatrix label="Permissions of Sample role" modules={MATRIX_MODULES} value={perms} allowed={MATRIX_ALLOWED} onChange={(edit) => setPerms((v) => edit(v))} />
      </Panel>

      <SectionTitle>Charts</SectionTitle>
      <div className="grid grid-cols-12 gap-gutter">
        <Panel title="Requests per day" description="Stacked bars · LazyMount" className="col-span-12 md:col-span-6">
          <LazyMount minHeight={CHART_HEIGHT.standard}><BarChart label="Requests per day" categories={DAYS} series={RESULTS} stacked format={formatNumber} /></LazyMount>
        </Panel>
        <Panel title="Top errors" description="Ranking · 7 days" className="col-span-12 md:col-span-6"><HBarChart label="Top errors" items={TOP_ERRORS} format={formatNumber} /></Panel>
        <Panel icon={HeatmapIcon} title="Load heatmap" description="One tile per node" className="col-span-12"><Heatmap label="Load per node" cells={HEAT} /></Panel>
      </div>

      <section id="ds-data" className="grid scroll-mt-20 gap-6" aria-label="Data compositions">
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2"><UserCard name="Alex Morgan" email="alex@example.com" badges={<CategoryChip label="Admin" slot={1} />} detail="Password + 2FA" activity={`Today, 09:41 ${APP_TIME_ZONE_LABEL}`} actions={<Button variant="ghost" size="icon" aria-label="Sample user actions" onClick={sample}><Icon icon={MoreIcon} /></Button>} /><Panel title="Values and progress"><div className="grid gap-5"><CopyValue label="sample key" value="sample-key-7K2A" /><RelativeTime at={Date.UTC(2026, 10, 7, 2, 41)} now={Date.UTC(2026, 10, 7, 2, 46)} /><ProgressBar label="Import progress" value={64} /><div className="flex items-center gap-3"><Avatar name="Alex Morgan" /><Avatar name="Priya Shah" /><Avatar name="Noor Chen" /></div></div></Panel></div>
        <BulkActionBar selectionLabel={`${count} users selected`} scope="Selection applies to this page. Deactivation requires confirmation." onClear={() => setCount(0)}><BlockedButton reason={count ? null : "Select at least one user."} variant="destructive" onClick={() => setConfirm(true)}>Deactivate sample</BlockedButton><Button variant="secondary" onClick={() => setCount(3)}>Select sample rows</Button></BulkActionBar>
        <ConfirmActionDialog open={confirm} onOpenChange={setConfirm} title={`Deactivate ${count} sample users?`} description="This changes the preview only. In the app, selected users would lose access." impact={[`${count} sample users lose access.`]} reasons={[]} auditFields={false} actionLabel="Deactivate sample users" onConfirm={async () => { setCount(0); setConfirm(false); sample(); }} />
        <Panel title="Data region: five states" toolbar={<div className="scroll-quiet max-w-full overflow-x-auto py-1"><Segmented label="Preview data state" value={region} onChange={setRegion} options={(["data", "loading", "empty", "error", "stale"] as const).map(value => ({ value, label: value }))} /></div>}><DataRegion state={region} empty={{ icon: UsersIcon, title: "No users yet", description: "Users appear after an invitation is accepted." }} onRetry={() => setRegion("data")}><p className="text-body">Sample results stay visible when the source is stale.</p></DataRegion></Panel>
      </section>

      <AffectGroup id="content" />
    </>
  );
}
