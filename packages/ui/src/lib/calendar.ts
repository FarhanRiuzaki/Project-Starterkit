import { shiftDate } from "./format";
import { validDateRange } from "./date-range";

export const validDate = (value: string) => validDateRange(value, value);
export const weekday = (value: string) => (new Date(`${value}T12:00:00Z`).getUTCDay() + 6) % 7;
export function calendarDays(month: string): string[] {
  const first = `${month.slice(0, 7)}-01`;
  return Array.from({ length: 42 }, (_, i) => shiftDate(first, i - weekday(first)));
}
/** Clamp instead of overflowing Jan 31 into March, including leap years. */
export function moveMonth(value: string, amount: number): string {
  const d = new Date(`${value}T12:00:00Z`), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + amount);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export function calendarKey(value: string, key: string, shift = false): string | null {
  if (key === "ArrowLeft") return shiftDate(value, -1);
  if (key === "ArrowRight") return shiftDate(value, 1);
  if (key === "ArrowUp") return shiftDate(value, -7);
  if (key === "ArrowDown") return shiftDate(value, 7);
  if (key === "Home") return shiftDate(value, -weekday(value));
  if (key === "End") return shiftDate(value, 6 - weekday(value));
  if (key === "PageUp" || key === "PageDown") return moveMonth(value, (key === "PageUp" ? -1 : 1) * (shift ? 12 : 1));
  return null;
}
