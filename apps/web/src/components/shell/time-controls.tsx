"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { DateRangeControl, RefreshControl } from "@starterkit/ui/ds";
import { moveTimeRange } from "@starterkit/ui/lib/time-range";
import { Button } from "@starterkit/ui/ui/button";
import { Icon } from "@starterkit/ui/ui/icon";
import { ChevronLeftIcon, ChevronRightIcon } from "@starterkit/ui/ui/icons";
import { toast } from "@starterkit/ui/ui/toast";
import { patchTimeSearch, refreshInterval, refreshScope, timeRange } from "@/lib/shared/time-controls";

export function TimeControls() {
  const path = usePathname(), sp = useSearchParams(), client = useQueryClient();
  const scope = refreshScope(path), scoped = path === "/" || path.startsWith("/audit/");
  const range = timeRange(sp, path === "/" ? 14 : 7);
  const interval = refreshInterval(sp.get("refresh"));
  const fetching = useIsFetching({ queryKey: scope ? [scope] : ["no-refresh"] }) > 0;
  const [hidden, setHidden] = useState(false), [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => { setHidden(document.hidden); setOffline(!navigator.onLine); };
    sync(); document.addEventListener("visibilitychange", sync); window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { document.removeEventListener("visibilitychange", sync); window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  const paused = !scope ? "Refresh is paused on forms and pages without live data." : offline ? "Refresh is paused while offline." : hidden ? "Refresh is paused while this tab is hidden." : undefined;
  useEffect(() => {
    if (!scope || !interval || paused) return;
    const timer = window.setInterval(() => {
      if (document.hidden || !navigator.onLine || document.querySelector('[role="dialog"], [data-state="open"][role="menu"]') || client.isFetching({ queryKey: [scope] })) return;
      void client.refetchQueries({ queryKey: [scope], type: "active" });
    }, interval * 1000);
    return () => window.clearInterval(timer);
  }, [scope, interval, paused, client]);
  function update(patch: Record<string, string>, replace = false) {
    const next = patchTimeSearch(new URLSearchParams(sp.toString()), patch);
    window.history[replace ? "replaceState" : "pushState"](null, "", `${path}${next.size ? `?${next}` : ""}`);
  }
  async function refresh() {
    if (!scope || fetching || paused) return;
    try { await client.refetchQueries({ queryKey: [scope], type: "active" }, { throwOnError: true }); toast("Data refreshed."); }
    catch { toast.error("Couldn't refresh data.", { description: "Your previous data is kept. Try again." }); }
  }
  function apply(value: { start: string; end: string }) { update({ ...value, range: "", from: "", to: "" }); }
  function move(direction: -1 | 1) { const next = moveTimeRange(range.selection, direction, Date.now()); if (next) apply(next); }
  const refreshProps = { interval, onInterval: (value: number) => update({ refresh: value ? String(value) : "" }, true), onRefresh: () => void refresh(), busy: fetching, paused };
  if (!scope) return null;
  return <div className="flex h-8 w-full min-w-0 items-center justify-end gap-2" aria-label="Page time controls">
    {scoped && <>
      <Button variant="secondary" size="icon" aria-label="Previous time range" className="max-md:hidden" onClick={() => move(-1)}><Icon icon={ChevronLeftIcon} /></Button>
      <DateRangeControl label={range.label} value={range.selection} onChange={apply} refresh={refreshProps} />
      <Button variant="secondary" size="icon" aria-label="Next time range" className="max-md:hidden" onClick={() => move(1)}><Icon icon={ChevronRightIcon} /></Button>
    </>}
    {!scoped && <RefreshControl {...refreshProps} />}
  </div>;
}
