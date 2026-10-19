import { apiError, badRequest, json, withPermission } from "@/lib/server/api";
import { recordActivity } from "@/lib/server/audit";
import { toMeDto } from "@/lib/server/mock/db";
import { oauthOnly, reauth } from "@/lib/server/sign-in";
import { duplicateOf } from "@/lib/server/users";
import { UpdateProfileBody } from "@/lib/shared/contracts/me";

export async function GET(req: Request): Promise<Response> {
  return withPermission(req, null, async (ctx) => json(toMeDto(ctx.user)));
}

/**
 * Own name and email. The username is not in the schema, so it can't change here. A new email (other than a change of
 * letter case) is the sign-in identity, so it needs `currentPassword` (re-authentication, throttled like the password
 * change); an account that signs in only through Google or Apple keeps the provider's email.
 */
export async function PATCH(req: Request): Promise<Response> {
  const body = UpdateProfileBody.safeParse(await req.json().catch(() => null));
  return withPermission(req, null, async (ctx) => {
    if (!body.success) return badRequest();
    const { name, email, currentPassword } = body.data;
    const u = ctx.user;
    if (email !== undefined && email.toLowerCase() !== u.email.toLowerCase()) {
      if (oauthOnly(u)) return apiError(409, "self_action", "Your email is the sign-in identity of your connected Google or Apple account, so it can't change here.");
      if (currentPassword === undefined) return apiError(400, "bad_request", "Enter your current password to change your email.");
      const denied = reauth(u, { password: currentPassword });
      if (denied) return denied;
      if (duplicateOf(undefined, email, u.id)) return apiError(409, "duplicate", "Another user already has this email. Use a different one.");
    }
    const before = { name: u.name, email: u.email };
    if (name) u.name = name;
    if (email) u.email = email;
    recordActivity(ctx, { action: "me.update", target: { type: "user", id: u.id, label: u.name }, before, after: { name: u.name, email: u.email } });
    return json(toMeDto(u));
  });
}
