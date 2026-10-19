// Display formats: en-GB, Asia/Jakarta time zone (WIB). Missing value → "–".
/**
 * The one display time zone. `APP_UTC_OFFSET_SEC` and `APP_TIME_ZONE_LABEL` both describe it: change all three
 * together (Asia/Jakarta has no DST, so a fixed offset is exact). Nothing else in packages/ui hardcodes them.
 */
export const APP_TIME_ZONE = "Asia/Jakarta";
export const APP_UTC_OFFSET_SEC = 7 * 3600;
export const APP_TIME_ZONE_LABEL = "WIB";
export const LOCALE = "en-GB";
/** en-GB writes "Sept"; the house format uses three-letter months everywhere. */
const month3 = (s: string) => s.replace(/\bSept\b/, "Sep");
const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const dateFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, day: "numeric", month: "short" });

type N = number | null | undefined;

export function formatNumber(n: N): string {
  return n == null || !Number.isFinite(n) ? "–" : nf0.format(n);
}

export function formatBytes(n: N): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${(v < 10 && (i > 0 || !Number.isInteger(v)) ? nf1 : nf0).format(v)} ${units[i]}`;
}

/** Ratio as a percentage, whole by default; `digits` keeps up to that many decimals (SLO objectives: "99.5%"). */
export function formatPercent(ratio: N, digits = 0): string {
  if (ratio == null || !Number.isFinite(ratio)) return "–";
  return digits > 0 ? `${formatDecimal(ratio * 100, digits)}%` : `${Math.round(ratio * 100)}%`;
}

/**
 * Error budget left (0–1, clamped): whole percent, but a budget that is neither empty nor full never rounds to
 * either end, so 0.4 % reads "<1% left" (not "0% left") and 99.6 % reads ">99% left" (not "100% left").
 */
export function formatBudgetLeft(ratio: N): string {
  if (ratio == null || !Number.isFinite(ratio)) return "–";
  const r = Math.min(1, Math.max(0, ratio));
  const pct = Math.round(r * 100);
  if (r > 0 && pct === 0) return "<1% left";
  if (r < 1 && pct === 100) return ">99% left";
  return `${pct}% left`;
}

export function formatDuration(sec: N): string {
  if (sec == null || !Number.isFinite(sec)) return "–";
  if (sec < 60) return "<1 min";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export function formatTime(ms: N): string {
  return ms == null ? "–" : timeFmt.format(ms);
}

export function formatDateTime(ms: N): string {
  return ms == null ? "–" : month3(dateTimeFmt.format(ms));
}

export function formatDate(ms: N): string {
  return ms == null ? "–" : month3(dateFmt.format(ms));
}

export function formatRelative(ms: N, now: number = Date.now()): string {
  if (ms == null) return "Never";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

const DAY_MS = 86_400_000;

/** Calendar date ("2026-10-20") in the app time zone at `ms`. */
export function appDate(ms: number): string {
  return new Date(ms + APP_UTC_OFFSET_SEC * 1000).toISOString().slice(0, 10);
}

/** 00:00 in the app time zone on `date` ("YYYY-MM-DD"), as epoch ms. */
export function appDayStart(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) - APP_UTC_OFFSET_SEC * 1000;
}

/** `date` ("YYYY-MM-DD") moved by `days` whole calendar days. */
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Seconds since 00:00 in the app time zone; at least 60 so a rate window is never empty. */
export function secondsSinceMidnight(nowMs: number): number {
  const wib = new Date(nowMs + APP_UTC_OFFSET_SEC * 1000);
  const s = wib.getUTCHours() * 3600 + wib.getUTCMinutes() * 60 + wib.getUTCSeconds();
  return Math.max(60, s);
}

const MINUS = "−";
const longFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: APP_TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Compact number: below 10,000 as is, then K / M / B with 1 decimal ("12.9K", "4.6M", "2.3B"). */
export function formatCompact(n: N): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const sign = n < 0 ? MINUS : "";
  const a = Math.abs(n);
  if (Math.round(a) < 10_000) return sign + nf0.format(a);
  const units: [number, string][] = [[1e3, "K"], [1e6, "M"], [1e9, "B"]];
  let i = a >= 1e9 ? 2 : a >= 1e6 ? 1 : 0;
  // Pick the unit after rounding to 1 decimal: 999.95K → 1M.
  while (i < units.length - 1 && Math.round((a / units[i]![0]) * 10) / 10 >= 1000) i++;
  const [div, unit] = units[i]!;
  return `${sign}${nf1.format(a / div)}${unit}`;
}

/** "16 Oct 2026, 14:05 WIB" — absolute-time tooltips and log entries. */
export function formatDateTimeLong(ms: N): string {
  if (ms == null || !Number.isFinite(ms)) return "–";
  const p = Object.fromEntries(longFmt.formatToParts(ms).map((x) => [x.type, x.value]));
  return `${p.day} ${month3(p.month ?? "")} ${p.year}, ${p.hour}:${p.minute} ${APP_TIME_ZONE_LABEL}`;
}

/** Signed delta for a stat tile: "+18%", "−4%", "0%". */
export function formatSignedPercent(ratio: N): string {
  if (ratio == null || !Number.isFinite(ratio)) return "–";
  const v = Math.round(ratio * 100);
  return v === 0 ? "0%" : `${v > 0 ? "+" : MINUS}${Math.abs(v)}%`;
}

const decimalFmts = new Map<number, Intl.NumberFormat>();

/** Number with at most `digits` decimals (latency, cost, rates). Invalid → "–". */
export function formatDecimal(n: N, digits: number): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const d = Math.max(0, Math.min(6, Math.floor(digits)));
  let f = decimalFmts.get(d);
  if (!f) { f = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: d }); decimalFmts.set(d, f); }
  return f.format(n);
}

/** Count + noun with correct number agreement: "1 session", "3 sessions". Invalid count → "– <many>". */
export function plural(n: N, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
