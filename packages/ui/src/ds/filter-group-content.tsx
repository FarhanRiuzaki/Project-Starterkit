"use client";

import { type ReactNode, useContext, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { ChevronDownIcon } from "../ui/icons";
import { cn } from "../lib/cn";
import { FILTER_SELECTION_MAX, selectionState, selectionValues } from "../lib/filter-selection";
import { FilterFocusId, FilterGroups, type FilterChecksProps, type FilterSearchProps } from "./filter-group";
import { Checkbox } from "./checkbox";
import { Input } from "../ui/input";
import { Field } from "./field";
import { QueryInput } from "./query-input";
import { CountBadge } from "./badges";

export function FilterGroupContent({ label, value, children, forceOpen = false, count = 0 }: { label: string; value: string; children: ReactNode; forceOpen?: boolean; count?: number }) {
  const groups = useContext(FilterGroups);
  const prefix = useContext(FilterFocusId);
  const generated = useId();
  const id = `${prefix || generated}-group-${encodeURIComponent(label)}`;
  if (!groups) return children;
  const open = forceOpen || !groups.collapsed[label];
  return <div data-slot="filter-group" className="min-w-0 border-t border-line pt-3">
    <Button id={id} type="button" variant="ghost" className="h-auto min-h-8 w-full justify-between gap-2 whitespace-normal px-0 text-left"
      aria-expanded={open} aria-controls={`${id}-body`} onClick={() => groups.toggle(label)}>
      <span className="flex items-center gap-2">{label}{count > 0 && <CountBadge>{count}</CountBadge>}</span><Icon icon={ChevronDownIcon} className={cn("size-4 transition-transform duration-(--dur-fast)", open && "rotate-180")} />
    </Button>
    {!open && value && <p className="mt-1 break-words text-body-sm text-fg-2">{value}</p>}
    <div id={`${id}-body`} hidden={!open} className="pt-3">{children}</div>
  </div>;
}

export function FilterChecksContent({ label, value, options, onChange, search }: FilterChecksProps) {
  const prefix = useContext(FilterFocusId);
  const selected = selectionValues(value);
  const selectedRef = useRef(selected);
  useLayoutEffect(() => { selectedRef.current = selected; }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- canonical selection state owns this snapshot
  const [term, setTerm] = useState("");
  const [all, setAll] = useState(false);
  const query = search?.value ?? term;
  const available = options.filter(option => option.value !== "");
  const shown = search ? available : available.filter(option => option.label.toLowerCase().includes(query.toLowerCase()));
  const visible = all || search || query ? shown : shown.slice(0, 6);
  const missing = selected.filter(item => !available.some(option => option.value === item)).map(item => ({ value: item, label: item }));
  const choices = [...missing, ...visible];
  const summary = selected.map(item => available.find(option => option.value === item)?.label ?? item).join(", ");
  const limit = selected.length >= FILTER_SELECTION_MAX;
  return <FilterGroupContent label={label} count={selected.length} value={summary} forceOpen={!!search?.error}>
    <div className="grid min-w-0 gap-2">
      {(search || available.length > 6) && <label className="grid gap-1.5 text-label text-fg-2">
        <span className="sr-only">Search {label.toLowerCase()} options</span>
        <Input id={`${prefix}-${label}-options-search`} aria-label={`Search ${label.toLowerCase()} options`} value={query} placeholder={`Search ${label.toLowerCase()} options`}
          onChange={e => { if (search) search.onChange(e.target.value); else setTerm(e.target.value); }} />
      </label>}
      {search?.loading && <p role="status" className="text-body-sm text-fg-2">Loading options…</p>}
      {search?.error && <div className="grid gap-2"><p role="alert" className="text-body-sm text-down-ink">Couldn&apos;t load options. Your selections are kept.</p><Button type="button" variant="secondary" onClick={search.onRetry}>Retry options</Button></div>}
      {choices.map(option => {
        const checked = selected.includes(option.value);
        const id = `${prefix}-${encodeURIComponent(label)}-${encodeURIComponent(option.value)}`;
        return <label key={option.value} htmlFor={id} data-filter-commit className="flex min-h-8 cursor-pointer items-center gap-2 text-body pointer-coarse:min-h-11">
          <Checkbox id={id} label={option.label} checked={checked} reason={!checked && limit ? `Choose up to ${FILTER_SELECTION_MAX} selections. Remove one to add another.` : undefined}
            onToggle={() => {
              const before = selectedRef.current;
              const wasChecked = before.includes(option.value);
              if (!wasChecked && before.length >= FILTER_SELECTION_MAX) return;
              const next = wasChecked ? before.filter(item => item !== option.value) : [...before, option.value];
              selectedRef.current = next;
              onChange(selectionState(next));
            }} />
          <span className="min-w-0 break-words">{option.label}</span>
        </label>;
      })}
      {!search?.loading && !search?.error && !choices.length && <p className="text-body-sm text-fg-2">No options match. Change the search.</p>}
      {limit && <p className="text-caption text-fg-2">Choose up to {FILTER_SELECTION_MAX} selections. Remove one to add another.</p>}
      {!search && !query && shown.length > 6 && <Button type="button" variant="link" size="sm" onClick={() => setAll(v => !v)}>{all ? "Show less" : "Show more"}</Button>}
      {search?.more && <Button type="button" variant="secondary" disabled={search.loading} onClick={search.onMore}>Load more options</Button>}
    </div>
  </FilterGroupContent>;
}

export function FilterSearchContent({ label, value, onChange, placeholder, maxLength, onCommit }: FilterSearchProps) {
  const prefix = useContext(FilterFocusId);
  const generated = useId();
  const id = `${prefix || generated}-search-${encodeURIComponent(label)}`;
  return <div onBlur={e => {
    if (!e.relatedTarget || (e.relatedTarget as Element).closest('[data-filter-commit], [data-filter-clear], [data-filter-collapse]')) return;
    onCommit();
  }}><Field id={id} label={label}><QueryInput id={id} immediate value={value} onChange={onChange} keys={[]} label={label} placeholder={placeholder} maxLength={maxLength} /></Field></div>;
}
