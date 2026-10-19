"use client";

import { useId, useRef } from "react";
import { SharedIndicator, useMotionLayer } from "../motion";
import { cn } from "../lib/cn";
import { useIndicator } from "../ui/use-indicator";
import { formatNumber } from "../lib/format";
import { nextIndex } from "../lib/roving";

/**
 * Segmented control (spec §5.9), single choice — a radiogroup with roving focus (arrow keys). Track --tray, 1 px
 * line, radius 10, padding 2; segments 28 px, radius 8, padding 0 10, `label`; optional count after the label.
 * The active "thumb" (--seg-active + shadow-sm) is one positioned element that slides between segments with a CSS
 * transform; until it is measured (server HTML) the active segment fills itself. Only fg / fg-2 text sits on the
 * thumb (fg-3 is under 4.5:1 on it in dark), so the active count uses fg-2. Once the deferred Framer layer is loaded
 * the thumb is a `layoutId` element inside the active segment, moved with the spec §7.3 spring.
 */
export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: readonly { value: T; label: string; count?: number }[]; label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useIndicator(ref, "[role=radio][aria-checked=true]", [options.length]);
  const kit = useMotionLayer();
  const layoutId = `seg-${useId()}`;
  const hasMatch = options.some((o) => o.value === value);
  function onKey(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = nextIndex(i, e.key, options.length);
    if (n == null) return;
    e.preventDefault();
    const target = options[n];
    if (target) onChange(target.value);
    (ref.current?.querySelectorAll<HTMLElement>("[role=radio]")[n])?.focus();
  }
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className="relative inline-flex shrink-0 rounded-ctl border border-line bg-tray p-0.5">
      {box && !kit && (
        <span aria-hidden="true" className="indicator-move pointer-events-none absolute inset-y-0.5 left-0 rounded-md bg-seg-active shadow-sm"
          style={{ transform: `translateX(${box.x}px)`, width: box.width }} />
      )}
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on || (!hasMatch && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)}
            className={cn("relative z-10 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-label whitespace-nowrap transition-colors duration-(--dur-fast)",
              on ? "text-fg" : "text-fg-2 hover:text-fg", on && !box && !kit && "bg-seg-active shadow-sm")}>
            {on && <SharedIndicator layoutId={layoutId} radius={8} className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-seg-active shadow-sm" />}
            {o.label}
            {o.count != null && <span className={cn("text-caption tabular", on ? "text-fg-2" : "text-fg-3")}>{formatNumber(o.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}
