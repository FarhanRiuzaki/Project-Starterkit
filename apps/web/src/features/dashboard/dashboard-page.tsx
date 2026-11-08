"use client";

import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BarChart, CHART_HEIGHT, ChartLegend, legendItems } from "@starterkit/ui/charts";
import { Avatar, type Column, DataTable, type Delta, EmptyState, ErrorState, LazyMount, Notice, Panel, RelativeTime, StatTile, StatTiles, StatTileSkeletons, Truncate } from "@starterkit/ui/ds";
import { Reveal } from "@starterkit/ui/motion";
import { APP_TIME_ZONE_LABEL, appDayStart, formatDate, formatNumber, formatSignedNumber } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { ColumnChartIcon, FailedIcon, IdentityIcon, LogIcon, SessionsIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { actionLabel } from "@starterkit/shared/audit";
import type { ActivityDto } from "@starterkit/shared/contracts/audit";
import type { DashboardDto } from "@starterkit/shared/contracts/dashboard";
import { timeRange } from "@/lib/shared/time-controls";
import { dashboardRead } from "@/lib/shared/queries";

// Sign-in outcomes are events, not health: slot 1 / slot 2 (design-system §3.3, §5.8), never the Down mark.
const SERIES = [{ label: "Successful", slot: 0 }, { label: "Failed", slot: 1 }];

/** A count against the same span before it; `good` = the direction that is good news (more failed sign-ins is bad). */
const change = (now: number, before: number, span: string, good: "up" | "down"): Delta => ({
  text: `${formatSignedNumber(now - before)} vs previous ${span}`, direction: now > before ? "up" : now < before ? "down" : "flat", good,
});

const RECENT: Column<ActivityDto>[] = [
  { key: "at", header: "Time", cell: (r) => <RelativeTime at={Date.parse(r.at)} /> },
  { key: "actor", header: "User", className: "min-w-48", cell: (r) => (
    <span className="flex min-w-0 max-w-56 items-center gap-2.5"><Avatar name={r.actor.name} seed={r.actor.id} /><Truncate title={r.actor.name}>{r.actor.name}</Truncate></span>
  ) },
  { key: "action", header: "Action", mobile: "title", cell: (r) => actionLabel(r.action) },
  { key: "target", header: "Target", cell: (r) => <span className="block max-w-64"><Truncate title={r.target.label}>{r.target.label}</Truncate></span> },
];

/** Home: headline numbers, sign-ins per day, and (with audit.view) the latest activity. */
export function DashboardPage() {
  const sp = useSearchParams(), read = dashboardRead(sp);
  const q = useQuery({ queryKey: read.key, queryFn: () => api<DashboardDto>(read.path), placeholderData: keepPreviousData });
  // What the server will send follows audit.view, so the loading shape matches the loaded one (no layout shift).
  const audit = useAuth().can("audit.view");
  const d = q.data;
  const days = d?.loginsPerDay ?? [];
  const signIns = days.reduce((n, x) => n + x.success + (x.failed ?? 0), 0);
  const series = audit ? SERIES : SERIES.slice(0, 1);
  const tile = (n: number) => ({ value: formatNumber(n), tween: { value: n, format: formatNumber } });

  return (
    <div className="grid gap-section">
      <PageHeader title="Dashboard" description="Users, sessions and sign-ins across the app." />
      {q.isPlaceholderData && <Notice live>Updating the selected period…</Notice>}
      {q.error && d && <Notice tone="warn" live>Couldn&apos;t refresh the dashboard; showing the numbers loaded before. {errorText(q.error)}</Notice>}

      {q.error && !d ? (
        <Panel><ErrorState title="Couldn't load the dashboard" cause={errorText(q.error)} onRetry={() => void q.refetch()} /></Panel>
      ) : (
        <>
          <Reveal loading={!d} skeleton={<StatTiles><StatTileSkeletons count={audit ? 4 : 3} /></StatTiles>}>
            {d && (
              <StatTiles>
                <StatTile icon={UsersIcon} label="Active users" {...tile(d.activeUsers)} caption="Accounts that can sign in" />
                <StatTile icon={IdentityIcon} label="New users" {...tile(d.period?.newUsers ?? d.newUsers7d)} caption={d.period ? "Selected period · vs preceding period" : "Last 7 days · vs previous 7 days"}
                  delta={change(d.period?.newUsers ?? d.newUsers7d, d.period?.previousNewUsers ?? d.newUsersPrev7d, d.period ? "period" : "7 days", "up")} />
                {d.failedLogins24h !== null && (
                  <StatTile icon={FailedIcon} label="Failed sign-ins" {...tile(d.period?.failedSignIns ?? d.failedLogins24h)} caption={d.period ? "Selected period · vs preceding period" : "Last 24 hours · vs previous 24 hours"}
                    delta={change(d.period?.failedSignIns ?? d.failedLogins24h, d.period?.previousFailedSignIns ?? d.failedLoginsPrev24h ?? 0, d.period ? "period" : "24 hours", "down")} />
                )}
                <StatTile icon={SessionsIcon} label="Active sessions" {...tile(d.activeSessions)} caption="Signed in now" />
              </StatTiles>
            )}
          </Reveal>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Panel bodyClassName="overflow-clip" icon={ColumnChartIcon} title="Sign-ins per day" description={`${d?.period ? timeRange(sp).label : "Last 14 days"} · per day, ${APP_TIME_ZONE_LABEL}`}
            actions={<ChartLegend items={legendItems(series)} />}>
            <Reveal loading={!d} skeleton={<Skeleton className="w-full rounded-md" style={{ height: CHART_HEIGHT.standard }} />}>
              {signIns === 0 ? <EmptyState icon={ColumnChartIcon} title="No sign-ins in this period" description="Each sign-in attempt is counted here on the day it happens." />
                : (
                  <LazyMount minHeight={CHART_HEIGHT.standard}>
                    <BarChart label="Sign-ins per day" hideLegend format={formatNumber}
                      categories={days.map((x) => formatDate(appDayStart(x.date)))}
                      series={series.map((s, i) => ({ ...s, values: days.map((x) => (i === 0 ? x.success : x.failed)) }))} />
                  </LazyMount>
                )}
            </Reveal>
          </Panel>
          <Panel title="In this period" bodyClassName="grid content-start gap-4 p-6">
            {!d ? <Skeleton className="h-36 w-full" /> : <>
              <p className="text-stat tabular">{formatNumber(signIns)}</p>
              <p className="text-body-sm text-fg-2">{audit ? "Sign-in attempts" : "Successful sign-ins"}</p>
              <p className="border-t border-line pt-4 text-body-sm text-fg-2">{formatNumber(days.reduce((n, x) => n + x.success, 0))} successful{audit && ` · ${formatNumber(days.reduce((n, x) => n + (x.failed ?? 0), 0))} failed`}</p>
              <p className="text-caption text-fg-3">Calendar days in {APP_TIME_ZONE_LABEL}. Active users and sessions are current snapshots.</p>
              {audit && <Button asChild variant="secondary" className="justify-self-start"><Link href={`/audit/auth?${new URLSearchParams(d.period?.start && d.period.end ? { start: d.period.start, end: d.period.end } : d.period ? { from: d.period.from, to: d.period.to } : days.length ? { from: days[0]!.date, to: days[days.length - 1]!.date } : {})}`}>Open sign-in log</Link></Button>}
            </>}
          </Panel>
          </div>

          {(d ? d.recent : audit) && (
            <Panel flush icon={LogIcon} title="Recent activity" description="The 5 newest changes"
              actions={<Button asChild variant="ghost" size="sm"><Link href="/audit/activity">View activity log</Link></Button>}>
              <DataTable label="Recent activity" rowHeight="identity" columns={RECENT} rows={d?.recent ?? []} rowKey={(r) => r.id} loading={!d} skeletonRows={5}
                empty={{ icon: LogIcon, title: "No activity yet", description: "Changes to users, roles and permissions appear here as they happen." }} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
