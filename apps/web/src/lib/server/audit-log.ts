import "server-only";
import { CSV_BOM, csvFileName, toCsv } from "@starterkit/ui/lib/csv";
import { appDayStart, shiftDate } from "@starterkit/ui/lib/format";
import { changeText, CSV_MAX_ROWS } from "@/lib/shared/audit";
import type { ActivityDto, ActivityQuery, AuthLogDto, AuthLogQuery } from "@/lib/shared/contracts/audit";
import { json } from "./api";
import { db } from "./mock/db";
import { paginate, type Sorters, sortRows } from "./paginate";

/** Both logs sort newest first unless the query asks otherwise; CSV is always newest first. */
const NEWEST = "-at";

/** Entry time inside the from–to calendar days (app time zone, both days whole); no range = always. */
function inRange(from: string | undefined, to: string | undefined): (at: string) => boolean {
  if (!from || !to) return () => true;
  const start = appDayStart(from), end = appDayStart(shiftDate(to, 1));
  return (at) => { const t = Date.parse(at); return t >= start && t < end; };
}
const contains = (needle: string | undefined) => {
  const n = needle?.toLowerCase();
  return (...hay: (string | null)[]) => !n || hay.some((h) => h?.toLowerCase().includes(n));
};

export const ACTIVITY_SORTERS: Sorters<ActivityDto> = { at: (r) => r.at, actor: (r) => r.actor.name, action: (r) => r.action };
export const AUTH_LOG_SORTERS: Sorters<AuthLogDto> = { at: (r) => r.at, login: (r) => r.login, event: (r) => r.event };

/** Activity entries matching the query's filters (unsorted). */
export function activityRows(q: ActivityQuery): ActivityDto[] {
  const when = inRange(q.from, q.to), who = contains(q.user);
  return [...db().activity.values()].filter((e) => when(e.at) && (!q.action || e.action === q.action) && who(e.actor.name, e.actor.id));
}

/** Sign-in log entries matching the query's filters (unsorted). */
export function authLogRows(q: AuthLogQuery): AuthLogDto[] {
  const when = inRange(q.from, q.to), who = contains(q.user);
  return [...db().authLog.values()].filter((e) => when(e.at) && (!q.event || e.event === q.event) && (!q.method || e.method === q.method) && who(e.login, e.userId));
}

type Cell = string | number | null;
export type CsvSpec<T> = { prefix: string; header: string[]; row: (r: T) => Cell[] };

export const ACTIVITY_CSV: CsvSpec<ActivityDto> = {
  prefix: "activity",
  header: ["Time (UTC)", "Actor", "Actor ID", "Action", "Target type", "Target ID", "Target", "Changes"],
  row: (e) => [e.at, e.actor.name, e.actor.id, e.action, e.target.type, e.target.id, e.target.label, changeText(e.before, e.after)],
};
export const AUTH_LOG_CSV: CsvSpec<AuthLogDto> = {
  prefix: "sign-in",
  header: ["Time (UTC)", "Login", "User ID", "Event", "Method", "IP", "Device", "Location"],
  row: (e) => [e.at, e.login, e.userId, e.event, e.method, e.ip, e.device, e.location],
};

/**
 * The answer of an audit list endpoint: JSON = one page sorted as asked; CSV = the whole filtered list newest first,
 * at most CSV_MAX_ROWS rows, as a UTF-8 (BOM) attachment `<prefix>-<date>.csv`. Cells go through `toCsv`, which
 * neutralises formulas. Never cached.
 */
export function auditAnswer<T>(q: { format: "json" | "csv"; page: number; pageSize: number; sort?: string }, rows: T[], sorters: Sorters<T>, csv: CsvSpec<T>): Response {
  if (q.format === "json") return json(paginate(rows, q, sorters, NEWEST));
  const body = toCsv([csv.header, ...sortRows(rows, NEWEST, sorters).slice(0, CSV_MAX_ROWS).map(csv.row)]);
  return new Response(CSV_BOM + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(csv.prefix, Date.now())}"`,
      "Cache-Control": "no-store",
    },
  });
}
