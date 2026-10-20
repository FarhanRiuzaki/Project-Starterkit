// The home page numbers of GET /v1/dashboard. Owns no table: it reads users, sessions and the audit logs through their
// owners' exported tables (read-only) and audit's recentActivity.
import { and, count, eq, gt, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { FULL_SIGN_INS } from "@starterkit/shared/audit";
import { DASHBOARD_DAYS, type DashboardDto } from "@starterkit/shared/contracts/dashboard";
import { appDate, appDayStart, APP_TIME_ZONE, shiftDate } from "@starterkit/ui/lib/format";
import { db } from "../../kernel/db";
import { authLog, recentActivity } from "../audit";
import { type Ctx, sessionLive, sessions } from "../auth";
import { users } from "../users";

const HOUR = 3_600_000;

/**
 * Home page numbers for any signed-in user; the audit-derived ones (failed sign-ins, failed counts per day, recent
 * activity) need audit.view. Each audit number is an indexed query bounded by time (the 14 days shown, the last 24 hours)
 * or by LIMIT 5; only a completed sign-in (login_success, 2fa_success) counts as a success.
 */
export async function dashboard(ctx: Ctx): Promise<DashboardDto> {
  const now = Date.now();
  const audit = ctx.perms.has("audit.view");
  const today = appDate(now);
  const first = shiftDate(today, 1 - DASHBOARD_DAYS);
  const from = new Date(appDayStart(first)), to = new Date(appDayStart(shiftDate(today, 1)));
  const success = inArray(authLog.event, [...FULL_SIGN_INS]), failedEvent = eq(authLog.event, "login_failed");
  const [[people], [live], perDay, failed, recent] = await Promise.all([
    db.select({
      active: sql<number>`count(*) filter (where ${users.isActive})::int`,
      fresh: sql<number>`count(*) filter (where ${gte(users.createdAt, new Date(now - 7 * 24 * HOUR))})::int`,
    }).from(users),
    db.select({ n: count() }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(users.isActive, true), sessionLive())),
    // Grouped by the select's first column: the same expression twice would be two parameters, which PostgreSQL won't match.
    db.select({
      day: sql<string>`to_char(${authLog.at} at time zone ${APP_TIME_ZONE}, 'YYYY-MM-DD')`,
      success: sql<number>`count(*) filter (where ${success})::int`,
      failed: sql<number>`count(*) filter (where ${failedEvent})::int`,
    }).from(authLog).where(and(gte(authLog.at, from), lt(authLog.at, to), inArray(authLog.event, [...FULL_SIGN_INS, "login_failed"]))).groupBy(sql`1`),
    audit ? db.$count(authLog, and(failedEvent, gt(authLog.at, new Date(now - 24 * HOUR)), lte(authLog.at, new Date(now)))) : null,
    audit ? recentActivity() : null,
  ]);
  const byDay = new Map(perDay.map((d) => [d.day, d]));
  return {
    activeUsers: people!.active,
    newUsers7d: people!.fresh,
    failedLogins24h: failed,
    activeSessions: live!.n,
    loginsPerDay: Array.from({ length: DASHBOARD_DAYS }, (_, i) => {
      const date = shiftDate(first, i), d = byDay.get(date);
      return { date, success: d?.success ?? 0, failed: audit ? (d?.failed ?? 0) : null };
    }),
    recent,
  };
}
