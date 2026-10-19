"use client";

import "./charts.css";
import { PieChartIcon } from "../ui/icons";
import { distribution, shareLabel, splitUnit } from "../lib/chart-layout";
import { EmptyState } from "../ds/states";
import { ChartFrame } from "./chart-frame";
import { CHART_HEIGHT, colorAt, OTHER_COLOR } from "./chart-theme";

type Part = { label: string; value: number; slot?: number };

/** "2.02M" → 2.02 in fg, "M" in fg-3 (spec §6.5: value with minor digits fg-3). */
function SplitValue({ text, className }: { text: string; className?: string }) {
  const { lead, major, minor } = splitUnit(text);
  return (
    <span className={className}>
      {lead && <span className="text-fg-3">{lead}</span>}{major}{minor && <span className="text-body font-normal text-fg-3">{minor}</span>}
    </span>
  );
}

type Empty = { title: string; description: string };
const NO_DATA: Empty = { title: "No data in this time range", description: "Data appears here when there's activity. Try a longer time range." };

/**
 * Part-of-whole (spec §6.5, preferred over a donut): an 8 px full-width bar of striped segments in slot order with 4 px
 * gaps, then a tray of legend cards (dot + name, value `stat-sm` with minor digits fg-3, share pill). More than
 * `max` parts fold the smallest into "Other" (neutral). `slot` = fixed 0-based colour slot of the entity.
 * - `layout="cards"` (default): a 2-column grid of cards, for a wide panel.
 * - `layout="list"`: one full-width row per part, stacked, for the 4-column companion of a chart; `fill` stretches the
 *   rows so the tray is at least as tall as a standard chart and grows with the card (no empty band in an 8 + 4 row;
 *   the Panel passes `bodyClassName="flex flex-col"`).
 * `columns` names the table view's first two columns (default Name / Value).
 */
export function DistributionBar({ label, parts, format, max = 4, layout = "cards", fill, columns = ["Name", "Value"], empty = NO_DATA }: {
  label: string; parts: Part[]; format: (v: number) => string; max?: number; layout?: "cards" | "list"; fill?: boolean;
  columns?: readonly [string, string]; empty?: Empty;
}) {
  const d = distribution(parts, max);
  if (d.parts.length === 0) return <EmptyState icon={PieChartIcon} title={empty.title} description={empty.description} />;
  const color = (slot: number | null) => (slot == null ? OTHER_COLOR : colorAt(slot));
  const dot = (slot: number | null) => <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color(slot) }} />;
  const share = (p: (typeof d.parts)[number]) => (
    <span className="ml-auto inline-flex h-4.5 min-w-11 shrink-0 items-center justify-center rounded-full border border-line bg-tray px-1.5 text-label tabular text-fg-2">{shareLabel(p)}</span>
  );
  return (
    <ChartFrame label={label} fill={layout === "list" && fill} table={{ columns: [...columns, "Share"], rows: d.parts.map((p) => [p.label, format(p.value), shareLabel(p)]) }}>
      <div className={layout === "list" ? "flex h-full flex-col gap-3" : "grid gap-3"}>
        <div className="flex h-2 gap-1" aria-hidden="true">
          {d.parts.map((p, i) => (
            <span key={p.slot ?? `other-${i}`} className="chart-stripes chart-fade h-full min-w-1 rounded-full" style={{ flexGrow: p.share, flexBasis: 0, backgroundColor: color(p.slot) }} />
          ))}
        </div>
        {layout === "list" ? (
          <ul className="chart-well flex flex-1 flex-col gap-1 bg-tray p-1" style={fill ? { minHeight: CHART_HEIGHT.standard - 20 } : undefined}>
            {d.parts.map((p, i) => (
              <li key={p.slot ?? `other-${i}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg border border-line bg-card px-3">
                {dot(p.slot)}
                <span className="min-w-0 flex-1 truncate text-body-sm text-fg-2" title={p.label}>{p.label}</span>
                <SplitValue text={format(p.value)} className="text-stat-sm tabular text-fg" />
                {share(p)}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="chart-well grid gap-1 bg-tray p-1" style={{ gridTemplateColumns: `repeat(${Math.min(d.parts.length, 2)}, minmax(0, 1fr))` }}>
            {d.parts.map((p, i) => (
              <li key={p.slot ?? `other-${i}`} className="grid min-w-0 gap-1 rounded-lg border border-line bg-card p-3">
                <span className="flex min-w-0 items-center gap-1.5 text-body-sm text-fg-2">
                  {dot(p.slot)}
                  <span className="truncate" title={p.label}>{p.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  <SplitValue text={format(p.value)} className="text-stat-sm tabular text-fg" />
                  {share(p)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ChartFrame>
  );
}

const MODEL_COLUMNS = ["Model", "Requests"] as const;
const MODEL_EMPTY: Empty = { title: "No requests in this time range", description: "Requests appear here when developers use AI. Try a longer time range." };

/** Share of requests by model: the list layout with model copy. */
export function ModelShare({ label = "Share of AI requests by model", parts, format, fill }: { label?: string; parts: Part[]; format: (v: number) => string; fill?: boolean }) {
  return <DistributionBar label={label} parts={parts} format={format} layout="list" fill={fill} columns={MODEL_COLUMNS} empty={MODEL_EMPTY} />;
}
