import { Icon } from "../ui/icon";
import { CheckIcon } from "../ui/icons";
import { cn } from "../lib/cn";

export type StepStatus = "todo" | "current" | "done";
const STATUS_LABEL: Record<StepStatus, string> = { todo: "To do", current: "Current step", done: "Done" };
export type IndicatorStep = { id: string; label: string; status: StepStatus };

/**
 * The step marker (multi-step flows): current = primary-filled numbered circle, done = healthy-soft check,
 * to do = line-strong ring with the number.
 */
export function StepMarker({ status, n, className }: { status: StepStatus; n?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid size-5 shrink-0 place-items-center rounded-full border font-mono text-caption tabular",
      status === "current" ? "border-primary bg-primary text-primary-foreground"
        : status === "done" ? "border-healthy-mark bg-healthy-soft text-healthy-ink" : "border-line-strong text-fg-3", className)}>
      {status === "done" ? <Icon icon={CheckIcon} className="size-3" /> : n}
    </span>
  );
}

/** Numbered steps with hairline connectors; the current one has aria-current="step", each one its status as text. */
export function StepIndicator({ steps, label, className }: { steps: readonly IndicatorStep[]; label: string; className?: string }) {
  return (
    <ol aria-label={label} className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 text-label", className)}>
      {steps.map((s, i) => (
        <li key={s.id} aria-current={s.status === "current" ? "step" : undefined} className="flex min-w-0 items-center gap-2">
          {i > 0 && <span aria-hidden="true" className="h-px w-6 bg-line-strong" />}
          <StepMarker status={s.status} n={i + 1} />
          <span className={cn(s.status === "current" ? "text-fg" : "font-normal text-fg-3")}>
            {s.label}<span className="sr-only"> ({STATUS_LABEL[s.status]})</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
