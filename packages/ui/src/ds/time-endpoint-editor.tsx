"use client";
import { useId, useState } from "react";
import { APP_TIME_ZONE_LABEL, appDate, formatDateTimeLong } from "../lib/format";
import { parseTimeInput, resolveTime, TIME_UNITS, TIME_UNIT_LABELS, timeInputValue, type TimeUnit } from "../lib/time-range";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Calendar } from "./calendar";
import { Field } from "./field";
import { Switch } from "./form-options";
import { TimeRangeSelect } from "./time-range-parts";

type Mode = "absolute" | "relative" | "now";
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
export default function TimeEndpointEditor({ endpoint, value, onChange }: { endpoint: "start" | "end"; value: string; onChange: (value: string) => void }) {
  const [clock] = useState(Date.now), [mode, setMode] = useState<Mode>(value === "now" ? "now" : value.startsWith("now") ? "relative" : "absolute");
  const initial = resolveTime(value, clock) ?? clock, id = useId();
  const [absolute, setAbsolute] = useState(timeInputValue(initial));
  const match = /^now([+-])(\d+)([smhdwMy])(?:\/([smhdwMy]))?$/.exec(value);
  const [count, setCount] = useState(match?.[2] ?? "15"), [offset, setOffset] = useState(`${match?.[1] ?? "-"}${match?.[3] ?? "m"}`);
  const [rounded, setRounded] = useState(!!match?.[4]);
  const expression = `now${offset[0]}${count}${offset[1]}${rounded ? `/${offset[1]}` : ""}`;
  const relative = /^\d+$/.test(count) && Number(count) > 0 ? resolveTime(expression, clock) : null;
  const parsed = parseTimeInput(absolute), ms = parsed ? Date.parse(parsed) : initial;
  const day = appDate(ms), time = timeInputValue(ms).slice(11, 16);
  function selectDay(date: string) { setAbsolute(`${date} ${timeInputValue(ms).slice(11)}`); }
  function selectTime(time: string) { setAbsolute(`${day} ${time}:00.000`); }
  const nearest = `${time.slice(0, 3)}${Number(time.slice(3)) < 30 ? "00" : "30"}`;
  const name = endpoint === "start" ? "Start" : "End";
  return <Tabs value={mode} onValueChange={value => setMode(value as Mode)} className="gap-4">
    <TabsList aria-label={`${name} time mode`} className="w-fit gap-4"><TabsTrigger value="absolute">Absolute</TabsTrigger><TabsTrigger value="relative">Relative</TabsTrigger><TabsTrigger value="now">Now</TabsTrigger></TabsList>
    <TabsContent value="absolute" className="grid gap-4 data-[state=inactive]:hidden">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5rem] gap-3">
        <Calendar value={day} initialMonth={day} today={appDate(clock)} showFooter={false} onValueChange={selectDay} label={`${name} date calendar`} className="w-full gap-2 rounded-none border-0 p-0 pointer-coarse:w-full pointer-coarse:p-0" />
        <div role="listbox" aria-label={`${name} time of day`} className="scroll-quiet max-h-72 min-w-0 overflow-y-auto" ref={el => { if (el) { const option = el.querySelector<HTMLElement>('[data-time-nearest]' ); if (option) el.scrollTop = option.offsetTop - el.offsetTop - el.clientHeight / 2; } }}>
          {TIMES.map((item, i) => <button key={item} type="button" role="option" aria-selected={item === time} data-time-nearest={item === nearest ? "" : undefined} tabIndex={item === nearest ? 0 : -1} className="block h-8 w-full cursor-pointer rounded-md px-2 text-left text-body-sm outline-none hover:bg-tray focus-visible:outline-2 focus-visible:outline-primary aria-selected:bg-tray pointer-coarse:h-11" onClick={() => selectTime(item)} onKeyDown={event => {
            const next = event.key === "ArrowDown" ? Math.min(47, i + 1) : event.key === "ArrowUp" ? Math.max(0, i - 1) : event.key === "Home" ? 0 : event.key === "End" ? 47 : null;
            if (next !== null) { event.preventDefault(); selectTime(TIMES[next]!); (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus(); }
          }}>{item}</button>)}
        </div>
      </div>
      <Field id={`${id}-absolute`} label={`${name} date`} note={`YYYY-MM-DD HH:mm:ss.SSS · ${APP_TIME_ZONE_LABEL}`}><Input id={`${id}-absolute`} value={absolute} aria-invalid={!parsed || undefined} onChange={event => setAbsolute(event.target.value)} /></Field>
      <Button variant="secondary" disabled={!parsed} onClick={() => { if (parsed) onChange(parsed); }}>Set {endpoint} time</Button>
    </TabsContent>
    <TabsContent value="relative" className="grid gap-4 data-[state=inactive]:hidden">
      <div className="flex gap-2"><Input type="number" min={1} max={999999} step={1} className="w-20" aria-label={`${name} relative amount`} value={count} aria-invalid={relative === null || undefined} onChange={event => setCount(event.target.value)} /><TimeRangeSelect label={`${name} relative unit`} className="flex-1" value={offset} onChange={setOffset} options={TIME_UNITS.flatMap(unit => [{ value: `-${unit}`, label: `${TIME_UNIT_LABELS[unit]} ago` }, { value: `+${unit}`, label: `${TIME_UNIT_LABELS[unit]} from now` }])} /></div>
      <div className="flex items-center gap-1"><Switch aria-label={`Round ${endpoint} time`} checked={rounded} onChange={event => setRounded(event.target.checked)} /><span className="text-body-sm">Round to the {TIME_UNIT_LABELS[offset[1] as TimeUnit].replace(/s$/, "")}</span></div>
      <Field id={`${id}-relative`} label={`${name} date`} note="Resolved again on every refresh."><Input id={`${id}-relative`} readOnly value={relative === null ? "Invalid relative time" : formatDateTimeLong(relative)} /></Field>
      <Button variant="secondary" disabled={relative === null} onClick={() => onChange(expression)}>Set {endpoint} time</Button>
    </TabsContent>
    <TabsContent value="now" className="grid gap-4 data-[state=inactive]:hidden"><p className="text-body-sm text-fg-2">Setting the time to “now” uses the time of each refresh, so this endpoint keeps moving.</p><Button variant="ghost" className="bg-tray" onClick={() => onChange("now")}>Set {endpoint} time to now</Button></TabsContent>
    <p className="text-caption text-fg-3">Apply the range in the header to update results.</p>
  </Tabs>;
}
