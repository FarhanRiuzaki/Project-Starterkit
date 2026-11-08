"use client";
import { useId, useRef, type ReactNode } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Checkbox } from "./checkbox";
import { Field } from "./field";
import { Fieldset } from "./form-layout";

export function CheckboxGroup({ legend, options, value, onValueChange, error }: { legend: string; options: readonly { value: string; label: string; reason?: string }[]; value: readonly string[]; onValueChange: (value: string[]) => void; error?: string }) {
  return <Fieldset legend={legend} description={error}><div className="grid gap-2">{options.map((o) => <div key={o.value} className="flex items-center gap-2"><Checkbox label={o.label} checked={value.includes(o.value)} reason={o.reason} onToggle={() => onValueChange(value.includes(o.value) ? value.filter((v) => v !== o.value) : [...value, o.value])} /><span className="text-body" aria-hidden="true">{o.label}</span></div>)}</div></Fieldset>;
}
/** Stable row ids belong to the caller, never array indexes. Focus follows add/remove. */
export function RepeatableField({ legend, rows, render, onAdd, onRemove, max = 20, addLabel = "Add another" }: { legend: string; rows: readonly { id: string }[]; render: (id: string, index: number) => ReactNode; onAdd: () => void; onRemove: (id: string) => void; max?: number; addLabel?: string }) {
  const region = useRef<HTMLDivElement>(null), add = useRef<HTMLButtonElement>(null);
  function focus(index: number) { requestAnimationFrame(() => { const row = region.current?.children[index]; (row?.querySelector<HTMLElement>("input, select, textarea, button") ?? add.current)?.focus(); }); }
  return <Fieldset legend={legend}><div ref={region} className="grid gap-3">{rows.map((r, i) => <div key={r.id} className="flex items-end gap-3"><div className="min-w-0 flex-1">{render(r.id, i)}</div><Button type="button" variant="secondary" aria-label={`Remove item ${i + 1}`} onClick={() => { onRemove(r.id); focus(Math.max(0, i - 1)); }}>Remove</Button></div>)}</div><Button ref={add} type="button" variant="secondary" disabled={rows.length >= max} className="justify-self-start" onClick={() => { onAdd(); focus(rows.length); }}>{addLabel}</Button></Fieldset>;
}
export function FilterRule({ properties, operators, property, operator, value, onChange, error, disabled }: {
  properties: readonly { value: string; label: string }[]; operators: readonly { value: string; label: string }[];
  property: string; operator: string; value: string; onChange: (rule: { property: string; operator: string; value: string }) => void; error?: string; disabled?: boolean;
}) {
  const id = useId(), rule = { property, operator, value };
  return <fieldset disabled={disabled} className="grid min-w-0 gap-3"><legend className="sr-only">Filter rule</legend><div className="grid gap-6 md:grid-cols-[1fr_1fr_2fr]">
    <Field id={`${id}-property`} label="Property"><Select id={`${id}-property`} value={property} onChange={(e) => onChange({ ...rule, property: e.target.value })}>{properties.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
    <Field id={`${id}-operator`} label="Operator"><Select id={`${id}-operator`} value={operator} onChange={(e) => onChange({ ...rule, operator: e.target.value })}>{operators.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
    <Field id={`${id}-value`} label="Value" note={error}><Input id={`${id}-value`} value={value} aria-invalid={!!error || undefined} onChange={(e) => onChange({ ...rule, value: e.target.value })} /></Field>
  </div></fieldset>;
}
