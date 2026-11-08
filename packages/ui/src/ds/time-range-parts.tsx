"use client";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { ChevronDownIcon } from "../ui/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

/** The same custom select is used by quick, relative and refresh editors. */
export function TimeRangeSelect({ label, value, options, onChange, disabled, className }: {
  label: string; value: string; options: readonly { value: string; label: string }[];
  onChange: (value: string) => void; disabled?: boolean; className?: string;
}) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="secondary" disabled={disabled} aria-label={label} className={`min-w-0 justify-between text-body-sm ${className ?? ""}`}>{options.find(option => option.value === value)?.label}<Icon data-slot="disclosure-icon" icon={ChevronDownIcon} className="size-3" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent onFocus={event => { if (event.target !== event.currentTarget) return; const selected = event.currentTarget.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]'); if (selected) { event.preventDefault(); selected.focus(); requestAnimationFrame(() => { if (selected.isConnected) selected.scrollIntoView({ block: "center" }); }); } }}><DropdownMenuRadioGroup value={value} onValueChange={onChange}>{options.map(option => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent>
  </DropdownMenu>;
}
