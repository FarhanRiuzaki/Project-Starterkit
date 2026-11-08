import { cn } from "../lib/cn";
import { clampRatio } from "../lib/meter";

/**
 * Progress of a task (Apple HIG progress indicator): a thin fully rounded bar (6 px, 4 px with `size="sm"`) on the
 * --inset track, the fill primary and striped like every bar (red, Down mark, for a failed task), with the label left
 * and the value right ("64%", or `valueText` such as "3 of 5 files"). Without `value` it is indeterminate: a third of the
 * bar crosses the track (still under reduced motion) and no value is read. role="progressbar" with aria-valuenow / text.
 * A Meter, not a Progress, shows how full something is (usage against a limit).
 */
export function Progress({ label, value, max = 100, valueText, size = "md", failed, hideLabel, className }: {
  label: string; value?: number | null; max?: number; valueText?: string; size?: "sm" | "md"; failed?: boolean; hideLabel?: boolean; className?: string;
}) {
  const known = value != null && Number.isFinite(value);
  const ratio = known ? clampRatio(value / max) : 0;
  const text = known ? (valueText ?? `${Math.round(ratio * 100)}%`) : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      {!hideLabel && (
        <div className="flex items-baseline justify-between gap-3 text-body-sm">
          <span className="min-w-0 truncate text-fg-2">{label}</span>
          {text && <span className="shrink-0 tabular text-fg">{text}</span>}
        </div>
      )}
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={known ? max : undefined} aria-valuenow={known ? value! : undefined}
        aria-valuetext={text} className={cn("relative overflow-hidden rounded-full bg-inset dark:bg-stopped-soft", size === "sm" ? "h-1" : "h-1.5")}>
        <span aria-hidden="true" className={cn("striped absolute inset-y-0 left-0 rounded-full", failed ? "bg-down-mark" : "bg-primary",
          known ? "transition-[width] duration-(--dur-enter) ease-out" : "animate-progress w-1/3")}
          style={known ? { width: `${ratio * 100}%` } : undefined} />
      </div>
    </div>
  );
}
