import { appDate } from "./format";
type Cell = string | number | null | undefined;

/** CSV RFC 4180 + netralisasi formula (=, +, -, @ — boleh didahului spasi — serta tab/CR di awal sel teks diberi awalan '). */
export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

function cell(v: Cell): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = v;
  if (/^\s*[=+\-@]|^[\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Awalan BOM UTF-8 agar Excel membaca karakter non-ASCII dengan benar. */
export const CSV_BOM = "\uFEFF";

/** `<prefix>-YYYY-MM-DD.csv`, dated in the app time zone (the zone every time on screen uses). */
export function csvFileName(prefix: string, now: number): string {
  return `${prefix}-${appDate(now)}.csv`;
}
