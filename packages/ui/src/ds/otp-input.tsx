"use client";
import { useState, type ComponentProps } from "react";
import { cn } from "../lib/cn";

/** One real input keeps paste, autofill, selection and keyboard editing intact. Digit cells are decorative. */
export function OtpInput({ value, onValueChange, length = 6, className, ...props }: Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "defaultValue"> & { value: string; onValueChange: (value: string) => void; length?: number }) {
  const [cursor, setCursor] = useState(value.length);
  const syncCursor = (input: HTMLInputElement) => setCursor(input.selectionStart ?? input.value.length);
  return <div data-slot="otp-input" className={cn("relative flex w-full max-w-76 gap-2", className)}>
    <input {...props} type="text" inputMode="numeric" autoComplete="one-time-code" pattern={`[0-9]{${length}}`} maxLength={length} value={value}
      onChange={e => { const next = e.target.value.replace(/\D/g, "").slice(0, length); setCursor(Math.min(e.target.selectionStart ?? next.length, next.length)); onValueChange(next); }}
      onFocus={e => { props.onFocus?.(e); syncCursor(e.currentTarget); }} onSelect={e => { props.onSelect?.(e); syncCursor(e.currentTarget); }} onKeyUp={e => { props.onKeyUp?.(e); syncCursor(e.currentTarget); }}
      className="peer absolute inset-0 z-10 h-full w-full cursor-text opacity-0" />
    {Array.from({ length }, (_, i) => <span key={i} data-slot="otp-cell" data-filled={!!value[i]} data-current={i === Math.min(cursor, value.length, length - 1)} aria-hidden="true" className={cn("grid h-11 min-w-0 flex-1 place-items-center rounded-md border border-control-border bg-card font-mono text-body peer-disabled:opacity-50", props["aria-invalid"] && "border-down-mark")}><span key={value[i] ?? ""} className={value[i] ? "animate-swap" : undefined}>{value[i] ?? ""}</span></span>)}
  </div>;
}
