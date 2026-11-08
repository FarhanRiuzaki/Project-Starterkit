import { resolveTimeRange, timeRangeLabel } from "@starterkit/ui/lib/time-range";
import { appDate, appDayStart, shiftDate } from "@starterkit/ui/lib/format";
import { validDateRange } from "@starterkit/ui/lib/date-range";

export const REFRESH_SECONDS = [0, 10, 30, 60, 300] as const;
export const refreshInterval = (value: string | null): number => { const n = Number(value); return Number.isInteger(n) && n >= 5 && n <= 3600 ? n : 0; };
export function timeRange(sp: Pick<URLSearchParams, "get">, fallback = 14, now = Date.now()) {
  const selection = { start: sp.get("start") ?? "", end: sp.get("end") ?? "" };
  const timed = resolveTimeRange(selection, now);
  if (timed) return { range: { from: appDate(timed.start), to: appDate(timed.end - 1) }, params: selection, selection, custom: true, days: (timed.end - timed.start) / 86_400_000, label: timeRangeLabel(selection) };
  const from = sp.get("from") ?? "", to = sp.get("to") ?? "";
  if (validDateRange(from, to)) return { range: { from, to }, params: { from, to }, selection: { start: new Date(appDayStart(from)).toISOString(), end: new Date(appDayStart(shiftDate(to, 1))).toISOString() }, custom: true, days: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1, label: `${from} – ${to}` };
  const days = (fallback === 7 ? [7, 30, 90] : [7, 14, 30, 90]).find((d) => `${d}d` === sp.get("range")) ?? fallback;
  const end = appDate(now);
  return { range: { from: shiftDate(end, 1 - days), to: end }, params: { from: shiftDate(end, 1 - days), to: end }, selection: { start: new Date(appDayStart(shiftDate(end, 1 - days))).toISOString(), end: new Date(appDayStart(shiftDate(end, 1))).toISOString() }, custom: false, days, label: `Last ${days} days` };
}
export function patchTimeSearch(sp: URLSearchParams, patch: Record<string, string>): URLSearchParams {
  const next = new URLSearchParams(sp);
  if (Object.keys(patch).some((key) => key !== "refresh")) next.delete("page");
  for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); }
  return next;
}
/** Forms never refetch underneath unsaved input. */
export function refreshScope(path: string): string | null {
  if (path === "/") return "dashboard";
  if (path === "/users") return "users";
  if (path === "/roles" || path === "/permissions") return "rbac";
  if (path === "/audit/activity" || path === "/audit/auth") return "audit";
  if (path === "/me/sessions") return "me";
  return null;
}
