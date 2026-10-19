import type { ReactNode } from "react";
import { Truncate } from "./truncate";

/**
 * Label / value rows under a chart or in a narrow rail (Insights, AI share, Top 5 totals): one row per fact, label left (body-sm fg-2), value right
 * (mono tabular). Long labels get the full width they need, so nothing clips at 1280 the way a 3-column Spec does.
 */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-1.5 border-t border-dashed border-line-strong pt-3">
      {items.map((i) => (
        <div key={i.label} className="flex min-w-0 items-baseline justify-between gap-3">
          <dt className="min-w-0 text-body-sm text-fg-2"><Truncate title={i.label}>{i.label}</Truncate></dt>
          <dd className="shrink-0 font-mono text-body-sm font-medium tabular text-fg">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
