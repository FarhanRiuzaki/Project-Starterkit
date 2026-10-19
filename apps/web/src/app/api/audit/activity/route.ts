import { handleError, json, withPermission } from "@/lib/server/api";
import { ACTIVITY_CSV, ACTIVITY_SORTERS, activityRows, auditCsv, NEWEST } from "@/lib/server/audit-log";
import { paginate } from "@/lib/server/paginate";
import { ActivityQuery } from "@/lib/shared/contracts/audit";

/** Activity log: one page (JSON) or the filtered list as CSV (`format=csv`). Read-only, so nothing is recorded. */
export async function GET(req: Request): Promise<Response> {
  const parsed = ActivityQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const q = parsed.data;
  return withPermission(req, "audit.view", async () => {
    const rows = activityRows(q);
    return q.format === "csv" ? auditCsv(rows, ACTIVITY_SORTERS, ACTIVITY_CSV) : json(paginate(rows, q, ACTIVITY_SORTERS, NEWEST));
  });
}
