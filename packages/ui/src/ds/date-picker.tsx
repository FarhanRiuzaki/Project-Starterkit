"use client";
import { lazy, Suspense, useId, useRef, useState, type ComponentProps } from "react";
import { validDate } from "../lib/calendar";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Icon } from "../ui/icon";
import { CalendarIcon } from "../ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
const Calendar = lazy(() => import("./calendar").then(m => ({ default: m.Calendar })));

export type DatePickerProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "defaultValue" | "onChange" | "min" | "max"> & {
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void; min?: string; max?: string; calendarLabel?: string;
};
/** ISO date input with the shared custom calendar; no browser-owned date popup. */
export function DatePicker({ value, defaultValue = "", onValueChange, min, max, calendarLabel = "Choose date", ...props }: DatePickerProps) {
  const [inner, setInner] = useState(defaultValue), [open, setOpen] = useState(false);
  const current = value ?? inner, hint = useId();
  const trigger = useRef<HTMLButtonElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const invalid = !!current && (!validDate(current) || (!!min && current < min) || (!!max && current > max));
  function update(date: string) { setInner(date); onValueChange?.(date); }
  return <div data-slot="date-picker" className="relative min-w-0">
    <Input {...props} type="text" value={current} placeholder={props.placeholder ?? "YYYY-MM-DD"} inputMode="numeric" aria-invalid={props["aria-invalid"] || invalid || undefined}
      role="combobox" aria-autocomplete="none" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${hint}-calendar` : undefined}
      aria-describedby={[props["aria-describedby"], hint].filter(Boolean).join(" ")} className={`pr-11 ${props.className ?? ""}`}
      onChange={e => update(e.target.value)} onClick={e => { props.onClick?.(e); if (!e.defaultPrevented && !props.disabled && !props.readOnly && !open) { returnFocus.current = e.currentTarget; trigger.current?.click(); } }}
      onKeyDown={e => { props.onKeyDown?.(e); if (!e.defaultPrevented && e.altKey && e.key === "ArrowDown" && !props.disabled && !props.readOnly) { e.preventDefault(); returnFocus.current = e.currentTarget; if (!open) trigger.current?.click(); } }} />
    <span id={hint} className="sr-only">YYYY-MM-DD.{min ? ` Earliest ${min}.` : ""}{max ? ` Latest ${max}.` : ""} Alt and down arrow opens the calendar.</span>
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button ref={trigger} type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0.5 my-auto pointer-coarse:size-10 pointer-coarse:right-1" aria-label={calendarLabel} disabled={props.disabled || props.readOnly} onPointerDown={e => { returnFocus.current = e.currentTarget; }} onKeyDown={e => { returnFocus.current = e.currentTarget; }}><Icon icon={CalendarIcon} /></Button></PopoverTrigger>
      <PopoverContent id={`${hint}-calendar`} aria-label={calendarLabel} className="w-auto p-0" onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => { if (returnFocus.current?.isConnected) { e.preventDefault(); returnFocus.current.focus(); } }}>
        <Suspense fallback={<p role="status" className="p-4 text-body-sm">Loading calendar…</p>}><Calendar key={open ? "open" : "closed"} autoFocus value={current} min={min} max={max} onValueChange={date => { update(date); setOpen(false); }} /></Suspense>
      </PopoverContent>
    </Popover>
  </div>;
}
