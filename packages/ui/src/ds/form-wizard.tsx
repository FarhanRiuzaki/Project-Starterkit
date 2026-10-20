"use client";

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { SpinnerIcon } from "../ui/icons";
import { FormActions } from "./form-layout";
import { StepMarker, type StepStatus } from "./step-indicator";

export type WizardStep = {
  id: string;
  /** Short noun phrase: the step's heading and its label in the indicator ("Account", "Roles", "Review"). */
  title: string;
  description?: string;
  /** The fields Continue validates on this step (useForm's `check`); none on a review step. */
  fields?: readonly string[];
  content: ReactNode;
};

/**
 * Multi-step form (NN/g wizards, GOV.UK question pages and check answers, Carbon progress indicator). The form is a card;
 * from 1280 px the steps are a vertical list on its right that stays in view while a long step scrolls (sticky), each
 * with its description; below that the list sits above the card as one row (on a phone only the current step's name
 * shows, "Step 2 of 4" says the rest). Continue validates only this step's `fields` (through `check`, useForm's) and
 * moves on, focusing the new step's heading; Back returns with what was typed kept; a step already reached is a button
 * in the list (going forward still validates this step first), and the review step's ReviewList reopens any answer's
 * step (Change). The buttons stick to the bottom of the window (FormActions). The last step submits with `submitLabel`
 * (the action: "Create user"), pending while it runs, its failure shown in `error` above the buttons. `step` /
 * `onStepChange` make it controlled (a page can keep the step in the URL); otherwise it keeps its own.
 */
export function FormWizard({ steps, check, onSubmit, submitLabel, error, label, step: controlled, onStepChange, className }: {
  steps: readonly WizardStep[];
  check: (fields: readonly string[]) => boolean;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  error?: string | null;
  label: string;
  step?: number;
  onStepChange?: (step: number) => void;
  className?: string;
}) {
  const [own, setOwn] = useState(0);
  const [reached, setReached] = useState(0);
  const [busy, setBusy] = useState(false);
  const current = Math.min(controlled ?? own, steps.length - 1);
  const go = (n: number) => { (onStepChange ?? setOwn)(n); setReached((r) => Math.max(r, n)); };
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => { if (moved.current) heading.current?.focus(); moved.current = true; }, [current]);

  const s = steps[current]!;
  const last = current === steps.length - 1;
  async function next(e: FormEvent) {
    e.preventDefault();
    if (!check(s.fields ?? [])) return;
    if (!last) { go(current + 1); return; }
    setBusy(true);
    try { await onSubmit(); } finally { setBusy(false); }
  }
  const jump = (i: number) => { if (i < current || check(s.fields ?? [])) go(i); };
  const status = (i: number): StepStatus => (i === current ? "current" : i <= reached ? "done" : "todo");

  return (
    <form noValidate onSubmit={next} aria-label={label} className={cn("grid items-start gap-gutter xl:grid-cols-[minmax(0,1fr)_16rem]", className)}>
      <nav aria-label={`${label}: steps`} className="min-w-0 xl:sticky xl:top-6 xl:order-last">
        <ol className="flex flex-wrap items-center gap-2 xl:grid xl:gap-0">
          {steps.map((x, i) => {
            const st = status(i);
            const mark = (
              <>
                <StepMarker status={st} n={i + 1} className="xl:mt-px" />
                <span className="grid min-w-0 text-left">
                  <span className={cn("text-label", st === "current" ? "text-fg" : "font-normal text-fg-3", st !== "current" && "max-md:sr-only")}>
                    {x.title}<span className="sr-only"> ({st === "current" ? "current step" : st === "done" ? "done" : "to do"})</span>
                  </span>
                  {x.description && <span className="text-caption text-fg-3 max-xl:hidden">{x.description}</span>}
                </span>
              </>
            );
            return (
              <li key={x.id} aria-current={st === "current" ? "step" : undefined} className="relative flex min-w-0 items-center gap-2 xl:items-start xl:pb-5 xl:last:pb-0">
                {i > 0 && <span aria-hidden="true" className="h-px w-6 bg-line-strong xl:hidden" />}
                {/* The vertical connector runs from under this marker to the next one (xl). */}
                {i < steps.length - 1 && <span aria-hidden="true" className="absolute top-6 bottom-1 left-2.5 w-px -translate-x-1/2 bg-line-strong max-xl:hidden" />}
                {st === "done" && !busy
                  ? <button type="button" onClick={() => jump(i)} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xs outline-none hover:[&_.text-label]:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:items-start">{mark}</button>
                  : <span className="flex min-w-0 items-center gap-2 xl:items-start">{mark}</span>}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="grid min-w-0 gap-5 rounded-lg border border-line bg-card p-4 shadow-card md:p-6">
        <div className="grid gap-1">
          <p className="text-caption text-fg-3">Step {current + 1} of {steps.length}</p>
          <h2 ref={heading} tabIndex={-1} className="text-title-2 text-fg outline-none">{s.title}</h2>
          {s.description && <p className="text-body-sm text-fg-3">{s.description}</p>}
        </div>
        {/* Keyed by step: each step mounts fresh, so a control is never reused for the next step's field (its blur would
            count against a field the user hasn't reached). */}
        <div key={s.id} className="grid max-w-xl gap-4">{s.content}</div>
        {error && <p role="alert" className="text-body-sm text-down-ink">{error}</p>}
        <FormActions className="md:-mx-6 md:-mb-6 md:px-6">
          {/* Back before Continue: the buttons map to the direction they move in. */}
          {current > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={() => go(current - 1)}>Back</Button>}
          <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
            {busy && <Icon icon={SpinnerIcon} className="motion-safe:animate-spin" />}{last ? submitLabel : "Continue"}
          </Button>
        </FormActions>
      </div>
    </form>
  );
}

/**
 * The review step's summary list (GOV.UK check answers): label, the answer ("Not provided" when empty) and a Change
 * button that reopens the answer's step, its name saying what changes ("Change email") for screen readers.
 */
export function ReviewList({ rows, onChange }: { rows: readonly { label: string; value: ReactNode; step: number }[]; onChange: (step: number) => void }) {
  return (
    <dl className="grid rounded-lg border border-line bg-card">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0">
          <dt className="w-40 shrink-0 text-label text-fg-2">{r.label}</dt>
          <dd className="min-w-0 flex-1 text-body text-fg">{r.value === "" || r.value == null ? <span className="text-fg-3">Not provided</span> : r.value}</dd>
          <dd>
            <button type="button" onClick={() => onChange(r.step)} className="cursor-pointer rounded-xs text-body-sm text-primary-ink underline underline-offset-4 hover:decoration-2">
              Change<span className="sr-only"> {r.label.toLowerCase()}</span>
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}
