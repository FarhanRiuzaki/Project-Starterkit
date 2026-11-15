import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { Button } from "../ui/button";
import { CardSurface } from "./card-surface";
import { Disclosure } from "./disclosure";
import { Progress } from "./progress";
import { SetupChecklistRoot } from "./setup-checklist-root";
import { StepMarker } from "./step-indicator";

/** What a task offers: a link (`href`) or a callback (`onClick`), with its label ("Invite user"). */
export type SetupAction = { label: string } & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });
export type SetupTask = { id: string; label: string; description?: string; done: boolean; action?: SetupAction };
export type SetupGroup = { id: string; label: string; tasks: readonly SetupTask[] };

const doneIn = (tasks: readonly SetupTask[]) => tasks.filter((t) => t.done).length;
const countOf = (done: number, total: number) => `${formatNumber(done)} of ${formatNumber(total)}`;

/**
 * Setup checklist (onboarding): what is left to set up, on one tray. The header has the title (a heading, level 2
 * unless set) and "N of M done" as text and as a `Progress` bar named by the title; under it a list of groups, each a
 * card that is a native `Disclosure` (R9) with its own count and a list of its tasks. Only the first group with a task
 * left is open; when its last task is done it closes and the next one opens. A task left shows an empty marker and its
 * action (a secondary Button, or a link drawn as one); a done task shows the check, a quieter label and the word
 * `doneLabel` where the action was, so the state is never colour or a strike-through alone. The check enters (swap +
 * stroke draw, base.css) only when the task becomes done, never on first paint. When every task is done and
 * `completion` is given, it replaces the groups inside a `role="status"` region that is always in the document, so it
 * is announced; the count in the header is a polite live region, so every task done is announced too. No tasks at all
 * renders nothing; a group without tasks is left out.
 * Focus: an action whose task becomes done is unmounted, so the root (`SetupChecklistRoot`, the one client part) moves
 * focus that was on it to the next action left in the group, else the summary of the group that opens, else the
 * completion message (the status region takes focus then, `tabIndex` −1).
 * No hooks of its own: with `href` actions it renders from a server component.
 */
export function SetupChecklist({ title, groups, progressText, completion, headingLevel = 2, doneLabel = "Done", renderLink, className }: {
  title: string; groups: readonly SetupGroup[];
  /** Replaces the default "3 of 6 done", in the header and as the progress bar's value text. */
  progressText?: string;
  /** Shown instead of the groups once every task is done. */
  completion?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** The word a done task and the counts say. */
  doneLabel?: string;
  /** The router's link for an `href` action (the default is a plain `<a>`, a document load). */
  renderLink?: (href: string, label: string) => ReactNode;
  className?: string;
}) {
  const shown = groups.filter((g) => g.tasks.length > 0);
  const total = shown.reduce((n, g) => n + g.tasks.length, 0);
  if (total === 0) return null;
  const done = shown.reduce((n, g) => n + doneIn(g.tasks), 0);
  const summary = progressText ?? `${countOf(done, total)} ${doneLabel.toLowerCase()}`;
  const finished = done === total && !!completion;
  const openId = shown.find((g) => doneIn(g.tasks) < g.tasks.length)?.id;
  const Heading = `h${headingLevel}` as const;
  return (
    <SetupChecklistRoot className={cn("grid", className)}>
      <CardSurface cards header={
        <header className="grid gap-2 px-3 pt-2 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Heading className="min-w-0 text-title-2 break-words text-fg">{title}</Heading>
            <p aria-live="polite" aria-atomic="true" className="tabular text-body-sm text-fg-2">{summary}</p>
          </div>
          <Progress hideLabel label={title} value={done} max={total} valueText={summary} />
        </header>
      }>
        <div role="status" tabIndex={finished ? -1 : undefined} className={finished ? "rounded-lg border border-line bg-card p-4 text-body-sm text-fg-2" : "sr-only"}>{finished && completion}</div>
        {!finished && (
          <ul className="grid gap-1">
            {shown.map((g) => (
              <li key={g.id} data-slot="setup-group">
                <Disclosure defaultOpen={g.id === openId} summary={
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="min-w-0 break-words">{g.label}</span>
                    <span className="tabular text-caption font-normal text-fg-3">{countOf(doneIn(g.tasks), g.tasks.length)}<span className="sr-only"> {doneLabel}</span></span>
                  </span>
                }>
                  <ul className="grid">
                    {g.tasks.map((t) => (
                      <li key={t.id} data-slot="setup-task" data-done={t.done || undefined} className="flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-line py-2 first:border-t-0">
                        <StepMarker status={t.done ? "done" : "todo"} className="mt-1" />
                        <div className="grid min-w-0 flex-1 basis-40 gap-0.5 py-1">
                          <span className={cn("text-body break-words", t.done ? "text-fg-2" : "font-medium text-fg")}>{t.label}</span>
                          {t.description && <span className="text-body-sm break-words text-fg-3">{t.description}</span>}
                        </div>
                        {t.done ? <span className="ml-auto py-1.5 text-caption text-fg-3">{doneLabel}</span>
                          : t.action && (t.action.href != null
                            ? <Button asChild variant="secondary" size="sm" className="ml-auto">{renderLink?.(t.action.href, t.action.label) ?? <a href={t.action.href}>{t.action.label}</a>}</Button>
                            : <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={t.action.onClick}>{t.action.label}</Button>)}
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              </li>
            ))}
          </ul>
        )}
      </CardSurface>
    </SetupChecklistRoot>
  );
}
