import type { ReactNode } from "react";
import { Icon, type IconData } from "../ui/icon";
import { ArrowDownIcon, ArrowUpIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { NumberTween } from "../motion";
import { Skeleton } from "../ui/skeleton";
import { clampRatio } from "../lib/meter";
import { type DeltaDirection, deltaTone, splitDelta } from "../lib/delta";

/**
 * `text` is the whole comparison, number first ("+18% vs previous 24 hours"): the number goes in the pill and the
 * rest in the caption. A text that is not number-first is a caption without a pill. `good` = the direction that is
 * good for this metric (cost up = bad); null = neutral.
 */
export type Delta = { text: string; direction: DeltaDirection; good: "up" | "down" | null };

const PILL = { good: "bg-healthy-soft text-healthy-ink", bad: "bg-down-soft text-down-ink", neutral: "bg-tray text-fg-2" } as const;

/**
 * KPI tray (spec §5.5): one tray, tiles side by side with a 4 px gap, always filling the row (4 or 3 equal tiles
 * at ≥ 1024, 2 per row below). Tiles enter staggered (CSS, 35 ms per tile).
 */
export function StatTiles({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="kpi-tray" className={cn("stagger-children grid grid-cols-2 gap-tray rounded-xl border border-line bg-tray p-tray lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none", className)}>
      {children}
    </div>
  );
}

/**
 * KPI tile (spec §5.5): card, padding 16, min-height 104. Label row (16 px fg-3 icon + body-sm fg-2) with the
 * delta pill right; value `stat` 28/500 with the unit / denominator in body fg-3; then the comparison caption and
 * an optional 6 px striped progress bar or a 28 px sparkline (`trend`). `caption` replaces the comparison line
 * under the value (with or without a delta, e.g. "Last 7 days · vs previous 7 days" or "1,204 tokens today"). `tween` animates value changes
 * (NumberTween; `value` stays the fallback text and is ignored while `tween` is set).
 */
export function StatTile({ label, value, unit, delta, caption: captionProp, trend, icon, progress, tween }: {
  label: string; value: string; unit?: string; delta?: Delta; caption?: string; trend?: ReactNode; icon?: IconData;
  /** 0–1: 6 px striped bar under the value (e.g. 19 of 24 connected). */
  progress?: number | null;
  tween?: { value: number; format: (v: number) => string; total?: number };
}) {
  const split = delta ? splitDelta(delta.text) : null;
  const pill = split?.pill ?? null;
  const caption = captionProp ?? split?.caption ?? null;
  const tone = delta ? deltaTone(delta) : "neutral";
  const arrow = delta?.direction === "up" ? ArrowUpIcon : delta?.direction === "down" ? ArrowDownIcon : null;
  return (
    <div data-slot="stat-tile" className="flex min-h-26 min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-card p-4 shadow-card">
      <div className="flex min-w-0 items-center gap-2 text-body-sm text-fg-2">
        {icon && <Icon icon={icon} className="size-4 shrink-0 text-fg-3" />}
        <span className="min-w-0 truncate" title={label}>{label}</span>
        {pill && (
          <span className={cn("-my-0.5 ml-auto inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-label", PILL[tone])}>
            {arrow && <Icon icon={arrow} className="size-3" />}{pill}
          </span>
        )}
      </div>
      <span className="text-stat text-fg tabular">
        {tween ? <NumberTween value={tween.value} format={tween.format} total={tween.total} /> : value}
        {unit && <span className="ml-0.5 text-body font-normal tracking-normal text-fg-3">{unit}</span>}
      </span>
      {progress != null && (
        <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-inset">
          <span className="striped block h-full rounded-full bg-primary" style={{ width: `${clampRatio(progress) * 100}%` }} />
        </span>
      )}
      {caption && <span className="text-caption text-fg-3">{caption}</span>}
      {trend && <div className="mt-auto h-7">{trend}</div>}
    </div>
  );
}

/**
 * Loading shape for `count` tiles — the StatTile rows at their rendered heights (label 18, value 32, optional 6 px
 * bar, caption 16, optional 28 px trend; gap 10), so the tray keeps its height when the values arrive (no layout
 * shift). Match the loaded tiles: `progress` when one has a bar, `caption={false}` when none has a caption line.
 */
export function StatTileSkeletons({ count = 4, trend = false, caption = true, progress = false }: { count?: number; trend?: boolean; caption?: boolean; progress?: boolean }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="flex min-h-26 flex-col gap-2.5 rounded-lg border border-line bg-card p-4 shadow-card" aria-hidden="true">
      <div className="flex h-4.5 items-center"><Skeleton className="h-2.5 w-1/2" /></div>
      <div className="flex h-8 items-center"><Skeleton className="h-7 w-1/3" /></div>
      {progress && <Skeleton className="h-1.5 w-full rounded-full" />}
      {caption && <div className="flex h-4 items-center"><Skeleton className="h-2.5 w-2/3" /></div>}
      {trend && <Skeleton className="mt-auto h-7 w-full" />}
    </div>
  ));
}
