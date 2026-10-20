import { handleError, json, withPermission } from "@/lib/server/api";
import { AUTH_LOG_CSV, AUTH_LOG_SORTERS, auditCsv, authLogPage, authLogRows } from "@/lib/server/audit-log";
import { AuthLogQuery } from "@starterkit/shared/contracts/audit";

/** Sign-in log: one page (JSON) or the filtered list as CSV (`format=csv`). Read-only, so nothing is recorded. */
export async function GET(req: Request): Promise<Response> {
  const parsed = AuthLogQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const q = parsed.data;
  return withPermission(req, "audit.view", async () =>
    q.format === "csv" ? auditCsv(authLogRows(q), AUTH_LOG_SORTERS, AUTH_LOG_CSV) : json(authLogPage(q)));
}
