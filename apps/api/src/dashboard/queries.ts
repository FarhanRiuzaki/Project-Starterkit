import { FULL_SIGN_INS } from "@starterkit/shared/audit";
import { DASHBOARD_DAYS, type DashboardDto } from "@starterkit/shared/contracts/dashboard";
import { appDate, appDayStart, APP_TIME_ZONE, shiftDate } from "@starterkit/ui/lib/format";
import { recentActivity } from "../audit/queries";
import { sessionLive } from "../db/fragments";
import { sql } from "../db/client";
import type { Ctx } from "../modules/auth";

const HOUR = 3_600_000;

/**
 * Home page numbers (GET /v1/dashboard) for any signed-in user; the audit-derived ones (failed sign-ins, failed counts
 * per day, recent activity) need audit.view. Each audit number is an indexed query bounded by time (the 14 days shown,
 * the last 24 hours) or by LIMIT 5; only a completed sign-in (login_success, 2fa_success) counts as a success.
 */
export async function dashboard(ctx: Ctx): Promise<DashboardDto> {
  const now = Date.now();
  const audit = ctx.perms.has("audit.view");
  const today = appDate(now);
  const first = shiftDate(today, 1 - DASHBOARD_DAYS);
  const from = new Date(appDayStart(first)), to = new Date(appDayStart(shiftDate(today, 1)));
  const [[people], [sessions], perDay, [failed], recent] = await Promise.all([
    sql`select count(*) filter (where is_active)::int as active, count(*) filter (where created_at >= ${new Date(now - 7 * 24 * HOUR)})::int as fresh from users`,
    sql`select count(*)::int as n from sessions s join users u on u.id = s.user_id where u.is_active and ${sessionLive()}`,
    sql<{ day: string; success: number; failed: number }[]>`
      select to_char(at at time zone ${APP_TIME_ZONE}, 'YYYY-MM-DD') as day,
        count(*) filter (where event in ${sql(FULL_SIGN_INS)})::int as success, count(*) filter (where event = 'login_failed')::int as failed
      from auth_log where at >= ${from} and at < ${to} and event in ${sql([...FULL_SIGN_INS, "login_failed"])} group by 1`,
    audit
      ? sql`select count(*)::int as n from auth_log where event = 'login_failed' and at > ${new Date(now - 24 * HOUR)} and at <= ${new Date(now)}`
      : [{ n: null }],
    audit ? recentActivity() : null,
  ]);
  const byDay = new Map(perDay.map((d) => [d.day, d]));
  return {
    activeUsers: people.active,
    newUsers7d: people.fresh,
    failedLogins24h: failed.n,
    activeSessions: sessions.n,
    loginsPerDay: Array.from({ length: DASHBOARD_DAYS }, (_, i) => {
      const date = shiftDate(first, i), d = byDay.get(date);
      return { date, success: d?.success ?? 0, failed: audit ? (d?.failed ?? 0) : null };
    }),
    recent,
  };
}
