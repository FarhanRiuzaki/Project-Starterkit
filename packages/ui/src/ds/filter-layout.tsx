"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { CloseIcon } from "../ui/icons";
import { CountBadge, FilterChip } from "./badges";
import { FilterSheet, InFilterSheet } from "./filter-sheet";
import { Panel } from "./panel";
import { Field } from "./field";
import { QueryInput } from "./query-input";

/** The shared search control with a visible label and synchronous draft updates for an Apply form. */
export function FilterSearch({ label, value, onChange, placeholder, maxLength }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; maxLength?: number;
}) {
  const id = useId();
  return <Field id={id} label={label}><QueryInput id={id} immediate value={value} onChange={onChange} keys={[]} label={label} placeholder={placeholder} maxLength={maxLength} /></Field>;
}

export type FilterField<K extends string = string> = { key: K; label: string; format?: (value: string) => string };

/**
 * Module filters: 320 px floating tray in a reserved desktop gutter; deferred dialog/sheet below xl.
 * URL-owned values are the applied truth. Draft edits survive Close, but external changes (Back, a chip or a view)
 * replace the draft. Apply is atomic, including a search's last keystroke. Header time/refresh are never copied here.
 */
export function FilterLayout<F extends Record<string, string>>({ values, defaults, fields, onApply, filters, children, description = "Narrow this list to the results you need." }: {
  values: F; defaults: F; fields: readonly FilterField<keyof F & string>[]; onApply: (values: F) => void;
  filters: (draft: F, patch: (values: Partial<F>) => void) => ReactNode;
  children: (parts: { trigger: ReactNode; summary: ReactNode; isOpen: boolean }) => ReactNode; description?: string;
}) {
  const signature = JSON.stringify(values);
  const [synced, setSynced] = useState(signature);
  const [draft, setDraft] = useState(values);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  if (synced !== signature) {
    setSynced(signature);
    // Acknowledging our own Apply must not erase text typed while the URL update was pending.
    if (pendingSignature !== signature) setDraft(values);
    setPendingSignature(null);
  }
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => { if (open) headingRef.current?.focus({ preventScroll: true }); }, [open]);
  const active = fields.filter(({ key }) => values[key] !== defaults[key]);
  const dirty = fields.some(({ key }) => (draft[key] ?? "").trim() !== values[key]);
  const patch = (next: Partial<F>) => setDraft(d => ({ ...d, ...next }));
  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  const commit = () => {
    const next = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()])) as F;
    setDraft(next);
    setPendingSignature(JSON.stringify(next));
    onApply(next);
  };
  const actions = <>
    <Button type="button" variant="secondary" onClick={() => setDraft(defaults)}>Reset all</Button>
    <Button type="submit" className="flex-1" disabled={!dirty} title={!dirty ? "No unapplied changes" : undefined}>{dirty ? "Apply filters" : "Applied"}</Button>
  </>;
  const trigger = <>
    <Button ref={triggerRef} variant="secondary" className={cn("hidden xl:inline-flex", active.length > 0 && "border-primary/30 bg-primary-soft text-primary-ink")}
      aria-label={active.length ? `Filters, ${active.length} active` : undefined} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(v => !v)}>
      Filters{active.length > 0 && <CountBadge>{active.length}</CountBadge>}
    </Button>
    <FilterSheet active={active.length} triggerClassName={cn("xl:hidden", active.length > 0 && "border-primary/30 bg-primary-soft text-primary-ink")}
      open={sheetOpen} onOpenChange={setSheetOpen} description={description} actions={actions}
      onSubmit={e => { e.preventDefault(); commit(); setSheetOpen(false); }}>
      {filters(draft, patch)}
      <p className="text-caption text-fg-3">{dirty ? "Changes are ready to apply." : "No unapplied changes."}</p>
    </FilterSheet>
  </>;
  const summary = active.length > 0 && <div data-slot="filter-active-summary" className="flex flex-wrap items-center gap-2 border-b border-line bg-card px-3 py-2">
    <span className="text-label text-fg-2">Active filters</span>
    {active.map(({ key, label, format }) => {
      const value = values[key] ?? "";
      const text = `${label}: ${format ? format(value) : value}`;
      return <FilterChip key={key} monospace={false} removeLabel={`Remove filter ${text}`} onRemove={() => onApply({ ...values, [key]: defaults[key] })}>{text}</FilterChip>;
    })}
    <Button variant="ghost" size="sm" onClick={() => onApply(defaults)}>Clear filters</Button>
  </div>;
  return <div data-slot="filter-layout" data-filters-open={open || undefined} className="group/filter-layout flex min-w-0 items-start gap-6">
    <div className="min-w-0 flex-1">{children({ trigger, summary, isOpen: open })}</div>
    <span role="status" className="sr-only">{active.length ? `${active.length} active ${active.length === 1 ? "filter" : "filters"}.` : "No active filters."}</span>
    {open && <aside id={id} aria-label="Filters" data-slot="floating-filters" className="sticky top-4 hidden w-80 shrink-0 xl:block animate-pop"
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }}>
      <Panel className="shadow-overlay" bodyClassName="p-0">
        <form onSubmit={e => { e.preventDefault(); commit(); }} className="flex max-h-[calc(100dvh-8rem)] flex-col">
          <div className="shrink-0 p-4 pb-0">
            <div className="flex items-center gap-2">
              <h2 ref={headingRef} tabIndex={-1} className="flex-1 text-title-2 outline-none">Filters</h2>
              {active.length > 0 && <CountBadge>{active.length}</CountBadge>}
              <Button type="button" size="icon" variant="secondary" aria-label="Close filters" onClick={close}><Icon icon={CloseIcon} /></Button>
            </div>
            <p className="mt-3 border-b border-line pb-4 text-body-sm text-fg-2">{description}</p>
          </div>
          <InFilterSheet.Provider value>
            <div className="scroll-quiet grid min-h-0 gap-4 overflow-y-auto overscroll-contain p-4">{filters(draft, patch)}</div>
          </InFilterSheet.Provider>
          <div className="shrink-0 px-4 pb-4">
            <p className="mb-3 text-caption text-fg-3">{dirty ? "Changes are ready to apply." : "No unapplied changes."}</p>
            <div className="flex gap-2">{actions}</div>
          </div>
        </form>
      </Panel>
    </aside>}
  </div>;
}
