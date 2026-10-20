import { changeText, CSV_MAX_ROWS } from "@starterkit/shared/audit";
import type { ActivityDto, ActivityQuery, AuthLogDto, AuthLogQuery } from "@starterkit/shared/contracts/audit";
import type { Page } from "@starterkit/shared/contracts/common";
import { CSV_BOM, csvFileName, toCsv } from "@starterkit/ui/lib/csv";
import { APP_TIME_ZONE } from "@starterkit/ui/lib/format";
import { sql } from "../db/client";
import { type Fragment, likeEscape, pageQuery, sortSql } from "../db/page";

type ActivityRecord = {
  id: string; at: Date; actor_id: string | null; actor_name: string; action: string;
  target_type: string; target_id: string; target_label: string; before: unknown; after: unknown;
};
type AuthLogRecord = {
  id: string; at: Date; user_id: string | null; login: string; event: AuthLogDto["event"]; method: AuthLogDto["method"];
  ip: string; device: string; location: string | null;
};

/** Columns `toActivity` reads (table alias `a`). */
export const ACTIVITY_COLS = sql`a.id, a.at, a.actor_id, a.actor_name, a.action, a.target_type, a.target_id, a.target_label, a.before, a.after`;
const AUTH_LOG_COLS = sql`l.id, l.at, l.user_id, l.login, l.event, l.method, l.ip, l.device, l.location`;

/** An activity row as the contract's entry (a deleted actor keeps the recorded id and name). */
export const toActivity = (r: ActivityRecord): ActivityDto => ({
  id: r.id, at: r.at.toISOString(), actor: { id: r.actor_id ?? "", name: r.actor_name }, action: r.action,
  target: { type: r.target_type, id: r.target_id, label: r.target_label }, before: r.before ?? null, after: r.after ?? null,
});
const toAuthLog = (r: AuthLogRecord): AuthLogDto => ({
  id: r.id, at: r.at.toISOString(), userId: r.user_id, login: r.login, event: r.event, method: r.method, ip: r.ip, device: r.device, location: r.location,
});

const ACTIVITY_SORTS = { at: "a.at", actor: "lower(a.actor_name)", action: "a.action" };
const AUTH_LOG_SORTS = { at: "l.at", login: "lower(l.login)", event: "l.event" };

/** The from–to calendar days in the app time zone, both whole; no range = no condition. */
const inRange = (at: Fragment, q: { from?: string; to?: string }): Fragment =>
  q.from && q.to ? sql`${at} >= (${q.from}::date)::timestamp at time zone ${APP_TIME_ZONE} and ${at} < ((${q.to}::date + 1)::timestamp at time zone ${APP_TIME_ZONE})` : sql`true`;

/** `from … where …` of the activity log. `user` matches the actor's name or id as recorded, or the actor's current email. */
function activityFrom(q: ActivityQuery): Fragment {
  const like = `%${likeEscape(q.user ?? "")}%`;
  return sql`from activity a where ${inRange(sql`a.at`, q)}
    and ${q.action ? sql`a.action = ${q.action}` : sql`true`}
    and ${q.user ? sql`(a.actor_name ilike ${like} or a.actor_id::text ilike ${like}
      or exists (select 1 from users u where u.id = a.actor_id and u.email ilike ${like}))` : sql`true`}`;
}

/** `from … where …` of the sign-in log. `user` matches the login as typed or recorded, the user id, or the user's current email. */
function authLogFrom(q: AuthLogQuery): Fragment {
  const like = `%${likeEscape(q.user ?? "")}%`;
  return sql`from auth_log l where ${inRange(sql`l.at`, q)}
    and ${q.event ? sql`l.event = ${q.event}` : sql`true`}
    and ${q.method ? sql`l.method = ${q.method}` : sql`true`}
    and ${q.user ? sql`(l.login ilike ${like} or l.user_id::text ilike ${like}
      or exists (select 1 from users u where u.id = l.user_id and u.email ilike ${like}))` : sql`true`}`;
}

// ponytail: a `user` filter is a substring scan of the rows the other filters leave (no trigram index on the audit
// tables); the date range (max 92 days) and the page cap bound it. Add pg_trgm indexes if it gets slow.

/** One page of the activity log (GET /v1/audit/activity), newest first by default. */
export const activityPage = (q: ActivityQuery): Promise<Page<ActivityDto>> =>
  pageQuery({ select: ACTIVITY_COLS, from: activityFrom(q), orderBy: sortSql(q.sort, ACTIVITY_SORTS, "-at"), query: q, map: toActivity });

/** One page of the sign-in log (GET /v1/audit/auth), newest first by default. */
export const authLogPage = (q: AuthLogQuery): Promise<Page<AuthLogDto>> =>
  pageQuery({ select: AUTH_LOG_COLS, from: authLogFrom(q), orderBy: sortSql(q.sort, AUTH_LOG_SORTS, "-at"), query: q, map: toAuthLog });

/** The 5 newest activity entries (dashboard). */
export async function recentActivity(): Promise<ActivityDto[]> {
  return (await sql<ActivityRecord[]>`select ${ACTIVITY_COLS} from activity a order by a.at desc, a.id desc limit 5`).map(toActivity);
}

/** CSV text (with BOM) of the filtered activity log: newest first, at most CSV_MAX_ROWS rows. */
export async function activityCsv(q: ActivityQuery): Promise<string> {
  const rows = await sql<ActivityRecord[]>`select ${ACTIVITY_COLS} ${activityFrom(q)} order by a.at desc, a.id desc limit ${CSV_MAX_ROWS}`;
  return CSV_BOM + toCsv([
    ["Time (UTC)", "Actor", "Actor ID", "Action", "Target type", "Target ID", "Target", "Changes"],
    ...rows.map(toActivity).map((e) => [e.at, e.actor.name, e.actor.id, e.action, e.target.type, e.target.id, e.target.label, changeText(e.before, e.after)]),
  ]);
}

/** CSV text (with BOM) of the filtered sign-in log: newest first, at most CSV_MAX_ROWS rows. */
export async function authLogCsv(q: AuthLogQuery): Promise<string> {
  const rows = await sql<AuthLogRecord[]>`select ${AUTH_LOG_COLS} ${authLogFrom(q)} order by l.at desc, l.id desc limit ${CSV_MAX_ROWS}`;
  return CSV_BOM + toCsv([
    ["Time (UTC)", "Login", "User ID", "Event", "Method", "IP", "Device", "Location"],
    ...rows.map(toAuthLog).map((e) => [e.at, e.login, e.userId, e.event, e.method, e.ip, e.device, e.location]),
  ]);
}

/** A CSV attachment `<prefix>-<date in the app time zone>.csv`, never cached. */
export const csvResponse = (prefix: string, text: string): Response =>
  new Response(text, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(prefix, Date.now())}"`,
      "Cache-Control": "no-store",
    },
  });
