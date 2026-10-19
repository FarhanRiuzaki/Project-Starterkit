import { handleError, withPermission } from "@/lib/server/api";
import { ACTIVITY_CSV, ACTIVITY_SORTERS, activityRows, auditAnswer } from "@/lib/server/audit-log";
import { ActivityQuery } from "@/lib/shared/contracts/audit";

/** Activity log: one page (JSON) or the filtered list as CSV (`format=csv`). Read-only, so nothing is recorded. */
export async function GET(req: Request): Promise<Response> {
  const parsed = ActivityQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const q = parsed.data;
  return withPermission(req, "audit.view", async () => auditAnswer(q, activityRows(q), ACTIVITY_SORTERS, ACTIVITY_CSV));
}
