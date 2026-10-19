"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "../ui/icon";
import { InfoIcon } from "../ui/icons";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import type { Health } from "../lib/status";
import { StatusIcon } from "./status-chip";

const TITLE = "What these statuses mean";

export type LegendItem = { health: Health; label: string; description?: string };

/** The legend body: one vertical list, the same in every card. */
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
 * Explains every status a card shows: an icon-only info button (28 px ghost, tooltip "Status legend") opening a
 * popover with the list. Rendered only by `Panel` (its `legend` prop) at the end of the card header; never on a page,
 * a toolbar or inline (architecture test).
 */
export function StatusLegend({ items }: { items: readonly LegendItem[] }) {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  // Closing the popover with Escape or the button returns focus to the trigger; that focus must not pop the tooltip
  // back up, so it stays quiet until focus or the pointer leaves the button. A click outside moves focus away (Radix
  // doesn't return it), so nothing is quieted then: the next hover shows the tooltip as usual.
  const quiet = useRef(false);
  const outside = useRef(false);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); setTip(false); if (!o) quiet.current = !outside.current; outside.current = false; }}>
      <Tooltip open={tip} onOpenChange={(t) => setTip(t && !open && !quiet.current)}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Status legend: ${items.map((i) => i.label).join(", ")}`}
              onBlur={() => { quiet.current = false; }} onPointerLeave={() => { quiet.current = false; }}>
              <Icon icon={InfoIcon} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Status legend</TooltipContent>
      </Tooltip>
      <PopoverContent aria-labelledby={headingId} tabIndex={0} onInteractOutside={() => { outside.current = true; }} className="grid gap-3 focus-visible:outline-2 focus-visible:outline-primary">
        <h2 id={headingId} className="text-title-3 text-fg">{TITLE}</h2>
        <StatusLegendList items={items} />
      </PopoverContent>
    </Popover>
  );
}
