"use client";

import "./charts.css";
import { type RefObject, useEffect, useRef } from "react";
import { Bar, BarChart as RBarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, useActiveTooltipDataPoints, useIsTooltipActive, XAxis, YAxis } from "recharts";
import { ColumnChartIcon } from "../ui/icons";
import { barDelay } from "../motion/tokens";
import { barPath, barRadius, barWidth, maxIndex } from "../lib/chart-layout";
import { niceTicks, tickLabel, yTickWidth } from "../lib/chart-scale";
import { ellipsize, foldBarSeries, stackTopKey } from "../lib/series";
import { EmptyState } from "../ds/states";
import { ChartDefs, useChartId } from "./chart-defs";
import { ChartFrame } from "./chart-frame";
import { ChartTooltipBox } from "./chart-tooltip";
import { useSettled } from "./use-settled";
import { AXIS_TICK, BASELINE, CHART_HEIGHT, DASH, DOWN_COLOR, GRID, MARGIN, type SeriesTone, seriesColor, softColor, TICK_GAP, X_AXIS_HEIGHT } from "./chart-theme";

type Row = { c: string; i: number } & Record<string, string | number | null>;
const val = (r: Row | undefined, k: string): number | null => (r && typeof r[k] === "number" ? (r[k] as number) : null);
type Props = {
  /**
   * `slot` = the entity's fixed 0-based colour slot (seriesSlots); without it, colours follow position.
   * `striped` = secondary / partial series: same hue at 35 % with the stripe texture (spec §6.3).
   * `tone: "down"` = a failure count: Down mark colour instead of a palette slot.
   */
  label: string; categories: string[]; series: { label: string; values: (number | null)[]; slot?: number; striped?: boolean; tone?: SeriesTone }[];
  stacked?: boolean; format: (v: number) => string; height?: number;
  /** The page shows ChartLegend in the Panel header instead (spec §6.1). */
  hideLegend?: boolean;
};
type ShapeProps = { x?: number; y?: number; width?: number; height?: number; index?: number; payload?: Row; stackedBarStart?: number; background?: { y?: number | null; height?: number | null } };

/**
 * Marks the active band (hover or keyboard, via the tooltip state) on the bars' DOM rather than in state: a re-render
 * of the chart remounts every bar (Recharts keys them on its props' identity; see useSettled), so hovering stays a
 * class change. For the same reason Recharts' own `activeBar` is not used.
 */
function ActiveBand({ host }: { host: RefObject<HTMLDivElement | null> }) {
  const on = useIsTooltipActive();
  // The active data point carries its row index, so duplicate category labels still resolve to the right band.
  const point = useActiveTooltipDataPoints<Row>()?.[0];
  const i = on && point != null && typeof point.i === "number" ? point.i : null;
  useEffect(() => {
    for (const el of host.current?.querySelectorAll<SVGGElement>(".chart-bar") ?? []) {
      if (i != null && el.dataset.i === String(i)) el.dataset.active = "true";
      else delete el.dataset.active;
    }
  }, [i, host]);
  return null;
}

/**
 * Columns (spec §6.3): 72 % of the band, 6–32 px wide, value end radius min(6, w/4), baseline end 2 px; stacks round
 * only the top segment and keep a 2 px gap between segments; grouped bars 2 px apart. Hovered band stays, the rest
 * drop to 40 %. Direct label on the max bar only. Mount: grow from the baseline, 12 ms stagger (cap 200 ms).
 */
