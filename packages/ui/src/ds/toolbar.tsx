"use client";

import { type ReactNode, useContext } from "react";
import { Icon } from "../ui/icon";
import { ChevronDownIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { FilterSheet, InFilterSheet } from "./filter-sheet";

/**
 * Toolbar row (spec §5.6): search (grows) · filter menus · status segmented with counts · view toggle · Export
 * (secondary) right-most. Put the right-aligned group in `end`. Wraps under 1280 px; never scrolls sideways.
 * On a phone the search stays in the row and the other filters sit in `ToolbarFilters` (a "Filters" sheet).
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
 * The toolbar's filters other than the search. From 768 px they render inline, in the order given; below 768 px a
 * "Filters" button with the `active` count opens them in a bottom sheet (FilterSheet), where a `FilterMenu` becomes a
 * labelled select. The same controls and handlers either way, so the URL state is the same.
 */
export function ToolbarFilters({ active, children }: { active: number; children: ReactNode }) {
  return (
    <>
      <div data-slot="toolbar-filters" className="contents max-md:hidden">{children}</div>
      <FilterSheet active={active}>{children}</FilterSheet>
    </>
  );
}

/**
 * Filter dropdown rendered as "Status: Any ▾" (prefix fg-3, value fg), single choice. The trigger's accessible name
 * reads the same ("Status: Any").
 */
export function FilterMenu<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  const inSheet = useContext(InFilterSheet);
  const current = options.find((o) => o.value === value)?.label ?? value;
  if (inSheet) {
    return (
      <label className="grid gap-1.5 text-label text-fg-2">
        {label}
        <Select value={value} onChange={(e) => { const o = options.find((x) => x.value === e.target.value); if (o) onChange(o.value); }}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </label>
    );
  }
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
