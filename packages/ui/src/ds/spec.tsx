import type { ReactNode } from "react";

/** Footer "lembar spesifikasi": label mono kapital kecil + nilai mono tabular. */
export function Spec({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2 border-t border-dashed border-line-strong pt-3">
      {items.map((i) => (
        <div key={i.label} className="grid min-w-0 gap-0.5">
          <dt className="eyebrow truncate text-fg-3" title={i.label}>{i.label}</dt>
          <dd className="truncate font-mono text-body-sm font-medium tabular text-fg" title={typeof i.value === "string" ? i.value : undefined}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
