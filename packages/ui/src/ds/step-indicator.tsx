"use client";

import { useChangeKey } from "../motion";
import { Icon } from "../ui/icon";
import { CheckIcon, WarningIcon } from "../ui/icons";
import { cn } from "../lib/cn";

export type StepStatus = "todo" | "current" | "done" | "error" | "disabled";
const STATUS_LABEL: Record<StepStatus, string> = { todo: "To do", current: "Current step", done: "Done", error: "Needs attention", disabled: "Unavailable" };
export type IndicatorStep = { id: string; label: string; status: StepStatus; optional?: boolean; description?: string };

/**
 * The step marker (multi-step flows): current = primary-filled numbered circle, done = healthy-soft check,
 * to do = line-strong ring with the number.
 */
export function StepMarker({ status, n, className, completionKey }: { status: StepStatus; n?: number; className?: string; completionKey?: number }) {
  const ownChange = useChangeKey(status);
  const change = completionKey ?? ownChange;
  return (
    <span data-slot="step-marker" data-status={status} aria-hidden="true" className={cn("grid size-5 shrink-0 place-items-center rounded-full border font-mono text-caption tabular",
      status === "current" ? "border-primary bg-primary text-primary-foreground"
        : status === "done" ? "border-healthy-mark bg-healthy-soft text-healthy-ink" : status === "error" ? "border-down-mark bg-down-soft text-down-ink" : status === "disabled" ? "border-line text-fg-4" : "border-control-border text-fg-3", className)}>
      {status === "done" ? <Icon key={change} icon={CheckIcon} className={cn("size-3", change > 0 && "animate-swap")} /> : status === "error" ? <Icon icon={WarningIcon} className="size-3" /> : n}
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

/** Full labelled step; the caller decides whether a completed step may be revisited. */
export function StepItem({ step, number, onSelect }: { step: IndicatorStep; number: number; onSelect?: () => void }) {
  const completionKey = useChangeKey(step.status);
  const content = <><StepMarker status={step.status} n={number} completionKey={completionKey} /><span className="grid min-w-0 gap-1"><span className="text-label">{step.label}{step.optional && " (optional)"}</span><span className="text-caption text-fg-3">{step.description ?? STATUS_LABEL[step.status]}</span></span></>;
  return onSelect && step.status === "done" ? <button data-slot="step-trigger" type="button" onClick={onSelect} className="press-feedback flex items-start gap-3 rounded-md text-left hover:bg-tray">{content}</button> : <div aria-current={step.status === "current" ? "step" : undefined} className="flex items-start gap-3">{content}</div>;
}
export function Stepper({ steps, label, layout = "horizontal", onStepSelect }: { steps: readonly IndicatorStep[]; label: string; layout?: "horizontal" | "vertical" | "compact"; onStepSelect?: (id: string) => void }) {
  const current = Math.max(0, steps.findIndex(s => s.status === "current" || s.status === "error"));
  if (layout === "compact") return <div aria-label={label} className="grid gap-3"><p className="text-label">Step {current + 1} of {steps.length} · {steps[current]?.label}</p><p className="text-caption text-fg-3">{steps[current + 1] ? `Next: ${steps[current + 1]!.label}` : "Final step"}</p><progress className="h-0.5 w-full accent-primary" aria-label={label} value={current + 1} max={steps.length} /></div>;
  return <ol aria-label={label} className={cn("grid gap-6", layout === "horizontal" && "md:flex md:flex-wrap md:gap-12")}>{steps.map((step, i) => <li key={step.id}><StepItem step={step} number={i + 1} onSelect={onStepSelect ? () => onStepSelect(step.id) : undefined} /></li>)}</ol>;
}
