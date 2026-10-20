// The read side of the activity and sign-in logs: the logic of /v1/audit/* (page or CSV) and the newest entries the
// dashboard shows (read-only, so nothing is recorded), and the retention purge the janitor runs.
import { and, type Column, desc, eq, exists, ilike, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { changeText, CSV_MAX_ROWS } from "@starterkit/shared/audit";
import type { ActivityDto, ActivityQuery, AuthLogDto, AuthLogQuery } from "@starterkit/shared/contracts/audit";
import type { Page } from "@starterkit/shared/contracts/common";
import { CSV_BOM, toCsv } from "@starterkit/ui/lib/csv";
import { APP_TIME_ZONE } from "@starterkit/ui/lib/format";
import { config } from "../../kernel/config";
import { db, type Tx } from "../../kernel/db";
import { likeEscape, one, pageQuery, sortSql } from "../../kernel/pagination";
import { users } from "../users";
import { activity, authLog } from "./schema";

type ActivityRecord = typeof activity.$inferSelect;
type AuthLogRecord = typeof authLog.$inferSelect;

/** An activity row as the contract's entry (a deleted actor keeps the recorded id and name). */
const toActivity = (r: ActivityRecord): ActivityDto => ({
  id: r.id, at: r.at.toISOString(), actor: { id: r.actorId ?? "", name: r.actorName }, action: r.action,
  target: { type: r.targetType, id: r.targetId, label: r.targetLabel }, before: r.before ?? null, after: r.after ?? null,
});
const toAuthLog = (r: AuthLogRecord): AuthLogDto => ({
  id: r.id, at: r.at.toISOString(), userId: r.userId, login: r.login, event: r.event as AuthLogDto["event"], method: r.method as AuthLogDto["method"],
  ip: r.ip, device: r.device, location: r.location,
});

const ACTIVITY_SORTS = { at: activity.at, actor: sql`lower(${activity.actorName})`, action: activity.action };
const AUTH_LOG_SORTS = { at: authLog.at, login: sql`lower(${authLog.login})`, event: authLog.event };

/** The from–to calendar days in the app time zone, both whole; no range = no condition. */
const inRange = (at: Column, q: { from?: string; to?: string }): SQL | undefined =>
  q.from && q.to
    ? sql`${at} >= (${q.from}::date)::timestamp at time zone ${APP_TIME_ZONE} and ${at} < ((${q.to}::date + 1)::timestamp at time zone ${APP_TIME_ZONE})`
    : undefined;

/** `user` as a case-insensitive literal substring of `name`, of the id as text, or of that user's current email. */
function matchesUser(user: string | undefined, name: Column, id: Column): SQL | undefined {
  if (!user) return undefined;
  const like = `%${likeEscape(user)}%`;
  return or(ilike(name, like), ilike(sql`${id}::text`, like), exists(db.select(one).from(users).where(and(eq(users.id, id), ilike(users.email, like)))));
}

/** The activity filter. `user` matches the actor's name or id as recorded, or the actor's current email. */
const activityWhere = (q: ActivityQuery) =>
  and(inRange(activity.at, q), q.action ? eq(activity.action, q.action) : undefined, matchesUser(q.user, activity.actorName, activity.actorId));

/** The sign-in log filter. `user` matches the login as typed or recorded, the user id, or the user's current email. */
const authLogWhere = (q: AuthLogQuery) =>
  and(inRange(authLog.at, q), q.event ? eq(authLog.event, q.event) : undefined, q.method ? eq(authLog.method, q.method) : undefined,
    matchesUser(q.user, authLog.login, authLog.userId));

// ponytail: a `user` filter is a substring scan of the rows the other filters leave (no trigram index on the audit
// tables); the date range (max 92 days) and the page cap bound it. Add pg_trgm indexes if it gets slow.

/** One page of the activity log (GET /v1/audit/activity), newest first by default. */
export function activityPage(q: ActivityQuery): Promise<Page<ActivityDto>> {
  const where = activityWhere(q);
  return pageQuery({
    rows: db.select().from(activity).where(where).$dynamic(), count: db.select(one).from(activity).where(where).$dynamic(),
    orderBy: sortSql(q.sort, ACTIVITY_SORTS, "-at", activity.id), query: q, map: toActivity,
  });
}

/** One page of the sign-in log (GET /v1/audit/auth), newest first by default. */
export function authLogPage(q: AuthLogQuery): Promise<Page<AuthLogDto>> {
  const where = authLogWhere(q);
  return pageQuery({
    rows: db.select().from(authLog).where(where).$dynamic(), count: db.select(one).from(authLog).where(where).$dynamic(),
    orderBy: sortSql(q.sort, AUTH_LOG_SORTS, "-at", authLog.id), query: q, map: toAuthLog,
  });
}

/** The 5 newest activity entries (dashboard). */
export async function recentActivity(): Promise<ActivityDto[]> {
  return (await db.select().from(activity).orderBy(desc(activity.at), desc(activity.id)).limit(5)).map(toActivity);
}

/** CSV text (with BOM) of the filtered activity log: newest first, at most CSV_MAX_ROWS rows. */
export async function activityCsv(q: ActivityQuery): Promise<string> {
  const rows = await db.select().from(activity).where(activityWhere(q)).orderBy(desc(activity.at), desc(activity.id)).limit(CSV_MAX_ROWS);
  return CSV_BOM + toCsv([
    ["Time (UTC)", "Actor", "Actor ID", "Action", "Target type", "Target ID", "Target", "Changes"],
    ...rows.map(toActivity).map((e) => [e.at, e.actor.name, e.actor.id, e.action, e.target.type, e.target.id, e.target.label, changeText(e.before, e.after)]),
  ]);
}

/** CSV text (with BOM) of the filtered sign-in log: newest first, at most CSV_MAX_ROWS rows. */
export async function authLogCsv(q: AuthLogQuery): Promise<string> {
  const rows = await db.select().from(authLog).where(authLogWhere(q)).orderBy(desc(authLog.at), desc(authLog.id)).limit(CSV_MAX_ROWS);
  return CSV_BOM + toCsv([
    ["Time (UTC)", "Login", "User ID", "Event", "Method", "IP", "Device", "Location"],
    ...rows.map(toAuthLog).map((e) => [e.at, e.login, e.userId, e.event, e.method, e.ip, e.device, e.location]),
  ]);
}

/** Rows each table loses per janitor run at most (each DELETE stays well under the 5 s statement timeout). */
const PURGE_BATCH = 10_000;

/**
 * Janitor: deletes activity and sign-in log entries older than AUDIT_RETENTION_DAYS, at most PURGE_BATCH per table
 * (the append-only trigger refuses UPDATE only). Rows deleted per table.
 */
// ponytail: 10,000 rows per table per 5-minute run (2.88 M a day) drains any realistic backlog; loop within a run if not.
export async function purgeAudit(tx: Tx): Promise<Record<string, number>> {
  const before = sql`now() - make_interval(days => ${config().AUDIT_RETENTION_DAYS})`;
  const oldest = (t: typeof activity | typeof authLog) => tx.select({ id: t.id }).from(t).where(lt(t.at, before)).limit(PURGE_BATCH);
  return {
    activity: (await tx.delete(activity).where(inArray(activity.id, oldest(activity))).returning({ one: sql`1` })).length,
    auth_log: (await tx.delete(authLog).where(inArray(authLog.id, oldest(authLog))).returning({ one: sql`1` })).length,
  };
}
