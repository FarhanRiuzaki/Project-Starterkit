"use client";

import "./charts.css";
import { cn } from "../lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { heatGrid, hourTickLabels } from "../lib/chart-layout";
import { seqStep } from "../lib/series";
import { ChartFrame } from "./chart-frame";

const STEP = ["bg-(--chart-seq-1)", "bg-(--chart-seq-2)", "bg-(--chart-seq-3)", "bg-(--chart-seq-4)", "bg-(--chart-seq-5)", "bg-(--chart-seq-6)", "bg-(--chart-seq-7)", "bg-(--chart-seq-8)"];

/** 8-step ramp strip with min/max labels (spec §6.6). */
function Ramp({ min, max }: { min: string; max: string }) {
  return (
    <div className="flex items-center gap-1.5 text-caption tabular text-fg-3">
      <span>{min}</span>
      <span className="flex gap-0.5" aria-hidden="true">{STEP.map((c) => <span key={c} className={cn("chart-ramp-step h-2 w-3", c)} />)}</span>
      <span>{max}</span>
    </div>
  );
}

/**
 * One tile per entity (ratio 0..1), sequential blue ramp (spec §6.6): radius 3, 3 px gap, empty = `--inset`, hover
 * ring 2 px fg. With `onSelect` each tile is a button with a tooltip.
 */
export function Heatmap({ label, cells, onSelect }: { label: string; cells: { id: string; label: string; value: number | null; valueText: string }[]; onSelect?: (id: string) => void }) {
  return (
    <div className="grid gap-3">
      <div role="list" aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-0.75">
        {cells.map((c) => {
          const s = seqStep(c.value);
          // No data: inset + dashed edge, so "no data" never reads as a low value by colour alone.
          const tile = cn("chart-cell aspect-square", s < 0 ? "border border-dashed border-line-strong bg-inset" : STEP[s]);
          const name = `${c.label}, ${c.valueText}`;
          if (!onSelect) return <div key={c.id} role="listitem"><span role="img" aria-label={name} title={name} className={cn("block", tile)} /></div>;
          return (
            <div key={c.id} role="listitem">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => onSelect(c.id)} aria-label={name} className={cn("block w-full cursor-pointer", tile)} />
                </TooltipTrigger>
                <TooltipContent><span className="font-mono">{c.label}</span> · {c.valueText}</TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
      <Ramp min="0%" max="100%" />
    </div>
  );
}

/**
 * Matrix heatmap (spec §6.6: hour × entity, hour × weekday): 14 × 14 px cells, 3 px gap, radius 3,
 * 8-step ramp relative to the grid max (empty = `--inset`), mono caption row labels, column ticks every 3 h, hover ring,
 * legend ramp with min/max. Cells carry a native title; the table view is the accessible path.
 * - `max` pins the scale end (CPU: 1 = 100 %), so the ramp and its max label don't move with the data.
 * - `fluid`: columns share the panel width (cells stay 14 px tall, at least 14 px wide) instead of a fixed 14 px grid.
 */
export function HeatGrid({ label, rows, columns, values, format, unit = "", max: pinnedMax, fluid }: {
  label: string; rows: string[]; columns?: string[]; values: (number | null)[][]; format: (v: number) => string; unit?: string;
  max?: number; fluid?: boolean;
}) {
  const cols = columns ?? Array.from({ length: values[0]?.length ?? 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
  const ticks = columns ? cols.map((c, i) => (i % 3 === 0 ? c : "")) : hourTickLabels(cols.length);
  const { max, levels } = heatGrid(values, 8, pinnedMax);
  const suffix = unit ? ` ${unit}` : "";
  return (
    <ChartFrame label={label} table={{ columns: ["", ...cols], rows: rows.map((r, i) => [r, ...cols.map((_, j) => { const v = values[i]?.[j]; return v == null ? "–" : format(v); })]) }}>
      <div className="grid gap-3">
        <div className="scroll-quiet overflow-x-auto">
          <div role="img" aria-label={`${label}. Use the table view for values.`} className={cn("grid gap-0.75", fluid ? "w-full" : "w-max")}
            style={{ gridTemplateColumns: fluid ? `minmax(auto, 12rem) repeat(${cols.length}, minmax(14px, 1fr))` : `auto repeat(${cols.length}, 14px)` }}>
            <span />
            {ticks.map((t, j) => <span key={j} className={cn("text-caption tabular text-fg-3", fluid ? "text-left whitespace-nowrap" : "text-center")}>{t}</span>)}
            {rows.map((r, i) => [
              <span key={`l${i}`} className="truncate pr-2 font-mono text-caption leading-3.5 text-fg-3" title={r}>{r}</span>,
              ...cols.map((c, j) => {
                const lv = levels[i]?.[j] ?? -1, v = values[i]?.[j];
                return <span key={`${i}-${j}`} title={`${r} · ${c} · ${v == null ? "–" : format(v)}${suffix}`} className={cn("chart-cell", fluid ? "h-3.5 w-full" : "size-3.5", lv < 0 ? "bg-inset" : STEP[lv])} />;
              }),
            ])}
          </div>
        </div>
        <Ramp min={format(0)} max={`${format(max)}${suffix}`} />
      </div>
    </ChartFrame>
  );
}
