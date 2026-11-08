"use client";

import { FilterChip } from "./badges";
import { useState } from "react";
import { Button } from "../ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Icon } from "../ui/icon";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "../ui/icons";

/** Searchable controlled selection; use query/onQuery for server options, never filter a server page locally. */
export function CommandCombobox({ id, label, options, value, onValueChange, multiple = false, disabled, loading, error, onRetry, query, onQuery, "aria-describedby": describedBy }: {
  id?: string; label: string; options: readonly { value: string; label: string; disabled?: boolean }[];
  value: readonly string[]; onValueChange: (value: string[]) => void; multiple?: boolean; disabled?: boolean;
  loading?: boolean; error?: string; onRetry?: () => void; query?: string; onQuery?: (query: string) => void; "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ");
  return <div className="grid min-w-0 gap-2"><Popover open={open} onOpenChange={setOpen} modal>
    <PopoverTrigger asChild><Button id={id} type="button" variant="secondary" disabled={disabled} aria-label={`${label}: ${selected || "Choose"}`} aria-describedby={describedBy} className="w-full min-w-0 justify-start border-control-border font-normal">
      <Icon icon={SearchIcon} /><span className="flex-1 truncate text-left">{selected || "Search…"}</span><Icon data-slot="disclosure-icon" icon={ChevronDownIcon} />
    </Button></PopoverTrigger>
    <PopoverContent aria-label={label} align="start" className="p-0">
      <Command shouldFilter={!onQuery} label={label}>
        <CommandInput aria-label={`Search ${label}`} value={query} onValueChange={onQuery} placeholder="Search…" />
        <CommandList aria-label={label}>
          {loading ? <p role="status" className="p-4 text-body-sm text-fg-2">Searching…</p> : error ? <div role="alert" className="grid gap-2 p-4 text-body-sm"><p>{error}</p>{onRetry && <Button type="button" variant="secondary" onClick={onRetry}>Retry</Button>}</div> : <>
            <CommandEmpty>No matching options.</CommandEmpty>
            {options.map((o) => <CommandItem key={o.value} value={o.value} keywords={[o.label]} disabled={o.disabled} onSelect={() => { onValueChange(multiple ? value.includes(o.value) ? value.filter((v) => v !== o.value) : [...value, o.value] : [o.value]); if (!multiple) setOpen(false); }}>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>{value.includes(o.value) && <><Icon icon={CheckIcon} /><span className="sr-only">Selected</span></>}
            </CommandItem>)}
          </>}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>{multiple && value.length > 0 && <div className="flex flex-wrap gap-2">{value.map((v) => <FilterChip key={v} monospace={false} disabled={disabled} removeLabel={`Remove ${options.find((o) => o.value === v)?.label ?? v}`} onRemove={() => { if (!disabled) onValueChange(value.filter((x) => x !== v)); }}>{options.find((o) => o.value === v)?.label ?? v}</FilterChip>)}</div>}</div>;
}
