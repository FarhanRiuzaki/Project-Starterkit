import { cn } from "../lib/cn";
import { clampRatio, meterTone, type MeterTone, tickState } from "../lib/meter";

const FILL: Record<MeterTone, string> = { normal: "bg-primary", warn: "bg-degraded-mark", crit: "bg-down-mark" };

/** Track colour of every usage bar, both themes. `onInset`: the bar sits on an --inset well, so the track is --line. */
export const meterTrack = (onInset = false) => (onInset ? "bg-line" : "bg-inset dark:bg-stopped-soft");

/** Fill of every usage bar (Meter): tone colour by threshold, striped by default. */
export function MeterFill({ ratio, tone, striped = true }: { ratio: number | null; tone?: MeterTone; striped?: boolean }) {
  return <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-(--dur-enter)", FILL[tone ?? meterTone(ratio)], striped && "striped")}
    style={{ width: `${clampRatio(ratio) * 100}%` }} />;
}

/**
 * Threshold meter (spec §5.10): 8 px fully rounded bar (6 px with `size="sm"`), track --inset (dark: the stopped
 * soft, so it shows on a card), fill primary or the status mark; a 2 × 14 px fg-2 thumb marks the limit
 * (`limitRatio`). `striped` = in progress / partial. Value right, tabular.
 */
export function Meter({ label, ratio, value, limitRatio, tone, striped, size = "md" }: {
  label: string; ratio: number | null; value: string; limitRatio?: number; tone?: MeterTone; striped?: boolean; size?: "sm" | "md";
}) {
  const t = tone ?? meterTone(ratio);
  const pct = clampRatio(ratio) * 100;
  return (
    <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 text-body-sm">
      <span className="text-fg-2">{label}</span>
      <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={value}
        className={cn("relative rounded-full", meterTrack(), size === "sm" ? "h-1.5" : "h-2")}>
        <MeterFill ratio={ratio} tone={t} striped={striped} />
        {limitRatio != null && (
          <span aria-hidden="true" className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-fg-2 ring-2 ring-card" style={{ left: `calc(${clampRatio(limitRatio) * 100}% - 1px)` }} />
        )}
      </span>
      <span className="min-w-22 text-right font-mono text-mono font-medium tabular text-fg">{value}</span>
    </div>
  );
}

const TICK: Record<MeterTone, string> = { normal: "bg-primary", warn: "bg-degraded-mark", crit: "bg-down-mark" };

/**
 * Tick meter (spec §5.10) for scores, home quota and per-developer budget: 24–40 ticks, 3 px wide, 3 px gap,
 * 16 px tall, radius 2; filled = tone colour, empty = --line (spec); the threshold tick is 20 px tall in fg-2.
 * The ticks are decoration for the value text next to them (and the meter's aria-valuetext), so empty ticks follow
 * the spec's quiet --line rather than a 3:1 colour; even --line-strong would only reach ~1.4:1 on a card.
 * Label row above: name left, value right (tabular). Exposed as one `meter` with the value text.
 * `size="compact"` (table cells, spec §5.7 / §8.2 list view): 24 ticks of 2 × 10 px with 2 px gaps (94 px), threshold
 * 12 px, the value as a right-aligned mono caption above; `label` is only the meter's accessible name.
 */
export function TickMeter({ label, ratio, value, ticks = 32, threshold, tone, size = "md" }: {
  label: string; ratio: number | null; value: string; ticks?: number; threshold?: number; tone?: MeterTone; size?: "md" | "compact";
}) {
  const compact = size === "compact";
  const s = tickState(ratio, compact ? 24 : ticks, threshold);
  const t = tone ?? meterTone(ratio);
  const meter = (
    <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clampRatio(ratio) * 100)} aria-valuetext={value}
      className={compact ? "flex h-3 items-end gap-0.5" : "flex h-5 items-end justify-between gap-0.75"}>
      {Array.from({ length: s.count }, (_, i) => (
        <span key={i} aria-hidden="true" className={cn(compact ? "w-0.5 rounded-xs" : "w-0.75 rounded-tick",
          i === s.threshold ? cn(compact ? "h-3" : "h-5", "bg-fg-2") : cn(compact ? "h-2.5" : "h-4", i < s.filled ? TICK[t] : "bg-line"))} />
      ))}
    </span>
  );
  if (compact) {
    return (
      <span className="inline-grid justify-items-end gap-1">
        <span className="font-mono text-caption whitespace-nowrap tabular text-fg">{value}</span>
        {meter}
      </span>
    );
  }
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-body-sm">
        <span className="min-w-0 truncate text-fg-2">{label}</span>
        <span className="font-medium tabular text-fg">{value}</span>
      </div>
      {meter}
    </div>
  );
}
