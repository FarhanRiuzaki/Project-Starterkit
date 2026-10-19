"use client";

import type { ReactNode } from "react";
import { Icon } from "../ui/icon";
import { ChevronDownIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * Toolbar row (spec §5.6): search (grows) · filter menus · status segmented with counts · view toggle · Export
 * (secondary) right-most. Put the right-aligned group in `end`. Wraps under 1280 px; never scrolls sideways.
 */
export function Toolbar({ children, end, className }: { children: ReactNode; end?: ReactNode; className?: string }) {
  return (
    <div data-slot="toolbar" className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      {children}
      {end && <div className="ml-auto flex flex-wrap items-center gap-2">{end}</div>}
    </div>
  );
}

/**
 * Filter dropdown rendered as "Status: Any ▾" (prefix fg-3, value fg), single choice. The trigger's accessible name
 * reads the same ("Status: Any").
 */
export function FilterMenu<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" aria-label={`${label}: ${current}`} className="gap-1 px-2.5 text-body-sm font-normal">
          <span className="text-fg-3">{label}:</span><span className="font-medium text-fg">{current}</span>
          <Icon icon={ChevronDownIcon} className="size-3.5 text-fg-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => { const o = options.find((x) => x.value === v); if (o) onChange(o.value); }}>
          {options.map((o) => <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
