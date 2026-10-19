"use client";

import { CHART_HEIGHT, Sparkline, TimeSeriesChart } from "@starterkit/ui/charts";
import {
  ActionMenu, CategoryChip, CountBadge, LazyMount, Notice, Panel, StaleNote, StatTile, StatTiles, StatusLegend, TickMeter,
  TimeRangePicker, type RangeKey,
} from "@starterkit/ui/ds";
import { formatCompact, formatNumber } from "@starterkit/ui/lib/format";
import { HEALTH } from "@starterkit/ui/lib/status";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { ActivityIcon, DeniedIcon, GaugeIcon, LineChartIcon, SessionsIcon, UsersIcon } from "@starterkit/ui/ui/icons";
import dynamic from "next/dynamic";
import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { BYTES_PER_HOUR, REQUESTS_BY_SERVICE, SPARK } from "./fixtures";

/**
 * Everything under the first screen (tables, components, tokens) loads after hydration in its own chunk, so the /ds
 * route stays within the first-load budget (ui-standard §5: lazy load below the fold).
 */
const GallerySections = dynamic(() => import("./sections").then((m) => m.GallerySections), {
  ssr: false,
  loading: () => <div aria-busy="true" className="min-h-screen" />,
});

const LEGEND = (["healthy", "degraded", "down", "stopped", "unknown"] as const).map((h) => ({ health: h, label: HEALTH[h].label, description: HEALTH[h].description }));
const SERVICES = REQUESTS_BY_SERVICE.map((s, i) => ({ label: s.label, slot: (i + 1) as 1 | 2 | 3, total: s.points.reduce((a, [, v]) => a + v, 0) }));

/** The design system gallery: tokens, components, charts and states with fictional sample data. */
export function DesignGallery() {
  const [range, setRange] = useState<RangeKey>("24h");
  // "Replay" bumps the KPI values so the number tween can be seen.
  const [bump, setBump] = useState(0);
  const req = 1284 + bump * 96;
  return (
    <>
      <PageHeader title="Design system"
        description="Tokens, components, charts and states, with fictional sample data. This page is also the visual test baseline."
        actions={<>
          <TimeRangePicker value={range} onChange={setRange} />
          <StatusLegend items={LEGEND} />
          <Button variant="secondary" onClick={() => setBump((b) => b + 1)}><Icon icon={ActivityIcon} />Replay numbers</Button>
          <ActionMenu label="Gallery actions" actions={[{ id: "export", label: "Export sample" }, { id: "reset", label: "Reset sample", destructive: true }]} />
        </>} />

      <Notice tone="warn">Showing data from 14:02. The metrics source isn&apos;t responding, so values may be out of date.</Notice>

      <section aria-label="Headline numbers">
        <StatTiles>
          <StatTile icon={UsersIcon} label="Active users" value="19" unit="/ 24" progress={19 / 24}
            delta={{ text: "+3 vs 24 hours ago", direction: "up", good: null }} />
          <StatTile icon={SessionsIcon} label="Requests" value={formatNumber(req)} caption="Last 24 hours · vs previous 24 hours" tween={{ value: req, format: formatNumber }}
            delta={{ text: "+18% vs previous 24 hours", direction: "up", good: null }} trend={<Sparkline values={SPARK} height={28} />} />
          <StatTile icon={GaugeIcon} label="Data transferred" value="4.6" caption="Last 24 hours · vs previous 24 hours" unit="MB" tween={{ value: 4.6 + bump * 0.2, format: (v) => v.toFixed(1), total: 10 }}
            delta={{ text: "+9% vs previous 24 hours", direction: "up", good: "down" }} trend={<Sparkline values={SPARK.map((v) => v * 3.6)} height={28} />} />
          <StatTile icon={DeniedIcon} label="Failed requests" value="37" caption="Last 24 hours · vs previous 24 hours"
            delta={{ text: "−12% vs previous 24 hours", direction: "down", good: "down" }} trend={<Sparkline values={[42, 30, 38, 25, 41, 33, 28, 39, 26, 31, 35, 37]} height={28} />} />
        </StatTiles>
      </section>

      <div className="grid grid-cols-12 gap-gutter">
        <Panel icon={LineChartIcon} title="Requests by service" description="Line · 24 hours" className="col-span-12 xl:col-span-8"
          footnote={<StaleNote at={Date.UTC(2026, 9, 16, 7, 2)} source="Metrics" />}>
          <TimeSeriesChart label="Requests by service" series={REQUESTS_BY_SERVICE} format={formatNumber} />
        </Panel>
        <Panel icon={GaugeIcon} title="Quota" count={SERVICES.length} className="col-span-12 xl:col-span-4">
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">{SERVICES.map((m) => <CategoryChip key={m.label} label={m.label} slot={m.slot} />)}</div>
            <ul className="grid gap-2" aria-label="Requests per service">
              {SERVICES.map((m) => (
                <li key={m.label} className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="text-fg-2">{m.label}</span><CountBadge>{formatNumber(m.total)}</CountBadge>
                </li>
              ))}
            </ul>
            <TickMeter label="Monthly request quota" ratio={0.62} value="62%" threshold={0.8} />
            <TickMeter label="Storage quota" ratio={0.94} value="94%" threshold={0.9} />
          </div>
        </Panel>
        <Panel title="Bytes per hour" description="Area · single series" className="col-span-12 lg:col-span-6">
          <LazyMount minHeight={CHART_HEIGHT.standard}><TimeSeriesChart label="Bytes per hour" kind="area" series={BYTES_PER_HOUR} format={formatCompact} /></LazyMount>
        </Panel>
        <Panel title="Compact chart" description={`Height ${CHART_HEIGHT.compact} px`} className="col-span-12 lg:col-span-6">
          <LazyMount minHeight={CHART_HEIGHT.compact}><TimeSeriesChart label="Requests (compact)" series={REQUESTS_BY_SERVICE.slice(0, 1)} format={formatNumber} height={CHART_HEIGHT.compact} /></LazyMount>
        </Panel>
      </div>

      <GallerySections />
    </>
  );
}
