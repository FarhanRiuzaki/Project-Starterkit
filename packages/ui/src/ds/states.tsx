import type { ReactNode } from "react";
import { Icon, type IconData } from "../ui/icon";
import { RefreshIcon, WarningIcon } from "../ui/icons";
import { Button } from "../ui/button";
import { formatDateTimeLong, formatRelative, formatTime, APP_TIME_ZONE_LABEL } from "../lib/format";

/**
 * Empty (spec §5.13): inside the card, centred — a 20 px icon in a 40 px --tray circle, `title-3`, body-sm fg-3,
 * one ghost or secondary action (filtered-empty offers "Clear filters").
 */
export function EmptyState({ icon, title, description, action }: { icon: IconData; title: string; description: string; action?: ReactNode }) {
  return (
    <div data-slot="empty-state" className="grid justify-items-center gap-1.5 px-4 py-8 text-center">
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-tray text-fg-3"><Icon icon={icon} size={20} className="size-5" /></span>
      <p className="text-title-3 text-fg">{title}</p>
      <p className="max-w-[40ch] text-body-sm text-fg-3">{description}</p>
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

/** Error with no data (spec §5.13): same layout, Down icon; what failed, why + next step, last good data time, "Try again". `detail` = raw source text, muted. */
export function ErrorState({ title, cause, lastGood, onRetry, action, detail }: {
  title: string; cause: string; lastGood?: number | null; onRetry?: () => void;
  /** Another next step in place of "Try again" (e.g. "Reload page" when retrying can't help). */
  action?: ReactNode;
  detail?: string | null;
}) {
  return (
    <div role="alert" data-slot="error-state" className="grid justify-items-center gap-1.5 px-4 py-8 text-center">
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-down-soft text-down-ink"><Icon icon={WarningIcon} size={20} className="size-5" /></span>
      <p className="text-title-3 text-fg">{title}</p>
      <p className="max-w-[44ch] text-body-sm text-fg-2">{cause}{lastGood ? ` Last updated ${formatDateTimeLong(lastGood)}.` : ""}</p>
      {action ? <div className="mt-1.5">{action}</div> : onRetry && <Button size="sm" variant="secondary" className="mt-1.5" onClick={onRetry}><Icon icon={RefreshIcon} />Try again</Button>}
      {detail && <p className="max-w-[60ch] font-mono text-caption break-words text-fg-3">Detail: {detail}</p>}
    </div>
  );
}

/**
 * Panel-level data age (spec §5.13) for the Panel `footnote`: "Data from 14:02 WIB · Metrics". Without a
 * source: "Updated 3 min ago · <long date>".
 */
export function StaleNote({ at, source }: { at: number; source?: string }) {
  if (source) return <span className="text-caption text-fg-3">Data from {formatTime(at)} {APP_TIME_ZONE_LABEL} · {source}</span>;
  return <span className="text-caption text-fg-3">Updated · {formatRelative(at)} · {formatDateTimeLong(at)}</span>;
}
