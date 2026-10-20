"use client";

import "./charts.css";
import { RankedListIcon } from "../ui/icons";
import { barDelay } from "../motion/tokens";
import { EmptyState } from "../ds/states";
import { Truncate } from "../ds/truncate";
import { ChartFrame } from "./chart-frame";

/** Categorical slot (1-based) → bar class (static strings so Tailwind sees them). */
const SLOT_BG = { 1: "bg-chart-1", 2: "bg-chart-2", 3: "bg-chart-3", 4: "bg-chart-4", 5: "bg-chart-5", 6: "bg-chart-6" } as const;

/**
 * Top-N horizontal bars (spec §6.3): 20 px rows, 8 px bars (radius full) on an `--inset` track, label left (body-sm fg),
 * value right (body-sm tabular), sorted descending, max 8 rows.
 * `slot` = the entity's fixed categorical colour (same slot as the entity has in the stacked chart).
 */
export function HBarChart({ label, items, format, max = 8, slot = 1 }: {
  label: string; items: { label: string; value: number }[]; format: (v: number) => string; max?: number; slot?: keyof typeof SLOT_BG;
}) {
  const data = [...items].filter((i) => Number.isFinite(i.value) && i.value >= 0).sort((a, b) => b.value - a.value).slice(0, max);
  if (data.length === 0) return <EmptyState icon={RankedListIcon} title="No data in this time range" description="Data appears here when there's activity. Try a longer time range." />;
  const top = data[0]!.value || 1;
  return (
    <ChartFrame label={label} table={{ columns: ["Name", "Value"], rows: data.map((d) => [d.label, format(d.value)]) }}>
      <ul className="grid gap-2">
        {data.map((d, i) => (
          <li key={d.label} className="grid h-5 grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-3 text-body-sm">
            <span className="min-w-0 text-fg"><Truncate title={d.label}>{d.label}</Truncate></span>
            <span className="h-2 min-w-0 overflow-hidden rounded-full bg-inset" aria-hidden="true">
              <span className={`chart-hbar chart-stripes block h-full rounded-full ${SLOT_BG[slot]}`} style={{ width: `${Math.max(1, (d.value / top) * 100)}%`, animationDelay: `${barDelay(i)}s` }} />
            </span>
            <span className="min-w-12 text-right font-medium tabular text-fg">{format(d.value)}</span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
