import type { ReactNode } from "react";
import { Icon, type IconData } from "../ui/icon";
import { cn } from "../lib/cn";
import { CountBadge } from "./badges";
import { type LegendItem, StatusLegend } from "./status-legend";

/**
 * Panel = tray + card, the v3 signature (spec §5.4).
 * - Tray: radius 16, --tray, 1 px line, padding 4. Header on the tray: 44 px, padding 0 12, optional 16 px fg-3
 *   icon, `title-2` title, optional count pill, caption (`description`) after a middot, actions right.
 * - Card: radius 12, --card, 1 px line, shadow-xs, padding 16 (`flush` = no padding, e.g. a table: the table is
 *   the card, its header row sits on the tray tint). The card grows (`flex-1`) so siblings in a row share height.
 * - `footnote`: caption under the card (StaleNote, sources), padding 8 12.
 * - `variant="flat"`: card only (dialogs, the login card); the header then sits inside the card.
 * - `cards`: render several cards side by side inside one tray (KPI strip, legend cards): pass the cards as
 *   children and set `cards` so no outer card wraps them.
 * - `legend`: the statuses this card shows; an info button at the end of the header opens their `StatusLegend`
 *   (the only place a status legend is rendered).
 */
export function Panel({ title, description, actions, children, flush, className, icon, count, footnote, variant = "tray", cards, bodyClassName, legend }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string;
  icon?: IconData; count?: number | string; footnote?: ReactNode; variant?: "tray" | "flat"; cards?: boolean; bodyClassName?: string;
  legend?: readonly LegendItem[];
}) {
  const header = (title || actions || legend) && (
    <header className={cn("flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1", variant === "tray" ? "px-3 py-1.5" : "px-4 pt-3")}>
      {icon && <Icon icon={icon} className="size-4 shrink-0 text-fg-3" />}
      {title && <h2 className="text-title-2 text-fg">{title}</h2>}
      {count != null && <CountBadge inTray={variant === "tray"}>{count}</CountBadge>}
      {/* Phone: the description takes its own line under the title row, without the middot. */}
      {description && <p className="text-body-sm text-fg-3 max-md:order-last max-md:basis-full"><span aria-hidden="true" className="mr-2 text-fg-4 max-md:hidden">·</span>{description}</p>}
      {(actions || legend) && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}{legend && <StatusLegend items={legend} />}</div>}
    </header>
  );
  const foot = footnote && <div className="px-3 pt-2 pb-1.5 text-caption text-fg-3">{footnote}</div>;
  if (variant === "flat") {
    return (
      <section className={cn("flex min-w-0 flex-col rounded-lg border border-line bg-card shadow-card", className)}>
        {header}
        <div className={cn("min-w-0 flex-1", !flush && "p-4", flush && "overflow-hidden rounded-b-lg", bodyClassName)}>{children}</div>
        {foot}
      </section>
    );
  }
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border border-line bg-tray p-tray", className)}>
      {header}
      {cards ? <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div> : (
        <div className={cn("min-w-0 flex-1 rounded-lg border border-line bg-card shadow-card", flush ? "overflow-clip" /* clip, not hidden: a sticky bar inside (bulk actions) sticks to the page */ : "p-4", bodyClassName)}>{children}</div>
      )}
      {foot}
    </section>
  );
}
