import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { apiError } from "@/lib/server/api";
import { db } from "@/lib/server/mock/db";
import { getSession } from "@/lib/server/session";
import { completeSignIn, logAuth } from "@/lib/server/sign-in";

/**
 * Mock OAuth: no provider round trip; signs in as the seeded active user connected to the provider and redirects
 * (303, relative Location) to `next` when internal. The provider counts as the second factor here, so a user with
 * 2FA is not asked for a code.
 */
// ponytail: no OAuth state/nonce (nothing leaves the app); a real provider needs state + PKCE checked on the callback.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  if (provider !== "google" && provider !== "apple") return apiError(404, "not_found", "This sign-in provider isn't available.");
  const user = [...db().users.values()].find((u) => u.isActive && u.connected.includes(provider));
  if (!user) return apiError(404, "not_found", "No active user is connected to this provider.");
  await completeSignIn(await getSession(), user, provider, req);
  logAuth(req, "login_success", provider, user.email, user.id);
  const to = afterSignIn(new URL(req.url).searchParams.get("next"));
  return new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store" } });
}
