import { json, withPermission } from "@/lib/server/api";
import { db } from "@/lib/server/mock/db";
import type { SessionDto } from "@/lib/shared/contracts/me";

/** Only the caller's own sessions, newest activity first. */
export async function GET(req: Request): Promise<Response> {
  return withPermission(req, null, async (ctx) => {
  const items: SessionDto[] = [...db().sessions.values()]
    .filter((s) => s.userId === ctx.user.id)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .map((s) => ({ id: s.id, device: s.device, ip: s.ip, lastSeenAt: s.lastSeenAt, current: s.id === ctx.sid }));
  return json(items);
  });
}
