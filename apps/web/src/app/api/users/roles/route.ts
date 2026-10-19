import { json, withPermission } from "@/lib/server/api";
import { listRoles } from "@/lib/server/rbac";

/** Role names for the filter and the user form: the GET /api/roles list, names only, under user.view. */
export async function GET(req: Request): Promise<Response> {
  return withPermission(req, "user.view", async () => json(listRoles().map((r) => r.name)));
}
