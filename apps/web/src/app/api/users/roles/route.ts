import { json, withPermission } from "@/lib/server/api";
import { db } from "@/lib/server/mock/db";

/** Role names for the filter and the user form. Names only (no permissions), so a signed-in user is enough. */
export async function GET(req: Request): Promise<Response> {
  return withPermission(req, null, async () => json([...db().roles.values()].map((r) => r.name)));
}
