import { shiftDate } from "./format";

export type DateRange = { from: string; to: string };
const DAY = 86_400_000;
export function validDateRange(from: string, to: string, maxDays = 92): boolean {
  const date = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  return date(from) && date(to) && from <= to && (Date.parse(to) - Date.parse(from)) / DAY + 1 <= maxDays;
}
export function moveDateRange(range: DateRange, direction: -1 | 1): DateRange {
  const days = (Date.parse(range.to) - Date.parse(range.from)) / DAY + 1;
  return { from: shiftDate(range.from, days * direction), to: shiftDate(range.to, days * direction) };
}
