"use client";

import { type ComponentProps, useId } from "react";
import { cn } from "../lib/cn";

/** Characters left at which the counter starts being announced (and turns into a warning near the limit). */
const ANNOUNCE_FROM = 20;

/**
 * Multi-line text field, the Input's look (radius 8, strong line, primary focus ring, Down border when invalid), at
 * least 3 lines, resizable vertically. `limit` adds the GOV.UK character count under it: "120 of 500 characters";
 * typing past the limit is not blocked (no maxlength), the count turns into "12 characters too many" and the field is
 * marked invalid (red border) so the user can trim it; a screen reader hears the count only from 20 characters left,
 * not on every keystroke.
 */
export function Textarea({ className, limit, value, ...props }: Omit<ComponentProps<"textarea">, "maxLength"> & { limit?: number }) {
  const countId = useId();
  const used = typeof value === "string" ? value.length : 0;
  const left = limit != null ? limit - used : null;
  const over = left != null && left < 0;
  const field = (
    <textarea data-slot="textarea" value={value} rows={3} {...props} aria-invalid={over || props["aria-invalid"] || undefined}
      aria-describedby={[props["aria-describedby"], limit != null ? countId : null].filter(Boolean).join(" ") || undefined}
      className={cn("min-h-20 w-full min-w-0 resize-y rounded-md border border-line-strong bg-card px-2.5 py-2 text-body text-fg transition-[border-color,box-shadow] duration-(--dur-fast) outline-none placeholder:text-fg-3",
        "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-soft",
        "read-only:bg-inset read-only:text-fg-2 disabled:cursor-not-allowed disabled:bg-inset disabled:opacity-60",
        "aria-invalid:border-down-mark aria-invalid:focus-visible:ring-down-soft", className)} />
  );
  if (limit == null || left == null) return field;
  const words = (n: number) => `${n} ${n === 1 ? "character" : "characters"}`;
  return (
    <div className="grid gap-1">
      {field}
      <span id={countId} className={cn("text-right text-caption tabular", over ? "text-down-ink" : left <= ANNOUNCE_FROM ? "text-degraded-ink" : "text-fg-3")}>
        <span aria-hidden="true">{over ? `${words(-left)} too many` : `${used} of ${limit} characters`}</span>
        <span className="sr-only" aria-live="polite">{over ? `${words(-left)} too many` : left <= ANNOUNCE_FROM ? `${words(left)} left` : ""}</span>
      </span>
    </div>
  );
}
