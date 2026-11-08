// The home page numbers of GET /v1/dashboard. Owns no table: it reads users, sessions and the audit logs through their
// owners' exported tables (read-only) and audit's recentActivity.
import { and, count, eq, gt, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { FULL_SIGN_INS } from "@starterkit/shared/audit";
import { DASHBOARD_DAYS, type DashboardDto, type DashboardQuery } from "@starterkit/shared/contracts/dashboard";
import { resolveTimeRange } from "@starterkit/ui/lib/time-range";
import { appDate, appDayStart, APP_TIME_ZONE, shiftDate } from "@starterkit/ui/lib/format";
import { ApiError } from "../../kernel/errors";
import { db } from "../../kernel/db";
import { authLog, recentActivity } from "../audit";
import { type Ctx, sessionLive, sessions } from "../auth";
import { users } from "../users";

const HOUR = 3_600_000;

/** `login_failed` entries in (from, to]. */
const failedBetween = (from: number, to: number) =>
  db.$count(authLog, and(eq(authLog.event, "login_failed"), gt(authLog.at, new Date(from)), lte(authLog.at, new Date(to))));

/**
 * Home page numbers for any signed-in user; the audit-derived ones (failed sign-ins, failed counts per day, recent
 * activity) need audit.view. Each audit number is an indexed query bounded by time (the 14 days shown, the last 24 hours
 * and the 24 before) or by LIMIT 5; only a completed sign-in (login_success, 2fa_success) counts as a success.
 */
export async function dashboard(ctx: Ctx, query: DashboardQuery = {}): Promise<DashboardDto> {
  const now = Date.now();
  const audit = ctx.perms.has("audit.view");
  const today = appDate(now);
  const timed = query.start && query.end ? resolveTimeRange({ start: query.start, end: query.end }, now)! : null;
  if (query.start && query.end && !timed) throw new ApiError("bad_request");
  const first = timed ? appDate(timed.start) : query.from ?? shiftDate(today, 1 - DASHBOARD_DAYS);
  const last = timed ? appDate(timed.end - 1) : query.to ?? today;
  const from = new Date(timed?.start ?? appDayStart(first)), to = new Date(timed?.end ?? appDayStart(shiftDate(last, 1)));
  const dayCount = Math.round((appDayStart(last) - appDayStart(first)) / (24 * HOUR)) + 1;
  const previous = new Date(from.getTime() - (to.getTime() - from.getTime()));
  const success = inArray(authLog.event, [...FULL_SIGN_INS]), failedEvent = eq(authLog.event, "login_failed");
  const [[people], [live], perDay, failed, failedBefore, recent, selected] = await Promise.all([
    db.select({
      active: sql<number>`count(*) filter (where ${users.isActive})::int`,
      fresh: sql<number>`count(*) filter (where ${gte(users.createdAt, new Date(now - 7 * 24 * HOUR))})::int`,
      before: sql<number>`count(*) filter (where ${and(gte(users.createdAt, new Date(now - 14 * 24 * HOUR)), lt(users.createdAt, new Date(now - 7 * 24 * HOUR)))})::int`,
    }).from(users),
    db.select({ n: count() }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(users.isActive, true), sessionLive())),
    // Grouped by the select's first column: the same expression twice would be two parameters, which PostgreSQL won't match.
    db.select({
      day: sql<string>`to_char(${authLog.at} at time zone ${APP_TIME_ZONE}, 'YYYY-MM-DD')`,
      success: sql<number>`count(*) filter (where ${success})::int`,
      failed: sql<number>`count(*) filter (where ${failedEvent})::int`,
    }).from(authLog).where(and(gte(authLog.at, from), lt(authLog.at, to), inArray(authLog.event, [...FULL_SIGN_INS, "login_failed"]))).groupBy(sql`1`),
    audit ? failedBetween(now - 24 * HOUR, now) : null,
    audit ? failedBetween(now - 48 * HOUR, now - 24 * HOUR) : null,
    audit ? recentActivity() : null,
    (query.from || timed) ? Promise.all([
      db.$count(users, and(gte(users.createdAt, from), lt(users.createdAt, to))),
      db.$count(users, and(gte(users.createdAt, previous), lt(users.createdAt, from))),
      audit ? db.$count(authLog, and(failedEvent, gte(authLog.at, from), lt(authLog.at, to))) : null,
      audit ? db.$count(authLog, and(failedEvent, gte(authLog.at, previous), lt(authLog.at, from))) : null,
    ]) : null,
  ]);
  const byDay = new Map(perDay.map((d) => [d.day, d]));
  return {
    activeUsers: people!.active,
    newUsers7d: people!.fresh,
    newUsersPrev7d: people!.before,
    failedLogins24h: failed,
    failedLoginsPrev24h: failedBefore,
    activeSessions: live!.n,
    ...(selected ? { period: { from: first, to: last, ...(timed ? { start: from.toISOString(), end: to.toISOString() } : {}), newUsers: selected[0], previousNewUsers: selected[1], failedSignIns: selected[2], previousFailedSignIns: selected[3] } } : {}),
    loginsPerDay: Array.from({ length: dayCount }, (_, i) => {
      const date = shiftDate(first, i), d = byDay.get(date);
      return { date, success: d?.success ?? 0, failed: audit ? (d?.failed ?? 0) : null };
    }),
    recent,
  };
}
