import { handleError, json, withPermission } from "@/lib/server/api";
import { ACTIVITY_CSV, ACTIVITY_SORTERS, activityPage, activityRows, auditCsv } from "@/lib/server/audit-log";
import { ActivityQuery } from "@starterkit/shared/contracts/audit";

/** Activity log: one page (JSON) or the filtered list as CSV (`format=csv`). Read-only, so nothing is recorded. */
export async function GET(req: Request): Promise<Response> {
  const parsed = ActivityQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const q = parsed.data;
  return withPermission(req, "audit.view", async () =>
    q.format === "csv" ? auditCsv(activityRows(q), ACTIVITY_SORTERS, ACTIVITY_CSV) : json(activityPage(q)));
}
