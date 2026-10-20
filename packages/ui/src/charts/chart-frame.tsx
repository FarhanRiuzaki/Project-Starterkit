"use client";

import { type ReactNode, useState } from "react";
import { Segmented } from "../ds/segmented";

/**
 * `kind` is kept for v2 callers; v3 draws every key as an 8 px dot (spec §6.1). `striped` = secondary/partial,
 * `dashed` = projection (a dashed 12 px stroke instead of the dot, matching the line).
 */
export type LegendItem = { label: string; color: string; kind?: "line" | "box"; striped?: boolean; dashed?: boolean };

function Swatch({ item }: { item: LegendItem }) {
  if (item.dashed) return <span aria-hidden="true" className="w-3 shrink-0 border-t-2 border-dashed" style={{ borderColor: item.color }} />;
  return <span aria-hidden="true" className={item.striped ? "chart-stripes size-2 shrink-0 rounded-xs" : "size-2 shrink-0 rounded-xs"} style={{ backgroundColor: item.color }} />;
}

/** Legend: `dot 8 px + label` (body-sm fg-2). Shown only for ≥ 2 series; colour is never the only cue (names). */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-fg-2">
      {items.map((l) => (
        <li key={l.label} className="inline-flex max-w-48 items-center gap-1.5" title={l.label}>
          <Swatch item={l} />
          <span className="truncate">{l.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Chart toolbar row (legend right, before the Chart/Table toggle) + the plot or its table view. The table is the
 * accessible path for every chart (UI standard §4); `table.notes` carries what the plot shows besides series values
 * (thresholds, annotations). Charts pass `legend` undefined when the page shows ChartLegend in the Panel header.
 * `fill`: the figure grows in a flex-column card and the plot row takes the rest of the height.
 */
export function ChartFrame({ label, legend, table, children, fill }: {
  label: string; legend?: LegendItem[]; table: { columns: string[]; rows: (string | number)[][]; notes?: string[] }; children: ReactNode; fill?: boolean;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    // grid-cols-1 = minmax(0, 1fr): an implicit `auto` track keeps the plot's last measured SVG width as its minimum,
    // so a chart measured before the scrollbar appeared overflowed its panel and never shrank back.
    <figure className={fill ? "m-0 grid min-w-0 flex-1 grid-cols-1 grid-rows-[auto_1fr] gap-3" : "m-0 grid min-w-0 grid-cols-1 gap-3"} aria-label={label}>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {legend && <ChartLegend items={legend} />}
        <Segmented label={`Show ${label} as`} value={view} onChange={setView} options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]} />
      </div>
      {view === "chart" ? children : (
        // Long tables scroll inside the box: a tab stop so keyboard users can scroll it (axe scrollable-region-focusable).
        <div tabIndex={0} role="region" aria-label={`${label}, table`}
          className="scroll-quiet max-h-80 overflow-auto rounded-lg border border-line outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <table className="w-full border-separate border-spacing-0 text-body-sm">
            <caption className="sr-only">{label}</caption>
            <thead className="sticky top-0 bg-tray"><tr>{table.columns.map((c) => <th key={c} scope="col" className="h-8 border-b border-line px-3 text-left text-label text-fg-3">{c}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="h-8 border-b border-line px-3 tabular text-fg">{v}</td>)}</tr>)}</tbody>
          </table>
          {table.notes && table.notes.length > 0 && (
            <ul className="grid gap-1 px-3 py-2 text-caption text-fg-3">{table.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          )}
        </div>
      )}
    </figure>
  );
}
