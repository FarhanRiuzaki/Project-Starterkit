import { APP_UTC_OFFSET_SEC, appDate, appDayStart, formatDateTimePrecise } from "./format";
import { validDate } from "./calendar";

export type TimeRangeValue = { start: string; end: string };
export const TIME_UNITS = ["s", "m", "h", "d", "w", "M", "y"] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];
export const TIME_UNIT_LABELS: Record<TimeUnit, string> = { s: "seconds", m: "minutes", h: "hours", d: "days", w: "weeks", M: "months", y: "years" };
export const MAX_TIME_RANGE_DAYS = 366;
const DAY = 86_400_000, OFFSET = APP_UTC_OFFSET_SEC * 1000;
const FIXED: Partial<Record<TimeUnit, number>> = { s: 1000, m: 60_000, h: 3_600_000, d: DAY, w: 7 * DAY };
const EXPRESSION = /^now((?:[+-]\d{1,6}[smhdwMy]|\/[smhdwMy]){0,3})$/;
export function isTimeExpression(value: string): boolean {
  return value.length <= 100 && (EXPRESSION.test(value) || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))));
}
function shift(ms: number, count: number, unit: TimeUnit): number {
  if (FIXED[unit]) return ms + count * FIXED[unit]!;
  const date = new Date(ms + OFFSET), day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + count * (unit === "y" ? 12 : 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.getTime() - OFFSET;
}
function round(ms: number, unit: TimeUnit): number {
  if (unit === "s" || unit === "m" || unit === "h") return Math.floor((ms + OFFSET) / FIXED[unit]!) * FIXED[unit]! - OFFSET;
  const date = new Date(appDayStart(appDate(ms)) + OFFSET);
  if (unit === "w") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  if (unit === "M" || unit === "y") date.setUTCDate(1);
  if (unit === "y") date.setUTCMonth(0);
  return date.getTime() - OFFSET;
}
/** Restricted date math. Both endpoints must be resolved against the same clock. */
export function resolveTime(value: string, now: number): number | null {
  if (!isTimeExpression(value)) return null;
  if (!value.startsWith("now")) return Date.parse(value);
  let ms = now;
  for (const part of value.slice(3).matchAll(/([+-])(\d+)([smhdwMy])|\/([smhdwMy])/g)) {
    ms = part[4] ? round(ms, part[4] as TimeUnit) : shift(ms, Number(part[2]) * (part[1] === "-" ? -1 : 1), part[3] as TimeUnit);
  }
  return Number.isFinite(ms) && ms >= 0 && ms <= 253402300799999 ? ms : null;
}
export function resolveTimeRange(value: TimeRangeValue, now: number, maxDays = MAX_TIME_RANGE_DAYS): { start: number; end: number } | null {
  const start = resolveTime(value.start, now), end = resolveTime(value.end, now);
  return start !== null && end !== null && end > start && end - start <= maxDays * DAY ? { start, end } : null;
}
export function timeRangeProblem(q: { start?: string; end?: string; from?: string; to?: string }, now: number): string | null {
  if (!q.start && !q.end) return null;
  if (!q.start || !q.end) return "Choose both start and end times.";
  if (q.from || q.to) return "Use either calendar dates or start and end times.";
  return resolveTimeRange({ start: q.start, end: q.end }, now) ? null : `Choose valid times in order, up to ${MAX_TIME_RANGE_DAYS} days.`;
}
export function timeRangeLabel(value: TimeRangeValue): string {
  const match = /^now-(\d+)([smhdwMy])(?:\/([smhdwMy]))?$/.exec(value.start);
  if (match && value.end === "now") return `Last ${match[1]} ${TIME_UNIT_LABELS[match[2] as TimeUnit].replace(/s$/, Number(match[1]) === 1 ? "" : "s")}${match[3] ? " (rounded)" : ""}`;
  if (value.start === "now/d" && value.end === "now/d+1d") return "Today";
  if (value.start === "now/w" && value.end === "now/w+1w") return "This week";
  return `${endpointLabel(value.start)} → ${endpointLabel(value.end)}`;
}
export function endpointLabel(value: string, now?: number): string {
  if (value === "now") return "now";
  if (value.startsWith("now")) { const resolved = now === undefined ? null : resolveTime(value, now); return resolved === null ? value : formatDateTimePrecise(resolved); }
  return formatDateTimePrecise(Date.parse(value));
}
/** Editable local timestamp; the app zone is fixed and shared with the API. */
export function timeInputValue(ms: number): string { return new Date(ms + OFFSET).toISOString().slice(0, 23).replace("T", " "); }
export function parseTimeInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value) || !validDate(value.slice(0, 10))) return null;
  const normalized = value.replace(" ", "T"), ms = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(ms)) return null;
  const canonical = new Date(ms).toISOString();
  if (!canonical.startsWith(normalized)) return null;
  return new Date(ms - OFFSET).toISOString();
}
export function moveTimeRange(value: TimeRangeValue, direction: -1 | 1, now: number): TimeRangeValue | null {
  const resolved = resolveTimeRange(value, now);
  if (!resolved) return null;
  const step = (resolved.end - resolved.start) * direction;
  return { start: new Date(resolved.start + step).toISOString(), end: new Date(resolved.end + step).toISOString() };
}
export const COMMON_TIME_RANGES = [
  { label: "Today", start: "now/d", end: "now/d+1d" }, { label: "This week", start: "now/w", end: "now/w+1w" },
  { label: "Last 15 minutes", start: "now-15m", end: "now" }, { label: "Last 7 days", start: "now-7d", end: "now" },
  { label: "Last 30 minutes", start: "now-30m", end: "now" }, { label: "Last 30 days", start: "now-30d", end: "now" },
  { label: "Last 1 hour", start: "now-1h", end: "now" }, { label: "Last 90 days", start: "now-90d", end: "now" },
  { label: "Last 24 hours", start: "now-24h", end: "now" }, { label: "Last 1 year", start: "now-1y", end: "now" },
] as const;
