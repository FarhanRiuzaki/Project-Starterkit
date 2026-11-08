"use client";
import { useId, useState } from "react";
import { APP_TIME_ZONE_LABEL } from "../lib/format";
import { COMMON_TIME_RANGES, TIME_UNITS, TIME_UNIT_LABELS, resolveTimeRange, timeRangeLabel, type TimeRangeValue, type TimeUnit } from "../lib/time-range";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "./form-options";
import { TimeRangeSelect } from "./time-range-parts";
import type { TimeRangeRefresh } from "./date-range-control";

export default function DateRangeEditor({ value, recent, onCommit, refresh, onShowDates }: {
  value: TimeRangeValue; recent: readonly TimeRangeValue[]; onCommit: (value: TimeRangeValue) => void; refresh?: TimeRangeRefresh; onShowDates: () => void;
}) {
  const match = /^now-(\d+)([smhdwMy])$/.exec(value.start), id = useId();
  const [direction, setDirection] = useState("last"), [count, setCount] = useState(match?.[1] ?? "15");
  const [unit, setUnit] = useState<TimeUnit>((match?.[2] as TimeUnit) ?? "m"), [clock] = useState(Date.now);
  const next = direction === "last" ? { start: `now-${count}${unit}`, end: "now" } : { start: "now", end: `now+${count}${unit}` };
  const valid = /^\d+$/.test(count) && Number(count) > 0 && resolveTimeRange(next, clock) !== null;
  return <div className="grid gap-4 text-body-sm">
    <section aria-label="Quick select" className="grid gap-2">
      <h2 className="text-caption text-fg-2">Quick select</h2>
      <div className="grid grid-cols-[auto_1fr_1.6fr_auto] items-center gap-2">
        <TimeRangeSelect label="Quick range direction" value={direction} onChange={setDirection} options={[{ value: "last", label: "Last" }, { value: "next", label: "Next" }]} />
        <Input aria-label="Quick range amount" type="number" min={1} max={999999} step={1} value={count} onChange={event => setCount(event.target.value)} className="px-2" aria-invalid={!valid || undefined} aria-describedby={!valid ? `${id}-error` : undefined} />
        <TimeRangeSelect label="Quick range unit" value={unit} onChange={value => setUnit(value as TimeUnit)} options={TIME_UNITS.map(value => ({ value, label: TIME_UNIT_LABELS[value] }))} />
        <Button variant="ghost" className="bg-tray px-2.5 text-body-sm" disabled={!valid} onClick={() => onCommit(next)}>Apply</Button>
      </div>
      {!valid && <p id={`${id}-error`} role="status" className="text-caption text-down-ink">Choose a positive whole amount, up to one year.</p>}
    </section>
    <section aria-label="Commonly used time ranges" className="grid gap-2 border-t border-line pt-4">
      <h3 className="text-caption text-fg-2">Commonly used</h3>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">{COMMON_TIME_RANGES.map(range => <li key={range.label} className="min-w-0"><Button variant="ghost" aria-pressed={value.start === range.start && value.end === range.end} className="w-full justify-start px-2 text-body-sm aria-pressed:bg-tray" onClick={() => onCommit({ start: range.start, end: range.end })}>{range.label}</Button></li>)}</ul>
    </section>
    <section aria-label="Recently used time ranges" className="grid gap-2 border-t border-line pt-4">
      <h3 className="text-caption text-fg-2">Recently used</h3>
      {recent.length ? <ul className="grid gap-1">{recent.map((range, i) => <li key={i}><Button variant="ghost" title={timeRangeLabel(range)} className="w-full justify-start px-2 text-body-sm" onClick={() => onCommit(range)}><span className="truncate">{timeRangeLabel(range)}</span></Button></li>)}</ul> : <p className="text-caption text-fg-3">Applied ranges appear here.</p>}
      <Button variant="ghost" className="justify-start px-2 text-body-sm" onClick={onShowDates}>Custom range…</Button>
    </section>
    {refresh && <RefreshEvery refresh={refresh} />}
    <p className="text-caption text-fg-3">Time zone · {APP_TIME_ZONE_LABEL}</p>
  </div>;
}
function RefreshEvery({ refresh }: { refresh: TimeRangeRefresh }) {
  const initialUnit = refresh.interval >= 3600 ? "h" : refresh.interval >= 60 && refresh.interval % 60 === 0 ? "m" : "s";
  const scale = (unit: string) => unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  const [unit, setUnit] = useState(initialUnit), [count, setCount] = useState(String((refresh.interval || 10) / scale(initialUnit)));
  const [enabled, setEnabled] = useState(refresh.interval > 0);
  const seconds = Number(count) * scale(unit), valid = /^\d+$/.test(count) && Number.isInteger(seconds) && seconds >= 5 && seconds <= 3600;
  function update(nextCount: string, nextUnit: string, on: boolean) {
    const next = Number(nextCount) * scale(nextUnit);
    refresh.onInterval(on && /^\d+$/.test(nextCount) && next >= 5 && next <= 3600 ? next : 0);
  }
  return <section aria-label="Automatic refresh" className="grid gap-2 border-t border-line pt-3">
    <div className="flex items-center gap-1"><Switch aria-label="Refresh every" checked={enabled} disabled={!!refresh.paused} onChange={event => { setEnabled(event.target.checked); update(count, unit, event.target.checked); }} /><span className="text-body-sm">Refresh every</span></div>
    <div className="flex gap-2"><Input type="number" min={1} step={1} aria-label="Refresh amount" className="w-16" value={count} disabled={!!refresh.paused} aria-invalid={enabled && !valid || undefined} onChange={event => { setCount(event.target.value); update(event.target.value, unit, enabled); }} /><TimeRangeSelect label="Refresh unit" value={unit} disabled={!!refresh.paused} onChange={next => { setUnit(next); update(count, next, enabled); }} options={[{ value: "s", label: "seconds" }, { value: "m", label: "minutes" }, { value: "h", label: "hours" }]} /></div>
    {enabled && !valid && <p role="status" className="text-caption text-down-ink">Choose 5 seconds to 1 hour. Refresh is paused until valid.</p>}
    {refresh.paused && <p className="text-caption text-fg-3">{refresh.paused}</p>}
  </section>;
}
