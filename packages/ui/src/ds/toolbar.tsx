"use client";

import { type ReactNode, useContext } from "react";
import { Icon } from "../ui/icon";
import { ChevronDownIcon, ColumnsIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { canHide, type Column, mobileRoles } from "./data-table";
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

/**
 * The table's column chooser (Carbon "Customize columns", Ant ProTable column settings, NN/g data tables): a "Columns"
 * button at the end of the toolbar (on a phone its icon, named) that says how many are hidden ("Columns · 2 hidden"),
 * and a menu of checkboxes, one per column, that stays open while ticking, plus "Reset to default". The identity column
 * (mobile title) and `hideable: false` ones are listed ticked and disabled; the row checkbox is not listed. Keyboard: the menu's own (arrows, Space
 * toggles, Esc closes). The page keeps the choice (`hidden`, per viewer in the prefs cookie) and passes it to DataTable.
 */
export function ColumnsMenu<T>({ columns, hidden, onChange }: { columns: readonly Column<T>[]; hidden: readonly string[]; onChange: (hidden: string[]) => void }) {
  const roles = mobileRoles(columns);
  // Every column but the row checkbox; the ones that can't be hidden are listed ticked and disabled (Carbon).
  const listed = columns.map((c, i) => ({ c, fixed: !canHide(c, roles[i]!) })).filter((_, i) => roles[i] !== "lead");
  if (!listed.some((x) => !x.fixed)) return null;
  const off = listed.filter((x) => !x.fixed && hidden.includes(x.c.key)).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" aria-label={off ? `Columns, ${off} hidden` : "Columns"} className="gap-1.5 px-2.5 text-body-sm font-normal">
          <Icon icon={ColumnsIcon} className="size-4 text-fg-3" />
          <span className="max-md:sr-only">Columns</span>
          {off > 0 && <span className="text-fg-3 max-md:sr-only">· {off} hidden</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {listed.map(({ c, fixed }) => (
          <DropdownMenuCheckboxItem key={c.key} checked={fixed || !hidden.includes(c.key)} disabled={fixed} onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => onChange(on ? hidden.filter((k) => k !== c.key) : [...hidden, c.key])}>{c.header}</DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!off} onSelect={() => onChange([])}>Reset to default</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
