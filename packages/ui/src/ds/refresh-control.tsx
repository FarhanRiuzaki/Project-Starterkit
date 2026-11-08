"use client";

import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { RefreshIcon, ChevronDownIcon } from "../ui/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useDelayedFlag } from "../motion";

export const REFRESH_INTERVALS = [0, 10, 30, 60, 300] as const;
export type RefreshInterval = number;

/** One shared split control. The caller owns scheduling, query scope and pause policy. */
export function RefreshControl({ interval, onInterval, onRefresh, busy, paused }: {
  interval: RefreshInterval; onInterval: (value: RefreshInterval) => void; onRefresh: () => void;
  busy: boolean; paused?: string;
}) {
  const shownBusy = useDelayedFlag(busy);
  return <div data-slot="refresh-control" className="flex h-8 shrink-0 items-center rounded-md border border-line-strong bg-card" title={paused}>
    <Button variant="ghost" size="icon" aria-label="Refresh now" aria-busy={shownBusy || undefined} disabled={busy || !!paused} onClick={onRefresh} className="h-full rounded-r-none border-0">
      <Icon icon={RefreshIcon} className={shownBusy ? "motion-safe:animate-spin" : undefined} />
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" variant="ghost" aria-label="Auto-refresh interval" disabled={!!paused} className="h-full w-22 justify-between rounded-l-none border-0 border-l border-line text-body-sm">
        {paused ? "Paused" : interval === 0 ? "Off" : interval < 60 ? `${interval}s` : `${interval / 60}m`}<Icon data-slot="disclosure-icon" icon={ChevronDownIcon} className="size-3" />
      </Button></DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Auto-refresh interval" className="w-44">
        <DropdownMenuRadioGroup value={String(interval)} onValueChange={(value) => onInterval(Number(value) as RefreshInterval)}>
          {REFRESH_INTERVALS.map((n) => <DropdownMenuRadioItem key={n} value={String(n)}>{n === 0 ? "Off" : n < 60 ? `Every ${n} seconds` : `Every ${n / 60} minute${n > 60 ? "s" : ""}`}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    {paused && <span className="sr-only">{paused}</span>}
  </div>;
}
