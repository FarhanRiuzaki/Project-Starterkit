import { handleError, json, withPermission } from "@/lib/server/api";
import { sessionPage } from "@/lib/server/users";
import { SessionListQuery } from "@starterkit/shared/contracts/me";

/** One page of the caller's own sessions, newest activity first unless `sort` says otherwise. */
export async function GET(req: Request): Promise<Response> {
  const parsed = SessionListQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return handleError(parsed.error); // 400 before the guard reads anything
  const q = parsed.data;
  return withPermission(req, null, async (ctx) => json(sessionPage(ctx.user.id, q, ctx.sid)));
}
