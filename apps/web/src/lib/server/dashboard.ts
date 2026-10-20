import { appDate, shiftDate } from "@starterkit/ui/lib/format";
import { FULL_SIGN_INS } from "@starterkit/shared/audit";
import { DASHBOARD_DAYS, type DashboardDto } from "@starterkit/shared/contracts/dashboard";
import { ACTIVITY_SORTERS } from "./audit-log";
import { db } from "./mock/db";
import { sortRows } from "./paginate";
import { type AuthCtx, pruneSessions } from "./session";

const HOUR = 3_600_000;

/**
 * Home page numbers (GET /api/dashboard and the / prefetch) for any signed-in user; the audit-derived ones (failed
 * sign-ins, recent activity) need audit.view.
 */
export function dashboard(ctx: AuthCtx): DashboardDto {
  const now = Date.now();
  const store = db();
  const audit = ctx.perms.has("audit.view");
  const users = [...store.users.values()];
  pruneSessions(now);

  const today = appDate(now);
  const days = new Map<string, { date: string; success: number; failed: number }>(Array.from({ length: DASHBOARD_DAYS }, (_, i) => {
    const date = shiftDate(today, i - (DASHBOARD_DAYS - 1));
    return [date, { date, success: 0, failed: 0 }];
  }));
  let failedLogins24h = 0;
  for (const e of store.authLog.values()) {
    // A sign-in counts once, when it completes (a 2FA account's password step is not one); a failure is a failed password step.
    const success = FULL_SIGN_INS.includes(e.event);
    if (!success && e.event !== "login_failed") continue;
    const at = Date.parse(e.at);
    const day = days.get(appDate(at));
    if (day) day[success ? "success" : "failed"]++;
    if (e.event === "login_failed" && at > now - 24 * HOUR && at <= now) failedLogins24h++;
  }

  return {
    // Failed counts are audit data: without audit.view only the successful sign-ins per day are sent.
    activeUsers: users.filter((u) => u.isActive).length,
    newUsers7d: users.filter((u) => Date.parse(u.createdAt) >= now - 7 * 24 * HOUR).length,
    failedLogins24h: audit ? failedLogins24h : null,
    activeSessions: [...store.sessions.values()].filter((s) => store.users.get(s.userId)?.isActive).length,
    loginsPerDay: [...days.values()].map((d) => (audit ? d : { ...d, failed: null })),
    recent: audit ? sortRows([...store.activity.values()], "-at", ACTIVITY_SORTERS).slice(0, 5) : null,
  };
}
