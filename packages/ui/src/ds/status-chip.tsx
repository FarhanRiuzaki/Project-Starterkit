"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useChangeKey } from "../motion";
import { Icon } from "../ui/icon";
import { SpinnerIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import type { Health } from "../lib/status";

/** Shape colour = status mark (≥ 3:1), label = status ink (≥ 4.5:1 on card and on soft), spec §3.1 / §5.8. */
const TONE: Record<Health, string> = {
  healthy: "text-healthy-mark", degraded: "text-degraded-mark", down: "text-down-mark", stopped: "text-stopped-mark", unknown: "text-stopped-mark", // unknown-mark is < 3:1 on card; the dashed ring tells it apart
};
const INK: Record<Health, string> = {
  healthy: "text-healthy-ink", degraded: "text-degraded-ink", down: "text-down-ink", stopped: "text-stopped-ink", unknown: "text-unknown-ink",
};
const SOFT: Record<Health, string> = {
  healthy: "bg-healthy-soft", degraded: "bg-degraded-soft", down: "bg-down-soft", stopped: "bg-stopped-soft", unknown: "bg-unknown-soft",
};
const INTERACTIVE = "a[href],button,[role=button],[role=link],[role=menuitem],[role=tab],summary,label";

/** A distinct shape per status (spec §4), so meaning never relies on color alone. */
export function StatusIcon({ health, className }: { health: Health; className?: string }) {
  const cls = cn("size-3 shrink-0", TONE[health], className);
  switch (health) {
    case "healthy": return <svg viewBox="0 0 10 10" className={cls} aria-hidden="true"><circle cx="5" cy="5" r="4.2" fill="currentColor" /></svg>;
    case "degraded": return <svg viewBox="0 0 10 10" className={cls} aria-hidden="true"><path d="M5 .6 9.6 9.2H.4Z" fill="currentColor" /></svg>;
    case "down": return <svg viewBox="0 0 10 10" className={cls} aria-hidden="true"><path d="M3.1.5h3.8l2.6 2.6v3.8L6.9 9.5H3.1L.5 6.9V3.1Z" fill="currentColor" /></svg>;
    case "stopped": return <svg viewBox="0 0 10 10" className={cls} aria-hidden="true"><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
    case "unknown": return <svg viewBox="0 0 10 10" className={cls} aria-hidden="true"><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 1.6" /></svg>;
  }
}

export type StatusChipProps = {
  health: Health;
  /** Visible text. */
  label: string;
  /** One-sentence meaning, shown in the tooltip; omit for a bare chip. */
  description?: string | null;
  /** Spinner in front of the target status (a transition). */
  pending?: boolean;
  /** Pulsing icon (e.g. active session); animates only without reduced-motion. */
  live?: boolean;
  /**
   * The chip sits inside a link, button, or stretched-link card: no tab stop; the description is visually hidden
   * text (or behind `descriptionId`). Detected automatically after mount when omitted.
   */
  interactive?: boolean;
  /**
   * Id for the hidden description, so a parent control (e.g. a card's title link) can set `aria-describedby`
   * to it. With it, the description is not repeated inline.
   */
  descriptionId?: string;
  /** Strong variant for dense tables (spec §5.8): soft status fill, no border. */
  strong?: boolean;
  /** A long label wraps inside the width the parent gives (dense tables) instead of widening the column. */
  wrap?: boolean;
};

/**
 * Where the chip sits decides how its description is exposed:
 * - `focusable`: standalone; tab stop + `aria-describedby`.
 * - `nested`: inside a link/button, or in a `[data-card]`/`article` with a link (stretched-link card): no tab stop,
 *   description as sr-only text (or hidden behind `descriptionId`); raised above the card's link overlay so hover works.
 * - `static`: inside `[data-status-static]` (DataTable): no tab stop, no repeated SR text; hover tooltip only —
 *   the card's legend (Panel `legend`) explains the values.
 */
type Mode = "focusable" | "nested" | "static";
function detect(el: HTMLElement | null): { mode: Mode; card: boolean } {
  const parent = el?.parentElement;
  if (!parent) return { mode: "nested", card: false };
  if (parent.closest(INTERACTIVE)) return { mode: "nested", card: false };
  const card = parent.closest("[data-card], [data-slot=card], article");
  if (card?.querySelector("a[href]")) return { mode: "nested", card: true };
  if (parent.closest("[data-status-static]")) return { mode: "static", card: false };
  return { mode: "focusable", card: false };
}

/**
 * Status chip (spec §5.8): 22 px pill, 1 px line, card fill, 12 px state shape in the mark colour + label in the ink
 * colour. Shape + colour + text, with an optional one-sentence description in a tooltip.
 */
export function StatusChip(props: StatusChipProps) {
  const { health, label } = props;
  const description = props.description ?? null;
  const ref = useRef<HTMLSpanElement>(null);
  // The label crossfades when the status changes (keyed remount, so re-renders do not cancel it).
  const k = useChangeKey(`${health}:${label}`);
  const autoId = useId();
  const descId = props.descriptionId ?? `${autoId}-d`;
  // Before mount (SSR) treat the chip as nested: no tab stop, description readable inline. Safe everywhere.
  const [where, setWhere] = useState<{ mode: Mode; card: boolean } | null>(null);
  useLayoutEffect(() => {
    if (props.interactive !== undefined) return;
    setWhere(detect(ref.current));
  }, [props.interactive]);
  const mode: Mode = props.interactive === true ? "nested" : props.interactive === false ? "focusable" : where?.mode ?? "nested";
  const focusable = !!description && mode === "focusable";

  const chip = (
    <span ref={ref} data-slot="status-chip" data-status={health} data-changed={k > 0 || undefined} tabIndex={focusable ? 0 : undefined} aria-describedby={focusable ? descId : undefined}
      className={cn("inline-flex items-center gap-1.5 border pr-2 pl-1.5 text-label motion-safe:transition-colors duration-(--dur-fast)",
        props.wrap ? "min-h-5.5 max-w-full rounded-xl py-0.5 leading-tight" : "h-5.5 rounded-full whitespace-nowrap",
        INK[health], props.strong ? cn("border-transparent", SOFT[health]) : "border-line bg-card",
        description && "cursor-help",
        focusable && "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        where?.card && description && "relative z-10")}>
      {props.pending ? <Icon icon={SpinnerIcon} className="size-3 shrink-0 motion-safe:animate-spin text-fg-2" /> : props.live ? (
        <span className="relative inline-grid size-3 shrink-0 place-items-center" aria-hidden="true">
          <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", TONE[health], "bg-current")} />
          <StatusIcon health={health} className="relative" />
        </span>
      ) : <StatusIcon health={health} />}
      <span key={k} className={cn(k > 0 && "motion-safe:animate-reveal-in")}>{label}</span>
      {description && (mode !== "static" || props.descriptionId) && (mode === "nested" && !props.descriptionId
        ? <span className="sr-only">{`: ${description}`}</span>
        : <span id={descId} hidden>{description}</span>)}
    </span>
  );
  if (!description) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent><span className="font-medium">{label}</span> — {description}</TooltipContent>
    </Tooltip>
  );
}
