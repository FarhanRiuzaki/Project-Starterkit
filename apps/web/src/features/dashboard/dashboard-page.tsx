"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BarChart, CHART_HEIGHT, ChartLegend, legendItems } from "@starterkit/ui/charts";
import { Avatar, type Column, DataTable, EmptyState, ErrorState, LazyMount, Notice, Panel, RelativeTime, StatTile, StatTiles, StatTileSkeletons, Truncate } from "@starterkit/ui/ds";
import { Reveal } from "@starterkit/ui/motion";
import { APP_TIME_ZONE_LABEL, appDayStart, formatDate, formatNumber } from "@starterkit/ui/lib/format";
import { Button } from "@starterkit/ui/ui/button";
import { Skeleton } from "@starterkit/ui/ui/skeleton";
import { ColumnChartIcon, FailedIcon, IdentityIcon, LogIcon, SessionsIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import { PageHeader } from "@/components/shell/page-header";
import { api, errorText } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { actionLabel } from "@starterkit/shared/audit";
import type { ActivityDto } from "@starterkit/shared/contracts/audit";
import type { DashboardDto } from "@starterkit/shared/contracts/dashboard";
import { DASHBOARD_KEY } from "@/lib/shared/queries";

const SERIES = [{ label: "Successful" }, { label: "Failed", tone: "down" as const }];

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
  const q = useQuery({ queryKey: DASHBOARD_KEY, queryFn: () => api<DashboardDto>("/api/dashboard") });
  // What the server will send follows audit.view, so the loading shape matches the loaded one (no layout shift).
  const audit = useAuth().can("audit.view");
  const d = q.data;
  const days = d?.loginsPerDay ?? [];
  const signIns = days.reduce((n, x) => n + x.success + (x.failed ?? 0), 0);
  const series = audit ? SERIES : SERIES.slice(0, 1);
  const tile = (n: number) => ({ value: formatNumber(n), tween: { value: n, format: formatNumber } });

  return (
    <div className="grid gap-section">
      <PageHeader title="Dashboard" description="Users, sessions and sign-ins across the app, as of when you opened this page." />
      {q.error && d && <Notice tone="warn" live>Couldn&apos;t refresh the dashboard; showing the numbers loaded before. {errorText(q.error)}</Notice>}

      {q.error && !d ? (
        <Panel><ErrorState title="Couldn't load the dashboard" cause={errorText(q.error)} onRetry={() => void q.refetch()} /></Panel>
      ) : (
        <>
          <Reveal loading={!d} skeleton={<StatTiles><StatTileSkeletons count={audit ? 4 : 3} /></StatTiles>}>
            {d && (
              <StatTiles>
                <StatTile icon={UsersIcon} label="Active users" {...tile(d.activeUsers)} caption="Accounts that can sign in" />
                <StatTile icon={IdentityIcon} label="New users" {...tile(d.newUsers7d)} caption="Last 7 days" />
                {d.failedLogins24h !== null && <StatTile icon={FailedIcon} label="Failed sign-ins" {...tile(d.failedLogins24h)} caption="Last 24 hours" />}
                <StatTile icon={SessionsIcon} label="Active sessions" {...tile(d.activeSessions)} caption="Signed in now" />
              </StatTiles>
            )}
          </Reveal>

          <Panel icon={ColumnChartIcon} title="Sign-ins per day" description={`Last 14 days · per day, ${APP_TIME_ZONE_LABEL}`}
            actions={<ChartLegend items={legendItems(series)} />}>
            <Reveal loading={!d} skeleton={<Skeleton className="w-full rounded-md" style={{ height: CHART_HEIGHT.standard }} />}>
              {signIns === 0 ? <EmptyState icon={ColumnChartIcon} title="No sign-ins in the last 14 days" description="Each sign-in attempt is counted here on the day it happens." />
                : (
                  <LazyMount minHeight={CHART_HEIGHT.standard}>
                    <BarChart label="Sign-ins per day" hideLegend format={formatNumber}
                      categories={days.map((x) => formatDate(appDayStart(x.date)))}
                      series={series.map((s, i) => ({ ...s, values: days.map((x) => (i === 0 ? x.success : x.failed)) }))} />
                  </LazyMount>
                )}
            </Reveal>
          </Panel>

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
