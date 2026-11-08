"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Icon } from "../ui/icon";
import { ChevronDownIcon } from "../ui/icons";
import { Panel } from "./panel";

export function Radio({ label, description, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label: string; description?: string }) {
  const id = useId();
  return <label data-slot="radio" className={cn("relative flex min-h-8 cursor-pointer items-start gap-3 text-body pointer-coarse:min-h-11 has-disabled:cursor-not-allowed has-disabled:opacity-50", className)}>
    <input {...props} type="radio" aria-describedby={description ? id : props["aria-describedby"]} onChange={props.readOnly ? undefined : props.onChange} onClick={props.readOnly ? e => e.preventDefault() : props.onClick} className="peer absolute mt-1 size-4 cursor-inherit opacity-0" />
    <span data-slot="radio-mark" aria-hidden="true" className="pointer-events-none mt-1 grid size-4 shrink-0 place-items-center rounded-full border border-control-border bg-card peer-checked:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"><span className="size-2 rounded-full bg-primary" /></span>
    <span className="grid gap-2">{label}{description && <span id={id} className="text-body-sm text-fg-2">{description}</span>}</span>
  </label>;
}
export function RadioGroup({ legend, name, value, onValueChange, options, disabled, error }: {
  legend: string; name?: string; value: string; onValueChange: (value: string) => void;
  options: readonly { value: string; label: string; description?: string; disabled?: boolean }[]; disabled?: boolean; error?: string;
}) {
  const id = useId();
  return <fieldset disabled={disabled} aria-describedby={error ? id : undefined} className="grid min-w-0 gap-3"><legend className="mb-3 text-label">{legend}</legend>
    {options.map((o) => <Radio key={o.value} name={name ?? id} value={o.value} label={o.label} description={o.description} checked={value === o.value} onChange={() => onValueChange(o.value)} disabled={o.disabled} aria-invalid={!!error || undefined} />)}
    {error && <p id={id} className="text-caption text-down-ink">{error}</p>}
  </fieldset>;
}
export function ChoiceCard(props: ComponentProps<typeof Radio>) {
  return <div className="rounded-xl border border-line bg-tray p-tray"><Radio {...props} className={cn("rounded-lg border border-control-border bg-card p-4 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-3 has-focus-visible:ring-primary-soft", props.className)} /></div>;
}
export function Switch({ className, ...props }: Omit<ComponentProps<"input">, "type" | "role">) {
  return <label data-slot="switch" className={cn("relative inline-flex h-8 w-10 shrink-0 items-center justify-center pointer-coarse:size-11", className)}>
    <input {...props} onChange={props.readOnly ? undefined : props.onChange} onClick={props.readOnly ? e => e.preventDefault() : props.onClick} type="checkbox" role="switch" className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
    <span aria-hidden="true" className="h-4.5 w-7.5 rounded-full border border-control-border bg-fg-3 transition-colors duration-(--dur-fast) peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-50" />
    <span aria-hidden="true" className="pointer-events-none absolute left-1.75 pointer-coarse:left-2.25 size-3.5 rounded-full bg-card transition-transform duration-(--dur-fast) peer-checked:translate-x-3 peer-disabled:opacity-50" />
  </label>;
}
export function SettingsRow({ title, description, children, reason }: { title: string; description: string; children: ReactNode; reason?: string }) {
  return <Panel><div className="flex items-center gap-6"><div className="grid min-w-0 flex-1 gap-1.5"><h3 className="text-label">{title}</h3><p className="text-body-sm text-fg-2">{description}</p>{reason && <p className="text-caption text-fg-3">{reason}</p>}</div>{children}</div></Panel>;
}
/** Controlled disclosure: set open when its form contains an error. Content stays mounted to preserve drafts. */
export function Accordion({ title, open, onOpenChange, children, disabled }: { title: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; disabled?: boolean }) {
  const id = useId();
  return <Panel><h3><button data-slot="accordion-trigger" type="button" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)} className="flex min-h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left text-label disabled:opacity-50">{title}<Icon icon={ChevronDownIcon} className={cn("size-4 transition-transform duration-(--dur-fast)", open && "rotate-180")} /></button></h3><div id={id} hidden={!open} className="animate-reveal-in pt-3 text-body text-fg-2">{children}</div></Panel>;
}
export function Slider({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <input data-slot="slider" {...props} type="range" className={cn("h-8 w-full cursor-pointer accent-primary disabled:opacity-50", className)} />;
}
