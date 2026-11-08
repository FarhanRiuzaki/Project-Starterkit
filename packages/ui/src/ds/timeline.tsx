import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Icon } from "../ui/icon";
import { CheckIcon, CloseIcon } from "../ui/icons";
import { RelativeTime } from "./relative-time";

export type TimelineStatus = "done" | "current" | "upcoming" | "rejected" | "skipped";
export type TimelineItem = {
  id: string; title: string; status: TimelineStatus;
  /** When it happened (ms); none for a step that hasn't. */
  at?: number | null;
  /** Who did it ("Rina Wulandari, Finance"). */
  actor?: ReactNode;
  /** A comment or detail, in a quiet box under the step. */
  note?: ReactNode;
};

const SAID: Record<TimelineStatus, string> = { done: "Done", current: "In progress", upcoming: "Not started", rejected: "Rejected", skipped: "Skipped" };

function Marker({ status }: { status: TimelineStatus }) {
  return (
    <span aria-hidden="true" className={cn("relative z-1 grid size-5 shrink-0 place-items-center rounded-full border bg-card",
      status === "done" && "border-healthy-mark bg-healthy-soft text-healthy-ink",
      status === "current" && "border-primary ring-4 ring-primary-soft",
      status === "rejected" && "border-down-mark bg-down-soft text-down-ink",
      status === "upcoming" && "border-line-strong",
      status === "skipped" && "border-dashed border-line-strong")}>
      {status === "done" && <Icon icon={CheckIcon} className="size-3" />}
      {status === "rejected" && <Icon icon={CloseIcon} className="size-3" />}
      {status === "current" && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}

/**
 * Timeline (approval flow, shipment tracking, a record's history): an ordered list, oldest or first step on top, each
 * step a 20 px marker on a hairline rail with its title, status, actor, time and an optional note. Done = Healthy check,
 * current = primary dot with a soft ring, rejected = Down cross, upcoming = ring, skipped = dashed ring (the StepMarker
 * family); the rail is solid up to the last finished step, dashed after it. Every step says its status in words (screen
 * readers and colour-blind users), and the current one carries aria-current="step". For a short horizontal step list
 * (a wizard's header) use StepIndicator.
 */
export function Timeline({ items, label, className }: { items: readonly TimelineItem[]; label: string; className?: string }) {
  const lastDone = items.reduce((n, it, i) => (it.status === "done" || it.status === "rejected" || it.status === "skipped" ? i : n), -1);
  return (
    <ol aria-label={label} className={cn("grid", className)}>
      {items.map((it, i) => (
        <li key={it.id} aria-current={it.status === "current" ? "step" : undefined} className="relative grid grid-cols-[20px_1fr] gap-x-3 pb-5 last:pb-0">
          {i < items.length - 1 && (
            <span aria-hidden="true" className={cn("absolute top-5 bottom-0 left-2.25 w-0 border-l", i < lastDone ? "border-line-strong" : "border-dashed border-line-strong")} />
          )}
          <Marker status={it.status} />
          <div className="grid min-w-0 gap-1 pt-px">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className={cn("text-body font-medium", it.status === "upcoming" || it.status === "skipped" ? "text-fg-3" : "text-fg")}>{it.title}</span>
              <span className={cn("text-caption", it.status === "rejected" ? "text-down-ink" : "text-fg-3")}>{SAID[it.status]}</span>
              {it.at != null && <span className="ml-auto text-caption text-fg-3"><RelativeTime at={it.at} /></span>}
            </div>
            {it.actor && <span className="text-body-sm text-fg-2">{it.actor}</span>}
            {it.note && <div className="mt-1 rounded-md bg-tray px-3 py-2 text-body-sm text-fg-2">{it.note}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
