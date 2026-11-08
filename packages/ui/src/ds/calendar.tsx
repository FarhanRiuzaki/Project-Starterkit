"use client";

import { useId, useRef, useState, type ComponentProps } from "react";
import { cn } from "../lib/cn";
import { appDate } from "../lib/format";
import { calendarDays, calendarKey, moveMonth, validDate } from "../lib/calendar";
import type { DateRange } from "../lib/date-range";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";
import { TimeRangeSelect } from "./time-range-parts";

const monthName = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" });
const dateName = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, "0"), label: new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, i, 1))) }));
export function CalendarDay({ selected, today, outside, inRange, className, ...props }: ComponentProps<"button"> & { selected?: boolean; today?: boolean; outside?: boolean; inRange?: boolean }) {
  return <button data-slot="calendar-day" data-selected={selected || undefined} type="button" {...props} aria-current={today ? "date" : undefined} className={cn("press-feedback inline-grid h-8 w-full cursor-pointer place-items-center rounded-sm border border-transparent text-body-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:h-11",
    selected ? "bg-action text-action-fg" : inRange ? "bg-primary-soft text-fg" : "enabled:hover:bg-tray", today && "border-primary", outside && !selected && "text-fg-3", className)} />;
}
/** Monday-first calendar. The caller owns dates, bounds and range composition. */
export function Calendar({ value, onValueChange, range, min, max, initialMonth, today: suppliedToday, autoFocus, label = "Choose date", className, showFooter = true }: {
  value?: string; onValueChange: (date: string) => void; range?: DateRange; min?: string; max?: string;
  initialMonth?: string; today?: string; autoFocus?: boolean; label?: string; className?: string; showFooter?: boolean;
}) {
  const [mountedToday] = useState(() => appDate(Date.now()));
  const today = suppliedToday ?? mountedToday;
  const start = value && validDate(value) ? value : initialMonth && validDate(initialMonth) ? initialMonth : today;
  const clamp = (v: string) => min && v < min ? min : max && v > max ? max : v;
  const [focus, setFocus] = useState(() => clamp(start));
  const [month, setMonth] = useState(() => clamp(start).slice(0, 7));
  const [observed, setObserved] = useState(value);
  if (value !== observed && value && validDate(value)) { setObserved(value); setFocus(clamp(value)); setMonth(clamp(value).slice(0, 7)); }
  const id = useId(), root = useRef<HTMLDivElement>(null);
  const days = calendarDays(`${month}-01`);
  const year = Number(month.slice(0, 4)), todayYear = Number(today.slice(0, 4));
  const firstYear = min ? Number(min.slice(0, 4)) : Math.max(1, Math.min(year, todayYear - 100));
  const lastYear = max ? Number(max.slice(0, 4)) : Math.min(9999, Math.max(year, todayYear + 100));
  const availableMonths = months.filter(item => (!min || `${year}-${item.value}` >= min.slice(0, 7)) && (!max || `${year}-${item.value}` <= max.slice(0, 7)));
  const move = (date: string, takeFocus: boolean) => {
    const next = clamp(date); setFocus(next); setMonth(next.slice(0, 7));
    if (takeFocus) requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());
  };
  return <div ref={root} className={cn("scroll-quiet grid w-76 max-w-full gap-3 overflow-x-auto rounded-lg border border-line bg-card p-4 pointer-coarse:w-88 pointer-coarse:p-2", className)} aria-label={label}>
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" disabled={!!min && month <= min.slice(0, 7)} onClick={() => move(moveMonth(focus, -1), false)}><Icon icon={ChevronLeftIcon} /></Button>
      <div className="flex min-w-0 flex-wrap justify-center gap-1">
        <TimeRangeSelect label="Choose month" value={month.slice(5)} options={availableMonths} className="h-7 gap-1 px-1.5" onChange={next => move(moveMonth(focus, Number(next) - Number(month.slice(5))), false)} />
        <TimeRangeSelect label="Choose year" value={String(year)} options={Array.from({ length: lastYear - firstYear + 1 }, (_, i) => ({ value: String(firstYear + i), label: String(firstYear + i) }))} className="h-7 gap-1 px-1.5 tabular" onChange={next => move(moveMonth(focus, (Number(next) - year) * 12), false)} />
      </div>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" disabled={!!max && month >= max.slice(0, 7)} onClick={() => move(moveMonth(focus, 1), false)}><Icon icon={ChevronRightIcon} /></Button>
    </div>
    <h3 id={id} aria-live="polite" className="sr-only">{monthName.format(new Date(`${month}-01T12:00:00Z`))}</h3>
    <div role="grid" aria-labelledby={id} className="grid gap-2">
      <div role="row" className="grid grid-cols-7 gap-1 pointer-coarse:gap-0">{week.map(d => <span key={d} role="columnheader" aria-label={d} className="text-center text-caption text-fg-3">{d.slice(0, 1)}</span>)}</div>
      {Array.from({ length: 6 }, (_, row) => <div key={row} role="row" className="grid grid-cols-7 gap-1 pointer-coarse:gap-0">{days.slice(row * 7, row * 7 + 7).map(date => {
        const selected = range ? date === range.from || date === range.to : date === value;
        const inRange = !!range && date > range.from && date < range.to;
        return <div key={date} role="gridcell" aria-selected={selected || inRange}>
          <CalendarDay data-date={date} tabIndex={date === focus ? 0 : -1} selected={selected} inRange={inRange} today={date === today} outside={!date.startsWith(month)}
            disabled={(!!min && date < min) || (!!max && date > max)} aria-label={dateName.format(new Date(`${date}T12:00:00Z`))}
            ref={el => { if (el && autoFocus && date === focus && !root.current?.contains(document.activeElement)) el.focus(); }}
            onFocus={() => setFocus(date)} onKeyDown={e => { const next = calendarKey(date, e.key, e.shiftKey); if (next) { e.preventDefault(); move(next, true); } }}
            onClick={() => { move(date, false); onValueChange(date); }}>{Number(date.slice(-2))}</CalendarDay>
        </div>;
      })}</div>)}
    </div>
    {showFooter && <p className="border-t border-line pt-3 text-caption text-fg-2" role="status">{range ? `${range.from || "Start date"} – ${range.to || "End date"}` : value || "Select a date"}</p>}
  </div>;
}
