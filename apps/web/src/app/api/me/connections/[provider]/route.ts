import { apiError, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { toUserDto } from "@/lib/server/mock/db";
import { ConnectionProvider } from "@/lib/shared/contracts/me";

type Ctx = { params: Promise<{ provider: string }> };
const bad = () => apiError(400, "bad_request", "A request parameter has an unsupported value.");

/** Mock: no provider round trip, the link is just recorded on the user. */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const provider = ConnectionProvider.safeParse((await params).provider);
  return withPermission(req, null, async (ctx) => {
    if (!provider.success) return bad();
    const u = ctx.user;
    if (!u.connected.includes(provider.data)) u.connected = [...u.connected, provider.data];
    recordActivity(ctx, { action: "me.connect", target: { type: "user", id: u.id, label: u.name }, after: { provider: provider.data } });
    return json(toUserDto(u));
  });
}

/** Refused when it is the only way to sign in (no password, not LDAP, nothing else connected). */
export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const provider = ConnectionProvider.safeParse((await params).provider);
  return withPermission(req, null, async (ctx) => {
    if (!provider.success) return bad();
    const u = ctx.user;
    const rest = u.connected.filter((x) => x !== provider.data);
    if (!u.passwordHash && !u.isLdap && rest.length === 0) {
      return apiError(409, "self_action", "This is your only way to sign in. Set a password or connect another account first.");
    }
    u.connected = rest;
    recordActivity(ctx, { action: "me.disconnect", target: { type: "user", id: u.id, label: u.name }, before: { provider: provider.data } });
    return json(toUserDto(u));
  });
}
