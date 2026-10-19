"use client";

import "./charts.css";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChartIcon } from "../ui/icons";
import { mergeSeries, type Point } from "../lib/chart-data";
import { type Annotation, annotationRows, markersVisible, thresholdRows, tooltipPeriod } from "../lib/chart-layout";
import { niceTicks, tickLabel, yTickWidth } from "../lib/chart-scale";
import { APP_TIME_ZONE_LABEL, APP_UTC_OFFSET_SEC, formatDateTimeLong, formatDate, formatTime } from "../lib/format";
import { foldSeries, timeAxis, timeTickKind } from "../lib/series";
import { EmptyState } from "../ds/states";
import { Annotations } from "./annotations";
import { ChartDefs, useChartId } from "./chart-defs";
import { ChartFrame } from "./chart-frame";
import { ChartTooltipBox } from "./chart-tooltip";
import { useSettled } from "./use-settled";
import { AXIS_TICK, BASELINE, CARD, CHART_HEIGHT, CROSSHAIR, DASH, GRID, LINE_WIDTH, MARGIN, seriesColor, TICK_GAP, X_AXIS_HEIGHT } from "./chart-theme";

type Props = {
  /**
   * `slot` = fixed 0-based colour slot for the entity (seriesSlots); without it, colours follow position.
   * `dashed` = projection / forecast (dashed 4 4, 1.5 px).
   */
  label: string; series: { label: string; points: Point[]; slot?: number; dashed?: boolean }[]; format: (v: number) => string;
  /** "area" applies to a single series (gradient fill); with more series it draws lines. */
  kind?: "line" | "area"; height?: number;
  /** "monotone" for continuous metrics (default), "linear" for counts (spec §6.4). */
  curve?: "monotone" | "linear";
  /** Horizontal thresholds in Degraded/Down marks with a right-aligned caption ("Warning 80%"). */
  thresholds?: { value: number; label: string; tone: "degraded" | "down" }[];
  /** Events (deploys, incidents) at a time in seconds; max 3 visible, the rest collapse into "+N" (spec §6.8). */
  annotations?: Annotation[];
  /** The page shows ChartLegend in the Panel header instead (spec §6.1). */
  hideLegend?: boolean;
};

/**
 * Line (≥ 1 series) or area (exactly 1 series). One y-axis, round ticks (WIB on x), dashed horizontal grid with a solid
 * baseline, 2 px strokes, hollow markers on ≤ 14 points, active point + dashed crosshair, dark tooltip. Mount: lines
 * draw (400 ms), areas fade (280 ms); Recharts' own animation is off.
 */
export function TimeSeriesChart({ label, series, format, kind = "line", height = CHART_HEIGHT.standard, curve = "monotone", thresholds = [], annotations = [], hideLegend }: Props) {
  const id = useChartId();
  const plot = useSettled();
  const s = foldSeries(series);
  const meta = new Map(series.map((x) => [x.label, x]));
  const keyed = s.map((x, i) => ({ key: `s${i}`, label: x.label, points: x.points, color: seriesColor(x.label, meta.get(x.label)?.slot ?? i), dashed: !!meta.get(x.label)?.dashed }));
  const rows = mergeSeries(keyed);
  if (rows.length === 0) return <EmptyState icon={LineChartIcon} title="No data in this time range" description="Data appears here when there's activity. Try a longer time range." />;
  const first = rows[0]!.t, last = rows[rows.length - 1]!.t;
  const axis = timeAxis(first, last);
  const xTicks = axis.ticks;
  // Labels follow the tick step: ≥ 1 day → date; otherwise time, and a WIB-midnight tick shows the date.
  const dateLabels = xTicks.length > 0 ? axis.step >= 86_400 : timeTickKind(first, last) === "date";
  const xTick = dateLabels
    ? (t: number) => formatDate(t * 1000)
    : (t: number) => ((t + APP_UTC_OFFSET_SEC) % 86_400 === 0 ? formatDate(t * 1000) : formatTime(t * 1000));
  const bucket = rows.length > 1 ? rows[1]!.t - rows[0]!.t : 0;
  const max = Math.max(0, ...rows.flatMap((r) => keyed.map((k) => (r[k.key] as number | undefined) ?? 0)), ...thresholds.map((t) => t.value));
  const ticks = niceTicks(max);
  const area = kind === "area" && keyed.length === 1;
  const markers = markersVisible(rows.length);
  const curveType = curve === "linear" ? "linear" : "monotone";

  return (
    <ChartFrame
      label={label}
      legend={hideLegend ? undefined : keyed.map((k) => ({ label: k.label, color: k.color, dashed: k.dashed }))}
      table={{
        columns: [`Time (${APP_TIME_ZONE_LABEL})`, ...keyed.map((k) => k.label)],
        rows: rows.map((r) => [formatDateTimeLong(r.t * 1000), ...keyed.map((k) => (r[k.key] == null ? "–" : format(r[k.key] as number)))]),
        notes: [...thresholdRows(thresholds, format), ...annotationRows(annotations, [first, last])],
      }}
    >
      <ChartDefs id={id} gradients={area ? [keyed[0]!.color] : []} />
      <div ref={plot} style={{ height }} className="min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={MARGIN} accessibilityLayer>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} strokeDasharray={DASH} />
            <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} ticks={xTicks.length > 0 ? xTicks : undefined} tickFormatter={xTick} height={X_AXIS_HEIGHT} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis ticks={ticks} domain={[0, ticks[ticks.length - 1]!]} tickFormatter={tickLabel} tick={AXIS_TICK} tickLine={false} axisLine={false} tickSize={0} tickMargin={TICK_GAP} width={yTickWidth(ticks.map(tickLabel), TICK_GAP)} />
            <ReferenceLine y={0} stroke={BASELINE} strokeWidth={1} />
            {thresholds.map((t) => (
              <ReferenceLine key={`${t.label}-${t.value}`} y={t.value} stroke={`var(--${t.tone}-mark)`} strokeWidth={1.5} strokeDasharray={DASH}
                label={{ value: t.label, position: "insideTopRight", fill: `var(--${t.tone}-ink)`, fontSize: 11 }} />
            ))}
            <Annotations events={annotations} domain={[first, last]} />
            <Tooltip
              cursor={{ stroke: CROSSHAIR, strokeWidth: 1, strokeDasharray: DASH }}
              offset={12}
              isAnimationActive={false}
              content={({ active, payload }) => active && payload?.length ? (
                <ChartTooltipBox
                  title={tooltipPeriod(Number(payload[0]?.payload?.t ?? 0), bucket)}
                  rows={keyed.map((k) => ({ name: k.label, color: k.color, value: payload[0]?.payload?.[k.key] == null ? "–" : format(Number(payload[0]?.payload?.[k.key])) }))}
                />
              ) : null}
            />
            {area && (
              <Area dataKey={keyed[0]!.key} name={keyed[0]!.label} type={curveType} stroke="none" fill={`url(#${id}-grad-0)`} fillOpacity={1}
                className="chart-fade" dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} tooltipType="none" />
            )}
            {keyed.map((k) => (
              <Line key={k.key} dataKey={k.key} name={k.label} type={curveType} stroke={k.color} strokeLinecap="round" strokeLinejoin="round"
                strokeWidth={k.dashed ? 1.5 : LINE_WIDTH} strokeDasharray={k.dashed ? DASH : undefined}
                className={k.dashed ? "chart-fade" : "chart-line"} pathLength={k.dashed ? undefined : 1}
                dot={markers ? { r: 4, fill: CARD, stroke: k.color, strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: k.color, stroke: CARD, strokeWidth: 3 }} connectNulls={false} isAnimationActive={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