export function BarChart({ label, categories, series, stacked, format, height = CHART_HEIGHT.standard, hideLegend }: Props) {
  const id = useChartId();
  const host = useRef<HTMLDivElement>(null);
  const plot = useSettled(host);
  const meta = new Map(series.map((x) => [x.label, x]));
  const s = foldBarSeries(series).map((x, i) => {
    const m = meta.get(x.label);
    const color = m?.tone === "down" ? DOWN_COLOR : seriesColor(x.label, m?.slot ?? i);
    const striped = !!m?.striped;
    return { ...x, key: `s${i}`, color, striped, fill: striped ? softColor(color) : color };
  });
  const rows: Row[] = categories.map((c, i) => ({ c, i, ...Object.fromEntries(s.map((x) => [x.key, x.values[i] ?? null])) }));
  const totals = rows.map((r) => s.reduce((a, x) => (stacked ? a + (val(r, x.key) ?? 0) : Math.max(a, val(r, x.key) ?? 0)), 0));
  if (categories.length === 0) return <EmptyState icon={ColumnChartIcon} title="No data in this time range" description="Data appears here when there's activity. Try a longer time range." />;
  const keys = s.map((x) => x.key);
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1]!;
  const yWidth = yTickWidth(ticks.map(tickLabel), TICK_GAP);
  // Direct label: the tallest bar (stack total, or the largest single bar when grouped).
  const peak = maxIndex(totals);
  const peakKey = peak < 0 ? null : stacked ? stackTopKey(rows[peak]! as Record<string, number | null>, keys)
    : s.reduce<string | null>((best, x) => (best == null || (val(rows[peak], x.key) ?? 0) > (val(rows[peak], best) ?? 0) ? x.key : best), null);

  const shape = (x: (typeof s)[number]) => function BarShape(p: ShapeProps) {
    const i = p.index ?? 0, r = p.payload;
    const v = val(r, x.key);
    if (v == null || v <= 0 || p.width == null || p.height == null || p.x == null || p.y == null) return <g />;
    // The slot is the bar Recharts laid out (72 % band, split per group): the 6 px minimum never grows past it.
    const { x: bx, width: w } = barWidth(p.x, p.width, p.width);
    const isTop = !stacked || (r != null && stackTopKey(r as Record<string, number | null>, keys) === x.key);
    const isBottom = !stacked || (r != null && keys.find((k) => (val(r, k) ?? 0) > 0) === x.key);
    // Stacks: a 2 px card-coloured gap under every segment except the bottom one.
    const h = isBottom ? p.height : Math.max(0, p.height - 2);
    const d = barPath(bx, p.y, w, h, isTop ? barRadius(w) : 0, isBottom ? 2 : 0);
    // Grow from the chart's zero baseline (stackedBarStart = y-scale(0) for the whole stack), not the segment bottom.
    const base = Number.isFinite(p.stackedBarStart) ? p.stackedBarStart!
      : p.background?.y != null && p.background.height != null ? p.background.y + p.background.height : p.y + p.height;
    const motion = { transformBox: "view-box", transformOrigin: `0px ${base}px`, animationDelay: `${barDelay(i)}s` } as const;
    return (
      <g className="chart-bar" data-i={i}>
        <path d={d} fill={x.fill} className="chart-grow" style={motion} />
        {x.striped && <path d={d} fill={`url(#${id}-stripes)`} className="chart-grow" style={motion} />}
        {i === peak && x.key === peakKey && (
          <text x={bx + w / 2} y={p.y - 6} textAnchor="middle" className="chart-fade fill-fg text-label tabular">{format(totals[i]!)}</text>
        )}
      </g>
    );
  };

  return (
    <ChartFrame
      label={label}
      legend={hideLegend ? undefined : s.map((x) => ({ label: x.label, color: x.fill, striped: x.striped }))}
      table={{ columns: ["Category", ...s.map((x) => x.label)], rows: rows.map((r, i) => [categories[i]!, ...s.map((x) => { const v = val(r, x.key); return v == null ? "–" : format(v); })]) }}
    >
      <ChartDefs id={id} />
      <div ref={plot} style={{ height }} className="chart-bars min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart data={rows} margin={{ ...MARGIN, top: MARGIN.top + 16 }} barCategoryGap="28%" barGap={2} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} strokeDasharray={DASH} />
            <XAxis dataKey="c" height={X_AXIS_HEIGHT} tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} tickFormatter={(v: string) => ellipsize(String(v), 16)} />
            <YAxis ticks={ticks} domain={[0, top]} tickFormatter={tickLabel} tick={AXIS_TICK} tickLine={false} axisLine={false} tickSize={0} tickMargin={TICK_GAP} width={yWidth} />
            <ReferenceLine y={0} stroke={BASELINE} strokeWidth={1} />
            <ActiveBand host={host} />
            <Tooltip
              cursor={false}
              offset={12}
              isAnimationActive={false}
              content={({ active, payload }) => active && payload?.length ? (
                <ChartTooltipBox title={categories[Number(payload[0]?.payload?.i)] ?? ""} rows={s.map((x) => { const v = payload[0]?.payload?.[x.key]; return { name: x.label, color: x.fill, striped: x.striped, value: v == null ? "–" : format(Number(v)) }; })} />
              ) : null}
            />
            {s.map((x) => (
              <Bar key={x.key} dataKey={x.key} name={x.label} stackId={stacked ? "a" : undefined} fill={x.fill} maxBarSize={32}
                shape={shape(x)} isAnimationActive={false} />
            ))}
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

