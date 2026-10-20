"use client";

import { BarChart, CHART_HEIGHT, HBarChart, Heatmap } from "@starterkit/ui/charts";
import {
  ActionMenu, Avatar, AvatarStack, BlockedButton, Brand, CategoryChip, Checkbox, ConfirmActionDialog, CountBadge, DataTable, EmptyState, ErrorState, Field, FilterChip, FilterMenu,
  Kbd, LazyMount, Meter, Panel, QueryInput, SecretOnceDialog, Segmented, Spec, StatusChip, TickMeter, Toolbar, ToolbarFilters, Truncate,
  type Column, type SortDir,
} from "@starterkit/ui/ds";
import { formatNumber } from "@starterkit/ui/lib/format";
import { HEALTH, type Health } from "@starterkit/ui/lib/status";
import { Reveal } from "@starterkit/ui/motion";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { HeatmapIcon, InfoIcon, RefreshIcon, SessionsIcon, SurfacesIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { Input } from "@starterkit/ui/ui/input";
import { PasswordInput } from "@starterkit/ui/ui/password-input";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@starterkit/ui/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starterkit/ui/ui/tooltip";
import { useCallback, useState } from "react";
import { SunnyGoMark, SunnyGoWordmark } from "@/components/brand";
import { PermissionMatrix } from "@/components/permission-matrix";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { DAYS, HEAT, RESULTS, ROWS, type Row, TOP_ERRORS } from "./fixtures";
import { MotionSection } from "./motion-section";

/** Matrix sample: the viewer holds every permission but role.delete and permission.create (those cells say why). */
const MATRIX_ALLOWED: ReadonlySet<PermissionName> = new Set(PERMISSIONS.filter((p) => p !== "role.delete" && p !== "permission.create"));
const MATRIX_START: PermissionName[] = ["user.view", "user.create", "user.edit", "role.view", "role.delete", "audit.view"];

/** Fixed, obviously fake sample for the one-time secret demo (the gallery has no backend). */
const SAMPLE_SECRET = "Sample-Pw-Not-Real-0000";
const HEALTHS = ["healthy", "degraded", "down", "stopped", "unknown"] as const satisfies readonly Health[];
const LEGEND = HEALTHS.map((h) => ({ health: h, label: HEALTH[h].label, description: HEALTH[h].description }));
const EMPTY = { icon: SessionsIcon, title: "No sessions yet", description: "Sessions appear here after someone signs in." };
const ROLES = [{ value: "", label: "Any" }, { value: "admin", label: "Admin" }, { value: "viewer", label: "Viewer" }] as const;
const STATUS_OPTIONS = [
  { value: "all", label: "All", count: ROWS.length },
  ...(["healthy", "degraded", "down"] as const).map((h) => ({ value: h, label: HEALTH[h].label, count: ROWS.filter((r) => r.status === h).length })),
] as const;

function SectionTitle({ children }: { children: string }) {
  return <h2 className="-mb-2 text-title-3 text-fg-2">{children}</h2>;
}

export function GallerySections() {
  const [query, setQuery] = useState("status:degraded city:oslo");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");
  const [chip, setChip] = useState(true);
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("");
  const [server, setServer] = useState({ page: 1, pageSize: 15, sort: { key: "name", dir: "asc" as SortDir } });
  const [dialog, setDialog] = useState(false);
  const [secret, setSecret] = useState(false);
  const [perms, setPerms] = useState<ReadonlySet<PermissionName>>(() => new Set(MATRIX_START));

  const columns: Column<Row>[] = [
    { key: "name", header: "User", icon: UsersIcon, sortable: true,
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
  const rows = status === "all" ? ROWS : ROWS.filter((r) => r.status === status);

  return (
    <>
      <SectionTitle>Toolbar and data table</SectionTitle>
      <Toolbar>
        <div className="w-full max-w-80 max-md:max-w-none"><QueryInput value={query} onChange={setQuery} keys={["status", "city"]} label="Search users" placeholder="status:degraded city:oslo" /></div>
        <ToolbarFilters active={(status !== "all" ? 1 : 0) + (role ? 1 : 0)}>
          <Segmented label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <FilterMenu label="Role" value={role} options={ROLES} onChange={setRole} />
        </ToolbarFilters>
        {chip && <FilterChip removeLabel="Remove filter role:viewer" onRemove={() => setChip(false)}>role:viewer</FilterChip>}
      </Toolbar>
      <Panel flush icon={UsersIcon} title="Users" count="12,345" legend={LEGEND}
        description="Server-paged: page, page size and sort are requests; selection, row actions; the info button explains the statuses">
        <DataTable label="Sample users" rowHeight="identity" columns={columns} rows={rows.slice(0, server.pageSize)} rowKey={(r) => r.id}
          isSelected={(r) => r.id === "row-2"} empty={EMPTY} sort={server.sort} onSortChange={(sort) => setServer((s) => ({ ...s, page: 1, sort }))}
          paging={{ mode: "server", page: server.page, pageSize: server.pageSize, total: 12_345, maxPage: 1000, pageSizes: [15, 25, 50, 100],
            onPageChange: (p) => setServer((s) => ({ ...s, page: p })), onPageSizeChange: (n) => setServer((s) => ({ ...s, page: 1, pageSize: n })) }}
          rowActions={(r) => <><Button size="sm" variant="ghost">Open</Button><ActionMenu label={`Actions for ${r.name}`} actions={[{ id: "edit", label: "Edit user" }, { id: "delete", label: "Delete user", destructive: true }]} /></>} />
      </Panel>
      <Panel flush title="Table states" description="Loading, error and empty">
        <div className="grid divide-y divide-line">
          <DataTable label="Loading sample" columns={columns} rows={[]} rowKey={(r) => r.id} loading empty={EMPTY} />
          <DataTable label="Error sample" columns={columns} rows={[]} rowKey={(r) => r.id} error={{ title: "Couldn't load users", cause: "The server didn't answer. Try again in a minute." }} empty={EMPTY} />
          <DataTable label="Empty sample" columns={columns} rows={[]} rowKey={(r) => r.id} empty={EMPTY} />
        </div>
      </Panel>

      <Panel flush title="Permission matrix" description="Sticky header and module column; on a phone it scrolls inside the card. Press a read-only cell for its reason">
        <PermissionMatrix label="Permissions of Sample role" value={perms} allowed={MATRIX_ALLOWED} onChange={(edit) => setPerms((v) => edit(v))} />
      </Panel>

      <SectionTitle>Charts</SectionTitle>
      <div className="grid grid-cols-12 gap-gutter">
        <Panel title="Requests per day" description="Stacked bars · LazyMount" className="col-span-12 md:col-span-6">
          <LazyMount minHeight={CHART_HEIGHT.standard}><BarChart label="Requests per day" categories={DAYS} series={RESULTS} stacked format={formatNumber} /></LazyMount>
        </Panel>
        <Panel title="Top errors" description="Ranking · 7 days" className="col-span-12 md:col-span-6"><HBarChart label="Top errors" items={TOP_ERRORS} format={formatNumber} /></Panel>
        <Panel icon={HeatmapIcon} title="Load heatmap" description="One tile per node" className="col-span-12"><Heatmap label="Load per node" cells={HEAT} /></Panel>
      </div>

      <SectionTitle>Components</SectionTitle>
      <div className="grid grid-cols-12 gap-gutter">
        <Panel title="Buttons and inputs" className="col-span-12 md:col-span-6">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Create user</Button><Button variant="secondary">Export CSV</Button><Button variant="ghost">Clear filters</Button>
              <Button variant="destructive">Delete 2 users</Button><Button variant="secondary" disabled>Unlock</Button>
              <Button size="sm" variant="secondary">Compact 28</Button><Button size="icon" variant="secondary" aria-label="Refresh now"><Icon icon={RefreshIcon} /></Button>
              <Button variant="link">Forgot password?</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><label htmlFor="ds-email" className="text-label text-fg-2">Email</label><Input id="ds-email" defaultValue="alex@example.com" className="font-mono" /><span className="text-body-sm text-fg-3">Used to sign in and to reset the password.</span></div>
              <div className="grid gap-1.5"><label htmlFor="ds-otp" className="text-label text-fg-2">One-time code</label><Input id="ds-otp" defaultValue="12a4" aria-invalid="true" aria-describedby="ds-otp-e" /><span id="ds-otp-e" className="text-body-sm text-down-ink">Enter the 6-digit code from your authenticator app.</span></div>
              <Field id="ds-role" label="Role name" note="Field wires this note to the input for screen readers."><Input id="ds-role" defaultValue="Auditor" /></Field>
              <Field id="ds-password" label="Password" note="Show password toggles the mask; a Caps Lock note appears while it is on."><PasswordInput id="ds-password" defaultValue="correct horse" autoComplete="off" /></Field>
              <Field id="ds-username" label="Username" note="Read-only: inset fill, still focusable and copyable."><Input id="ds-username" defaultValue="alex.rivers" readOnly className="font-mono" /></Field>
            </div>
          </div>
        </Panel>
        <Panel title="Chips, badges and tabs" className="col-span-12 md:col-span-6">
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">{HEALTHS.map((h) => <StatusChip key={h} health={h} label={HEALTH[h].label} description={HEALTH[h].description} />)}<StatusChip health="healthy" label="Starting" pending /></div>
            <div className="flex flex-wrap gap-2" data-status-static="">{HEALTHS.map((h) => <StatusChip key={h} health={h} label={HEALTH[h].label} strong />)}</div>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip label="api" slot={1} /><CategoryChip label="web" slot={2} /><CategoryChip label="worker" slot={3} /><CountBadge>312</CountBadge>
            </div>
            <Tabs defaultValue="overview">
              <TabsList aria-label="Sample sections">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="sessions">Sessions <CountBadge>2</CountBadge></TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="text-body-sm text-fg-3">Line tabs: the underline slides between tabs.</TabsContent>
              <TabsContent value="sessions" className="text-body-sm text-fg-3">Two active sessions.</TabsContent>
              <TabsContent value="security" className="text-body-sm text-fg-3">Two-factor authentication is on.</TabsContent>
            </Tabs>
          </div>
        </Panel>
        <Panel title="Meters, avatars and facts" className="col-span-12 md:col-span-6">
          <div className="grid gap-4">
            <Meter label="Load" ratio={0.52} value="52%" />
            <Meter label="Storage" ratio={0.86} value="17.2 GB / 20 GB" limitRatio={0.9} />
            <Meter label="Import" ratio={0.4} value="In progress" striped />
            <TickMeter label="Monthly quota" ratio={0.38} value="38%" ticks={40} threshold={0.8} />
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name="Alex Rivers" size={32} /><Avatar name="Sam Hale" /><Avatar name="Robin Lund" size={24} />
              <AvatarStack names={["Alex Rivers", "Sam Hale", "Robin Lund", "Jamie Okafor", "Taylor Stone", "Morgan Quill"]} />
            </div>
            <Spec items={[{ label: "User", value: "alex.rivers" }, { label: "Sessions", value: "1 active" }, { label: "Role", value: "Admin" }]} />
          </div>
        </Panel>
        <RevealDemo />
        <Panel title="Empty and error" className="col-span-12 md:col-span-6" bodyClassName="grid gap-2 sm:grid-cols-2">
          <EmptyState icon={UsersIcon} title="No users yet" description="Users appear here after you create the first one." />
          <ErrorState title="Couldn't load metrics" cause="The metrics source isn't responding. Try again in a minute." lastGood={Date.UTC(2026, 9, 16, 7, 2)} onRetry={() => undefined} />
        </Panel>
        <Panel title="Menus, tooltips and dialogs" className="col-span-12 md:col-span-6">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <ActionMenu label="Sample actions" actions={[{ id: "edit", label: "Edit user" }, { id: "delete", label: "Delete user", destructive: true }]} />
              <Tooltip>
                <TooltipTrigger asChild><Button variant="secondary"><Icon icon={InfoIcon} />Hover for a tooltip</Button></TooltipTrigger>
                <TooltipContent>Inverse tooltip: radius 8, 13 px text, at most 280 px wide.</TooltipContent>
              </Tooltip>
              <Button variant="secondary" onClick={() => setDialog(true)}>Delete user</Button>
              <BlockedButton variant="secondary" reason="This is the last active Superadmin. Make another user Superadmin first.">Deactivate user</BlockedButton>
              <span className="inline-flex items-center"><Checkbox checked label="Checked sample" /><Checkbox checked="mixed" label="Mixed sample" /><Checkbox checked={false} label="Unchecked sample" /><Checkbox checked readOnly label="Read-only sample" /><Checkbox checked={false} reason="Your role doesn't hold this permission." label="Read-only with reason sample" /></span>
              <Button variant="secondary" onClick={() => setSecret(true)}>Show one-time secret</Button>
              <span className="inline-flex items-center gap-1.5 text-body-sm text-fg-3">Open the palette <Kbd keys={["⌘K"]} /></span>
            </div>
            <p className="text-body-sm text-fg-3">Dialog for risky actions: impact, a required reason and audit note, and the typed name.</p>
          </div>
        </Panel>
      </div>

      <SectionTitle>Tokens</SectionTitle>
      <Tokens />

      <MotionSection />

      <ConfirmActionDialog open={dialog} onOpenChange={setDialog} title="Delete user alex.rivers?" description="The user can no longer sign in. Their activity log entries are kept." destructive
        impact={["1 active session ends", "The user is removed from every role"]} reasons={["Left the team", "Duplicate account", "Requested by the user"]}
        actionLabel="Delete user" confirmText="alex.rivers" onConfirm={async () => setDialog(false)} />
      {secret && (
        <SecretOnceDialog title="New password for Sam Hale" secret={SAMPLE_SECRET} label="new password" onClose={() => setSecret(false)}
          notes={["Shown once. Copy it now; the app doesn't store it and can't show it again.", "Give it to the user through a trusted channel, not email or chat."]} />
      )}
    </>
  );
}

/** Loading → content crossfade: same box, no layout shift. "Reload" shows the skeleton for 1.2 s. */
function RevealDemo() {
  const [loading, setLoading] = useState(false);
  const reload = useCallback(() => { setLoading(true); setTimeout(() => setLoading(false), 1200); }, []);
  return (
    <Panel title="Loading → content crossfade" description="No layout shift" className="col-span-12 md:col-span-6"
      actions={<Button size="sm" variant="secondary" onClick={reload} disabled={loading}><Icon icon={RefreshIcon} />Reload</Button>}>
      <Reveal loading={loading} skeleton={<div className="grid gap-3"><Skeleton className="h-2.5 w-1/3" /><Skeleton className="h-7 w-1/2" /><Skeleton className="h-2.5 w-full" /><Skeleton className="h-2.5 w-2/3" /></div>}>
        <div className="grid gap-2">
          <span className="text-body-sm text-fg-2">Active sessions now</span>
          <span className="text-stat text-fg">3<span className="ml-1 text-body font-normal text-fg-3">of 24 users</span></span>
          <p className="text-body-sm text-fg-3">Alex Rivers, Sam Hale and Robin Lund are signed in.</p>
        </div>
      </Reveal>
    </Panel>
  );
}

const SURFACES = [
  { name: "bg", cls: "bg-bg" }, { name: "sheet", cls: "bg-sheet" }, { name: "tray", cls: "bg-tray" }, { name: "card", cls: "bg-card" },
  { name: "inset", cls: "bg-inset" }, { name: "raised", cls: "bg-raised" },
] as const;
const COLOURS = [
  { name: "primary", cls: "bg-primary" }, { name: "action", cls: "bg-action" }, { name: "row-selected", cls: "bg-row-selected" },
  { name: "healthy-mark", cls: "bg-healthy-mark" }, { name: "degraded-mark", cls: "bg-degraded-mark" }, { name: "down-mark", cls: "bg-down-mark" },
  { name: "stopped-mark", cls: "bg-stopped-mark" }, { name: "chart-1", cls: "bg-chart-1" }, { name: "chart-2", cls: "bg-chart-2" },
  { name: "chart-3", cls: "bg-chart-3" }, { name: "chart-4", cls: "bg-chart-4" }, { name: "chart-5", cls: "bg-chart-5" }, { name: "chart-6", cls: "bg-chart-6" },
] as const;
const TYPE = [
  { name: "display 32/40", cls: "text-display", sample: "1,284" }, { name: "title-1 22/28", cls: "text-title-1", sample: "Users" },
  { name: "title-2 15/22", cls: "text-title-2", sample: "Requests by service" }, { name: "title-3 14/20", cls: "text-title-3", sample: "Alex Rivers" },
  { name: "stat 28/32", cls: "text-stat", sample: "4.6 MB" }, { name: "stat-sm 20/28", cls: "text-stat-sm", sample: "52%" },
  { name: "body 14/20", cls: "text-body", sample: "Sessions appear here after someone signs in." },
  { name: "body-sm 13/18", cls: "text-body-sm", sample: "Updated 2 minutes ago" }, { name: "label 12/16", cls: "text-label", sample: "Email" },
  { name: "caption 11/16", cls: "text-caption", sample: "vs previous 24 hours" }, { name: "eyebrow mono", cls: "eyebrow", sample: "Access" },
  { name: "mono 12/16", cls: "font-mono text-mono", sample: "alex.rivers · 10.0.0.14" },
] as const;

/** The Brand slot at the sizes the app uses (the logo itself lives in components/brand). */
const LOGOS = [
  { name: "sidebar · wordmark 104 px", collapsed: false, wordmark: <SunnyGoWordmark className="w-26" /> },
  { name: "sign-in card · wordmark 120 px", collapsed: false, wordmark: <SunnyGoWordmark className="w-30" /> },
  { name: "rail · mark 28 px", collapsed: true, wordmark: null },
] as const;

function Tokens() {
  return (
    <div className="grid grid-cols-12 gap-gutter">
      <Panel title="Brand" description="Wordmark when expanded, mark in the rail; clear space = the sun's diameter" className="col-span-12">
        <ul className="flex flex-wrap items-end gap-12">
          {LOGOS.map((l) => (
            <li key={l.name} className="grid justify-items-start gap-4">
              <Brand collapsed={l.collapsed} mark={<SunnyGoMark className="size-7" />} wordmark={l.wordmark} />
              <span className="font-mono text-caption text-fg-3">{l.name}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel icon={SurfacesIcon} title="Surfaces" description="bg → sheet → tray → card → inset" className="col-span-12 md:col-span-6">
        <ul className="grid grid-cols-3 gap-2">{SURFACES.map((s) => <Swatch key={s.name} {...s} />)}</ul>
      </Panel>
      <Panel title="Color" description="Ink is neutral; color is information" className="col-span-12 md:col-span-6">
        <ul className="grid grid-cols-4 gap-2">{COLOURS.map((s) => <Swatch key={s.name} {...s} />)}</ul>
      </Panel>
      <Panel title="Type scale" description="Inter Variable + Geist Mono" className="col-span-12">
        <dl className="grid">
          {TYPE.map((t) => (
            <div key={t.name} className="flex min-w-0 items-baseline gap-4 border-b border-dashed border-line py-2 last:border-b-0">
              <dt className="w-32 shrink-0 font-mono text-caption text-fg-3">{t.name}</dt><dd className={`${t.cls} min-w-0 truncate text-fg`} title={t.sample}>{t.sample}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

function Swatch({ name, cls }: { name: string; cls: string }) {
  return (
    <li className="overflow-hidden rounded-lg border border-line bg-card">
      <span aria-hidden="true" className={`block h-11 border-b border-line ${cls}`} />
      <span className="block px-2 py-1.5 font-mono text-caption text-fg-2">{name}</span>
    </li>
  );
}
