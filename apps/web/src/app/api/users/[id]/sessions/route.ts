import { handleError, json, notFound, withPermission } from "@/lib/server/api";
import { db } from "@/lib/server/mock/db";
import { sessionPage } from "@/lib/server/users";
import { SessionListQuery } from "@/lib/shared/contracts/me";

/** One page of a user's sessions, newest activity first unless `sort` says otherwise; the caller's own is marked current. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const parsed = SessionListQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const q = parsed.data;
  return withPermission(req, "user.view", async (ctx) => {
    if (!db().users.has(id)) return notFound("user");
    return json(sessionPage(id, q, ctx.sid));
  });
}
