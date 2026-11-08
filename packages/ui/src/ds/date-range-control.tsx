"use client";

import { lazy, Suspense, useState } from "react";
import { cn } from "../lib/cn";
import { endpointLabel, resolveTimeRange, timeRangeLabel, type TimeRangeValue } from "../lib/time-range";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { ArrowRightIcon, CalendarIcon, ChevronDownIcon, RefreshIcon } from "../ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useDelayedFlag } from "../motion";
const loadQuickEditor = () => import("./date-range-editor");
const DateRangeEditor = lazy(loadQuickEditor);
const loadEndpointEditor = () => import("./time-endpoint-editor");
const TimeEndpointEditor = lazy(loadEndpointEditor);

export type TimeRangeRefresh = { interval: number; onInterval: (seconds: number) => void; onRefresh: () => void; busy?: boolean; paused?: string };
export type DateRangeControlProps = { value: TimeRangeValue; label?: string; onChange: (value: TimeRangeValue) => void; refresh?: TimeRangeRefresh; className?: string };
/** The summary field opens quick select; each expanded endpoint has its own editor. Drafts apply together. */
export function DateRangeControl({ value, label, onChange, refresh, className }: DateRangeControlProps) {
  const [open, setOpen] = useState(false), [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<TimeRangeValue | null>(null), [source, setSource] = useState(value);
  const [clock, setClock] = useState(Date.now);
  const [recent, setRecent] = useState<TimeRangeValue[]>([]);
  if (source.start !== value.start || source.end !== value.end) { setSource(value); setDraft(null); }
  const current = draft ?? value, dirty = !!draft && (draft.start !== value.start || draft.end !== value.end);
  const shownBusy = useDelayedFlag(!!refresh?.busy), caption = dirty ? timeRangeLabel(current) : label ?? timeRangeLabel(value);
  const valid = resolveTimeRange(current, clock) !== null;
  function commit(next: TimeRangeValue) {
    const now = Date.now();
    if (!resolveTimeRange(next, now)) { setClock(now); return; }
    onChange(next); setDraft(null); setOpen(false);
    setRecent(items => [next, ...items.filter(item => item.start !== next.start || item.end !== next.end)].slice(0, 5));
  }
  return <div data-slot="time-range-control" className={cn("relative flex h-8 min-w-0 flex-1 items-center gap-2", className)}>
    <div data-slot="time-range-input" className={cn("flex h-8 min-w-0 flex-1 items-stretch rounded-md border border-line-strong bg-card", dirty && !valid && "border-down-mark")}>
      <Popover modal open={open} onOpenChange={next => { setOpen(next); if (next) setClock(Date.now()); }}>
        <PopoverTrigger asChild><Button variant="ghost" className={cn("h-full gap-1 rounded-r-none border-0 px-2", expanded ? "shrink-0 border-r border-line-strong" : "min-w-0 flex-1 justify-start")} onPointerEnter={() => void loadQuickEditor()} onFocus={() => void loadQuickEditor()} aria-label={`Time range: ${caption}`}><Icon icon={CalendarIcon} /><Icon data-slot="disclosure-icon" icon={ChevronDownIcon} className="size-3" />{!expanded && <span className="ml-1 truncate text-body-sm">{caption}</span>}</Button></PopoverTrigger>
        <PopoverContent aria-label="Quick select time range" align="start" className="w-100 p-4">
          <Suspense fallback={<p role="status" className="text-body-sm">Loading time picker…</p>}><DateRangeEditor value={current} recent={recent} onCommit={commit} refresh={refresh} onShowDates={() => { setExpanded(true); setOpen(false); }} /></Suspense>
        </PopoverContent>
      </Popover>
      {expanded ? <div className="flex min-w-0 flex-1 items-center">
        {(["start", "end"] as const).map((endpoint, i) => <div key={endpoint} className="contents">
          {i === 1 && <Icon icon={ArrowRightIcon} className="size-3 shrink-0 text-fg-3" />}
          <EndpointButton endpoint={endpoint} value={current[endpoint]} clock={clock} onChange={next => { setClock(Date.now()); setDraft({ ...current, [endpoint]: next }); }} />
        </div>)}
      </div> : <Button variant="ghost" className="h-full shrink-0 rounded-l-none border-0 px-2 text-caption text-fg-3" aria-label="Show dates" onClick={() => setExpanded(true)}>Show dates</Button>}
    </div>
    <Button variant={dirty ? "default" : "secondary"} size="icon" aria-label={dirty ? "Apply time range" : "Refresh now"} aria-busy={shownBusy || undefined} disabled={dirty ? !valid : !!refresh?.busy || !!refresh?.paused || !refresh} title={dirty && !valid ? "Choose times in order, up to one year." : refresh?.paused} onClick={() => { if (dirty) commit(current); else { setClock(Date.now()); refresh?.onRefresh(); } }}><Icon icon={RefreshIcon} className={shownBusy ? "motion-safe:animate-spin" : undefined} /></Button>
    {dirty && <span role="status" className={valid ? "sr-only" : "absolute top-full right-0 z-30 mt-1 rounded-md border border-down-mark bg-card px-2 py-1 text-caption text-down-ink"}>{valid ? "Time range changed. Apply to update results." : "End time must follow start time, within one year."}</span>}
  </div>;
}
function EndpointButton({ endpoint, value, clock, onChange }: { clock: number; endpoint: "start" | "end"; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <Popover modal open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" onPointerEnter={() => void loadEndpointEditor()} onFocus={() => void loadEndpointEditor()} aria-label={`Edit ${endpoint} time: ${endpointLabel(value, clock)}`} title={endpointLabel(value, clock)} className={cn("h-full min-w-0 justify-start rounded-none border-0 px-2 text-body-sm", value === "now" ? "w-12 shrink-0" : "flex-1")}><span className="truncate">{endpointLabel(value, clock)}</span></Button></PopoverTrigger>
    <PopoverContent aria-label={`Edit ${endpoint} time`} className="w-100 p-4"><Suspense fallback={<p role="status" className="text-body-sm">Loading time editor…</p>}><TimeEndpointEditor endpoint={endpoint} value={value} onChange={next => { onChange(next); setOpen(false); }} /></Suspense></PopoverContent>
  </Popover>;
}
