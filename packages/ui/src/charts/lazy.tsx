"use client";

import { type ComponentProps, type ComponentType, useEffect, useState } from "react";
import { Reveal } from "../motion/reveal";
import { Skeleton } from "../ui/skeleton";
import { CHART_HEIGHT } from "./chart-theme";
import type { BarChart as BarChartImpl } from "./bar-chart";
import type { TimeSeriesChart as TimeSeriesChartImpl } from "./time-series-chart";

/**
 * recharts (~100 kB gz) loads only when a chart renders, client-only (ResponsiveContainer has no size on the server
 * anyway). Until its chunk is in, a Reveal holds a Skeleton in the chart's final shape (ChartFrame toolbar row + plot
 * at its height): hidden for a fast chunk, never a flash (useDelayedFlag). Once loaded, later charts render at once.
 */
function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex h-8 justify-end"><Skeleton className="h-8 w-36 rounded-md" /></div>
      <Skeleton className="w-full rounded-md" style={{ height }} />
    </div>
  );
}

function lazyChart<P extends { height?: number }>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | null = null;
  return function LazyChart(props: P) {
    const [Chart, setChart] = useState<ComponentType<P> | null>(() => loaded);
    useEffect(() => {
      if (Chart) return;
      let live = true;
      // ponytail: a blocked chunk leaves the skeleton up; add a retry or an error state if that shows up in practice.
      void load().then((c) => { loaded = c; if (live) setChart(() => c); }, () => undefined);
      return () => { live = false; };
    }, [Chart]);
    return (
      <Reveal loading={!Chart} skeleton={<ChartSkeleton height={props.height ?? CHART_HEIGHT.standard} />}>
        {Chart && <Chart {...props} />}
      </Reveal>
    );
  };
}

export const TimeSeriesChart = lazyChart<ComponentProps<typeof TimeSeriesChartImpl>>(() => import("./time-series-chart").then((m) => m.TimeSeriesChart));
export const BarChart = lazyChart<ComponentProps<typeof BarChartImpl>>(() => import("./bar-chart").then((m) => m.BarChart));
