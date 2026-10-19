import { json, withPermission } from "@/lib/server/api";
import { db } from "@/lib/server/mock/db";

/** Role names for the filter and the user form. Names only (no permissions), under user.view. */
export async function GET(req: Request): Promise<Response> {
  return withPermission(req, "user.view", async () => json([...db().roles.values()].map((r) => r.name)));
}
