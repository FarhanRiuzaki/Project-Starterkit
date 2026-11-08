"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/** Prefix/suffix stay outside the editable value; labels and units remain in the accessible description. */
export function InputAffix({ prefix, suffix, className, ...props }: Omit<ComponentProps<typeof Input>, "prefix"> & { prefix?: string; suffix?: ReactNode }) {
  const id = useId();
  return <div data-slot="input-affix" data-disabled={props.disabled || undefined} data-readonly={props.readOnly || undefined} data-invalid={props["aria-invalid"] || undefined} className={cn("flex h-8 min-w-0 items-center pointer-coarse:h-12 gap-2 rounded-md border border-control-border bg-card px-2.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-soft", props["aria-invalid"] && "border-down-mark focus-within:border-down-mark focus-within:ring-down-soft", props.disabled && "bg-inset opacity-60", props.readOnly && "bg-inset text-fg-2", className)}>
    {prefix && <span aria-hidden="true" className="shrink-0 text-body-sm text-fg-3">{prefix}</span>}
    <Input {...props} aria-describedby={[props["aria-describedby"], id].filter(Boolean).join(" ")} className="h-full flex-1 rounded-none border-0 bg-transparent p-0 focus-visible:ring-0" />
    {suffix && <span aria-hidden="true" className="flex shrink-0 items-center text-caption text-fg-3">{suffix}</span>}
    <span id={id} className="sr-only">{prefix}{prefix && suffix ? " " : null}{suffix}</span>
  </div>;
}

export function NumberInput({ value, onValueChange, min, max, step = 1, label, className, disabled, ...props }: Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "step"> & {
  value: number | ""; onValueChange: (value: number | "") => void; min?: number; max?: number; step?: number; label: string;
}) {
  const shift = (dir: -1 | 1) => {
    const next = Number(((value === "" ? min ?? 0 : value) + dir * step).toFixed(10));
    onValueChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next)));
  };
  return <div data-slot="number-input" data-disabled={disabled || undefined} data-readonly={props.readOnly || undefined} data-invalid={props["aria-invalid"] || undefined} className={cn("flex h-10 min-w-0 items-center pointer-coarse:h-12 gap-2 rounded-md border border-control-border bg-card p-1 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-soft", props["aria-invalid"] && "border-down-mark focus-within:border-down-mark focus-within:ring-down-soft", disabled && "bg-inset opacity-60", className)}>
    <Button type="button" size="icon-sm" variant="secondary" aria-label={`Decrease ${label}`} disabled={disabled || props.readOnly || (value !== "" && min !== undefined && value <= min)} onClick={() => shift(-1)}>−</Button>
    <Input {...props} aria-label={props["aria-label"] ?? label} type="number" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={(e) => onValueChange(e.target.value === "" || !Number.isFinite(e.target.valueAsNumber) ? "" : e.target.valueAsNumber)}
      className="h-full flex-1 rounded-none border-0 bg-transparent p-0 tabular focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
    <Button type="button" size="icon-sm" variant="secondary" aria-label={`Increase ${label}`} disabled={disabled || props.readOnly || (value !== "" && max !== undefined && value >= max)} onClick={() => shift(1)}>+</Button>
  </div>;
}

export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4", className)}>{children}</div>;
}

/** Error links focus actual controls; keep field-level messages as well. */
export function FormErrorSummary({ errors }: { errors: readonly { id: string; message: string }[] }) {
  if (!errors.length) return null;
  return <div role="alert" className="rounded-md border border-down-mark bg-down-soft p-4 text-body-sm text-down-ink">
    <p className="font-medium">Check the following fields</p>
    <ul className="mt-2 list-inside list-disc">{errors.map((e) => <li key={e.id}><a href={`#${e.id}`} className="underline" onClick={() => document.getElementById(e.id)?.focus()}>{e.message}</a></li>)}</ul>
  </div>;
}
