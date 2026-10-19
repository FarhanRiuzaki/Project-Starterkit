"use client";

import { useId } from "react";
import { Icon } from "../ui/icon";
import { InfoIcon } from "../ui/icons";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import type { Health } from "../lib/status";
import { StatusIcon } from "./status-chip";

const TITLE = "What these statuses mean";

export type LegendItem = { health: Health; label: string; description?: string };

/** The legend body: one vertical list, the same in every status guide (per card or per page). */
export function StatusLegendList({ items }: { items: readonly LegendItem[] }) {
  return (
    <dl className="grid gap-2">
      {items.map((e) => (
        <div key={e.label} className="grid gap-0.5">
          <dt className="flex items-center gap-2 text-label text-fg"><StatusIcon health={e.health} />{e.label}</dt>
          {e.description && <dd className="pl-5 text-body-sm text-fg-2">{e.description}</dd>}
        </div>
      ))}
    </dl>
  );
}

/**
 * Explains every status a page or card shows. Always a popover.
 * `popover` (default): "Status guide" button (size sm, secondary). Place it in the PageHeader actions slot.
 * `icon`: icon-only trigger (28 px ghost, tooltip) for the top-right of the card or table that shows these statuses:
 *   the Panel `actions` slot (last), or the Toolbar `end`. The legend never renders in place under content.
 */
export function StatusLegend({ items, variant = "popover", className }: {
  items: readonly LegendItem[];
  variant?: "popover" | "icon"; className?: string;
}) {
  const headingId = useId();
  const trigger = variant === "icon" ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" className={className} aria-label={`Status guide: ${items.map((i) => i.label).join(", ")}`}>
            <Icon icon={InfoIcon} />
          </Button>
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent>Status guide</TooltipContent>
    </Tooltip>
  ) : (
    <PopoverTrigger asChild>
      <Button variant="secondary" size="sm" className={className}><Icon icon={InfoIcon} />Status guide</Button>
    </PopoverTrigger>
  );
  return (
    <Popover>
      {trigger}
      <PopoverContent aria-labelledby={headingId} tabIndex={0} className="grid gap-3 focus-visible:outline-2 focus-visible:outline-primary">
        <h2 id={headingId} className="text-title-3 text-fg">{TITLE}</h2>
        <StatusLegendList items={items} />
      </PopoverContent>
    </Popover>
  );
}
