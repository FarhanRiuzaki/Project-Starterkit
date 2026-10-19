import { appDate, shiftDate } from "@starterkit/ui/lib/format";
import { json, withPermission } from "@/lib/server/api";
import { ACTIVITY_SORTERS } from "@/lib/server/audit-log";
import { db } from "@/lib/server/mock/db";
import { sortRows } from "@/lib/server/paginate";
import { DASHBOARD_DAYS, type DashboardDto } from "@/lib/shared/contracts/dashboard";

const HOUR = 3_600_000;

/** Home page numbers for any signed-in user; the audit-derived ones (failed sign-ins, recent activity) need audit.view. */
export async function GET(req: Request): Promise<Response> {
  return withPermission(req, null, async (ctx) => {
    const now = Date.now();
    const store = db();
    const audit = ctx.perms.has("audit.view");
    const users = [...store.users.values()];

    const today = appDate(now);
    const days = new Map<string, DashboardDto["loginsPerDay"][number]>(Array.from({ length: DASHBOARD_DAYS }, (_, i) => {
      const date = shiftDate(today, i - (DASHBOARD_DAYS - 1));
      return [date, { date, success: 0, failed: 0 }];
    }));
    let failedLogins24h = 0;
    for (const e of store.authLog.values()) {
      if (e.event !== "login_success" && e.event !== "login_failed") continue;
      const at = Date.parse(e.at);
      const day = days.get(appDate(at));
      if (day) day[e.event === "login_success" ? "success" : "failed"]++;
      if (e.event === "login_failed" && at > now - 24 * HOUR && at <= now) failedLogins24h++;
    }

    const body: DashboardDto = {
      activeUsers: users.filter((u) => u.isActive).length,
      newUsers7d: users.filter((u) => Date.parse(u.createdAt) >= now - 7 * 24 * HOUR).length,
      failedLogins24h: audit ? failedLogins24h : null,
      activeSessions: [...store.sessions.values()].filter((s) => store.users.get(s.userId)?.isActive).length,
      loginsPerDay: [...days.values()],
      recent: audit ? sortRows([...store.activity.values()], "-at", ACTIVITY_SORTERS).slice(0, 5) : null,
    };
    return json(body);
  });
}
