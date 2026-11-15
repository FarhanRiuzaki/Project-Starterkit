"use client";

import "./charts.css";
import type { ReactNode } from "react";
import { DataRegion } from "../ds/data-region";
import { Panel } from "../ds/panel";
import { Truncate } from "../ds/truncate";
import { type BreakdownPart, breakdown, rowLimit } from "../lib/breakdown";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { NumberTween, Reveal, Stagger, useNewKeys } from "../motion";
import type { IconData } from "../ui/icon";
import { PieChartIcon } from "../ui/icons";
import { Skeleton } from "../ui/skeleton";
import { colorAt, OTHER_COLOR } from "./chart-theme";

const ROW = "flex h-8 min-w-0 items-center gap-2.5";

/** The content's shape: total (32), bar (8), `rows` rows of 32, at the gaps of the loaded card, so nothing shifts. */
function BreakdownSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-3">
      <div className="flex h-8 items-center"><Skeleton className="h-7 w-1/3" /></div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={ROW}>
            <Skeleton className="size-2 shrink-0 rounded-full" />
            <Skeleton className="h-2.5 w-2/5" />
            <Skeleton className="ml-auto h-2.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * What makes up a number: a Panel with the total, one stacked share bar and the parts as ranked rows (label, value,
 * share), largest first; parts past `max` rows fold into one last row labelled `otherLabel` (lib/breakdown.ts).
 * - Colour: the six chart slots by `slot` (else input position), so a part keeps its colour when it changes rank and
 *   no two named rows share one (lib/breakdown.ts); the folded row is neutral. The bar is decorative (aria-hidden): every part is a list row with its label, value and
 *   share as text. A label that doesn't fit is cut on one line and gets a tooltip and a tab stop (`Truncate`).
 * - States (`state`, as `DataRegion`): `loading` = the content's shape through `Reveal` (hidden for the first 150 ms,
 *   then at least 300 ms); `empty` = the caller's copy, also when `data`/`stale` has no part above zero; `error` =
 *   alert with `error` as the cause and "Try again" when `onRetry` is given; `stale` = a notice (`error` as its text)
 *   over the kept content. Pass `stale` or `data` while refetching: `loading` is for no data yet and replaces the rows.
 * - Motion: the bar sweeps in once (`chart-hbar`); a changed total counts (`NumberTween`); rows that trade places
 *   glide (`Stagger reorder`, once the deferred layer is in); a part that arrives after the first data gets the
 *   new-row wash (`useNewKeys` over every part, so one that only leaves the fold gets none). A refetch replays nothing: rows and segments are keyed by part. Segments resize at
 *   once (no width animation, §8). Reduced motion: no sweep, no count, no glide, no wash.
 * Needs a `TooltipProvider` above it (the app shell has one).
 */
export function BreakdownCard({ title, parts, otherLabel, empty, state = "data", format = formatNumber, max = 5, unit, description, icon, actions, footnote, error, onRetry, className }: {
  title: string; parts: readonly BreakdownPart[];
  /** Label of the row that sums the parts past `max`. */
  otherLabel: string;
  empty: { title: string; description: string; icon?: IconData };
  state?: "loading" | "empty" | "error" | "stale" | "data";
  /** Formats the total and each value (a `format.ts` function). Default `formatNumber`. */
  format?: (v: number) => string;
  /** Most rows shown, the folded one included: 2…6. Also the row count of the loading shape. */
  max?: number;
  /** After the total, muted: "users". */
  unit?: string;
  description?: ReactNode; icon?: IconData; actions?: ReactNode; footnote?: ReactNode;
  /** The cause under the error state, or the text of the stale notice. */
  error?: string; onRetry?: () => void; className?: string;
}) {
  const { total, ids, rows } = breakdown(parts, otherLabel, max);
  // Every counted part, not the rows: a part that leaves the fold was there all along, and the folded row is no part.
  const fresh = useNewKeys(ids, { enabled: true });
  const color = (slot: number | null) => (slot == null ? OTHER_COLOR : colorAt(slot));
  // While loading, Reveal renders the skeleton instead of this region.
  const view = state === "loading" ? "data" : state !== "error" && rows.length === 0 ? "empty" : state;
  return (
    <Panel title={title} description={description} icon={icon} actions={actions} footnote={footnote} className={className}>
      <div data-slot="breakdown-card">
        <Reveal loading={state === "loading"} skeleton={<BreakdownSkeleton rows={rowLimit(max)} />}>
          <DataRegion state={view} empty={{ icon: PieChartIcon, ...empty }} error={error} onRetry={onRetry}>
            <p className="text-stat tabular text-fg">
              <NumberTween value={total} format={format} />
              {unit && <span className="ml-1 text-body font-normal tracking-normal text-fg-3">{unit}</span>}
            </p>
            <div aria-hidden="true" className="chart-hbar flex h-2 gap-1">
              {rows.map((r) => (
                <span key={r.id} className="chart-stripes h-full min-w-1 rounded-full" style={{ flexGrow: r.share, flexBasis: 0, backgroundColor: color(r.slot) }} />
              ))}
            </div>
            {/* min-w-0: a grid item (DataRegion) would otherwise grow to its longest label instead of clipping it. */}
            <Stagger reorder as="ul" label={title} className="min-w-0">
              {rows.map((r) => (
                <li key={r.id} className={cn(ROW, "rounded-sm", fresh.has(r.id) && "motion-safe:animate-row-new")}>
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color(r.slot) }} />
                  <span className="min-w-0 flex-1 text-body-sm text-fg-2"><Truncate title={r.label}>{r.label}</Truncate></span>
                  <span className="shrink-0 text-body-sm tabular text-fg">{format(r.value)}</span>
                  <span className="w-10 shrink-0 text-right text-caption tabular text-fg-3">{r.shareText}</span>
                </li>
              ))}
            </Stagger>
          </DataRegion>
        </Reveal>
      </div>
    </Panel>
  );
}
