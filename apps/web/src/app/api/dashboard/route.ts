import { json, withPermission } from "@/lib/server/api";
import { dashboard } from "@/lib/server/dashboard";

/** Home page numbers for any signed-in user; the audit-derived ones (failed sign-ins, recent activity) need audit.view. */
export async function GET(req: Request): Promise<Response> {
  return withPermission(req, null, async (ctx) => json(dashboard(ctx)));
}
