import type { ReactNode } from "react";
import { Panel } from "./panel";
import { StepMarker, type IndicatorStep } from "./step-indicator";

/** Composition only: the caller owns validation, draft persistence, navigation and submission. */
export function Wizard({ title, steps, children }: { title: string; steps: readonly IndicatorStep[]; children: ReactNode }) {
  return <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
    <div className="min-w-0 max-xl:order-2">{children}</div>
    <aside aria-label={title} className="min-w-0 xl:sticky xl:top-6">
      <Panel bodyClassName="p-6">
        <h2 className="mb-4 text-title-2">{title}</h2>
        <ol className="flex flex-wrap gap-4 xl:grid xl:gap-6">{steps.map((s, i) => <li key={s.id} aria-current={s.status === "current" ? "step" : undefined} className="flex items-start gap-3">
          <StepMarker status={s.status} n={i + 1} />
          <div className="grid min-w-0 gap-1"><span className="text-label">{s.label}</span><span className="text-caption text-fg-3">{s.status === "done" ? "Complete" : s.status === "current" ? "In progress" : "Upcoming"}</span></div>
        </li>)}</ol>
      </Panel>
    </aside>
  </div>;
}
