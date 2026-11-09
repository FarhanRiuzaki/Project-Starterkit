"use client";

import { type ReactNode, createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { FILTER_SEARCH_DEBOUNCE, selectionState, selectionValues } from "../lib/filter-selection";
import { Button } from "../ui/button";
import { FilterChip } from "./badges";
import { FilterPanel } from "./filter-panel";
import { FilterFocusId, FilterGroups, FilterGroupRenderer } from "./filter-group";

const FilterSearchActions = createContext({ flush: () => {} });
export const FILTER_EXTERNAL_CHANGE = "filters:external-change";

/** One SSR anchor for the first surface, including a Notice before the result. */
export function FilterSurface({ children }: { children: ReactNode }) {
  return <div data-slot="filter-surface" className="relative grid min-w-0 gap-section md:pr-16 [&_[data-slot=filter-layout]]:md:static [&_[data-slot=filter-layout]]:md:pr-0">{children}</div>;
}

/** Typed text is local immediately; the owning list commits it after the shared debounce or an explicit flush. */
export function FilterSearch({ label, value, onChange, placeholder, maxLength }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; maxLength?: number;
}) {
  const renderer = useContext(FilterGroupRenderer);
  const { flush } = useContext(FilterSearchActions);
  return renderer ? <renderer.Search label={label} value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength} onCommit={flush} /> : null;
}

export type FilterField<K extends string = string> = { key: K; label: string; format?: (value: string) => string; multiple?: boolean };

function FilterFields<F extends Record<string, string>>({ render, values, onPatch }: {
  render: (values: F, patch: (values: Partial<F>) => void) => ReactNode; values: F; onPatch: (values: Partial<F>) => void;
}) { return render(values, onPatch); }

function FilterResults({ render, summary, isOpen, flush }: { render: (parts: { summary: ReactNode; isOpen: boolean; flush: () => void }) => ReactNode; summary: ReactNode; isOpen: boolean; flush: () => void }) {
  return render({ summary, isOpen, flush });
}

/** URL-owned live filtering. JSON is internal string state only; public requests and views retain repeated values. */
export function FilterLayout<F extends Record<string, string>>({ values, defaults, fields, onApply, filters, children, busy = false, description = "Narrow this list to the results you need." }: {
  values: F; defaults: F; fields: readonly FilterField<keyof F & string>[];
  onApply: (values: F, options: { history: "push" | "replace" }) => void;
  filters: (values: F, patch: (values: Partial<F>) => void) => ReactNode;
  children: (parts: { summary: ReactNode; isOpen: boolean; flush: () => void }) => ReactNode; busy?: boolean; description?: string;
}) {
  const prefix = useId();
  const [results, setResults] = useState<HTMLDivElement | null>(null);
  const signature = JSON.stringify(values);
  const [current, setCurrent] = useState(values);
  const latest = useRef(values);
  const applied = useRef(values);
  const own = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const multiple = (key: string) => fields.some(field => field.key === key && field.multiple);
  const cancel = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };
  useLayoutEffect(() => {
    applied.current = values;
    if (own.current === signature) { own.current = null; return; }
    own.current = null; cancel(); latest.current = values; setCurrent(values);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps -- the canonical signature covers all applied values
  useEffect(() => {
    const external = () => { cancel(); latest.current = applied.current; setCurrent(applied.current); };
    const back = () => {
      cancel(); own.current = null;
      const params = new URLSearchParams(window.location.search);
      const next = { ...defaults };
      for (const { key } of fields) next[key] = (multiple(key) ? selectionState(params.getAll(key).filter(value => value !== "")) : params.get(key) ?? defaults[key]) as F[typeof key];
      applied.current = next; latest.current = next; setCurrent(next);
    };
    window.addEventListener("popstate", back);
    window.addEventListener(FILTER_EXTERNAL_CHANGE, external);
    return () => { cancel(); window.removeEventListener("popstate", back); window.removeEventListener(FILTER_EXTERNAL_CHANGE, external); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- field/default definitions are immutable for a mounted list

  const commit = (next: F, history: "push" | "replace") => {
    cancel();
    const clean = Object.fromEntries(Object.entries(next).map(([key, value]) => [key, multiple(key) ? selectionState(selectionValues(value)) : value.trim()])) as F;
    latest.current = clean; setCurrent(clean);
    if (JSON.stringify(clean) === JSON.stringify(applied.current)) return;
    own.current = JSON.stringify(clean); applied.current = clean;
    onApply(clean, { history });
  };
  const flush = () => commit(latest.current, "replace");
  const patch = (next: Partial<F>) => {
    cancel();
    const merged = { ...latest.current, ...next };
    latest.current = merged; setCurrent(merged);
    if (Object.keys(next).some(multiple)) commit(merged, "push");
    else timer.current = setTimeout(() => commit(latest.current, "replace"), FILTER_SEARCH_DEBOUNCE);
  };
  const clear = () => { cancel(); latest.current = defaults; setCurrent(defaults); commit(defaults, "push"); };
  const active = fields.flatMap(({ key, label, format }) => {
    const selections = multiple(key) ? selectionValues(values[key] ?? "") : values[key] !== defaults[key] && values[key]?.trim() ? [values[key]] : [];
    return selections.map(value => ({ key, value, text: `${label}: ${format ? format(value) : value}` }));
  });
  const canClear = fields.some(({ key }) => current[key] !== defaults[key]) || active.length > 0;
  const summary = active.length > 0 && <div data-slot="filter-active-summary" className="flex flex-wrap items-center gap-2 border-b border-line bg-card px-3 py-2">
    <span className="text-label text-fg-2">Active filters</span>
    {active.map(({ key, value, text }) => <FilterChip key={`${key}:${value}`} monospace={false} removeLabel={`Remove filter ${text}`} onRemove={() => {
      const next = { ...applied.current, [key]: multiple(key) ? selectionState(selectionValues(applied.current[key] ?? "").filter(item => item !== value)) : defaults[key] };
      commit(next, "push");
    }}>{text}</FilterChip>)}
    <Button variant="ghost" size="sm" data-filter-clear onClick={clear}>Clear all</Button>
  </div>;
  return <FilterFocusId.Provider value={prefix}><FilterSearchActions.Provider value={{ flush }}><FilterGroups.Provider value={{ collapsed, toggle: label => setCollapsed(cur => ({ ...cur, [label]: !cur[label] })) }}>
    <div data-slot="filter-layout" className="relative grid min-w-0 gap-4 md:pr-16">
      <FilterPanel anchor={results} active={active.length} open={open} onOpenChange={next => { if (!next) flush(); setOpen(next); }} description={description}
        clear={clear} canClear={canClear} onSubmit={e => { e.preventDefault(); flush(); }}>
        <FilterFields render={filters} values={current} onPatch={patch} />
      </FilterPanel>
      <div ref={setResults} data-slot="filter-results" className="min-w-0"><FilterResults render={children} summary={summary} isOpen={open} flush={flush} /></div>
      <span role="status" className="sr-only">{busy ? "Updating results…" : active.length ? `${active.length} active selections.` : "No active selections."}</span>
    </div>
  </FilterGroups.Provider></FilterSearchActions.Provider></FilterFocusId.Provider>;
}
