"use client";

import dynamic from "next/dynamic";
import { type ComponentProps, createContext, useContext } from "react";
import { Skeleton } from "../ui/skeleton";
import { CHART_HEIGHT } from "./chart-theme";
import type { BarChart as BarChartImpl } from "./bar-chart";
import type { TimeSeriesChart as TimeSeriesChartImpl } from "./time-series-chart";

/**
 * recharts (~100 kB gz) loads only when a chart renders: client-only (`ssr: false` — ResponsiveContainer has no size
 * on the server anyway) with a Skeleton in the chart's final shape (ChartFrame toolbar row + plot at its height).
 */
const Height = createContext<number>(CHART_HEIGHT.standard);

function ChartSkeleton() {
  const height = useContext(Height);
  return (
    <div className="grid min-w-0 gap-3" aria-busy="true">
      <div className="flex h-8 justify-end"><Skeleton className="h-8 w-36 rounded-md" /></div>
      <Skeleton className="w-full rounded-md" style={{ height }} />
    </div>
  );
}

const TimeSeries = dynamic(() => import("./time-series-chart").then((m) => m.TimeSeriesChart), { ssr: false, loading: ChartSkeleton });
const Bars = dynamic(() => import("./bar-chart").then((m) => m.BarChart), { ssr: false, loading: ChartSkeleton });

export function TimeSeriesChart(props: ComponentProps<typeof TimeSeriesChartImpl>) {
  return <Height.Provider value={props.height ?? CHART_HEIGHT.standard}><TimeSeries {...props} /></Height.Provider>;
}

export function BarChart(props: ComponentProps<typeof BarChartImpl>) {
  return <Height.Provider value={props.height ?? CHART_HEIGHT.standard}><Bars {...props} /></Height.Provider>;
}
