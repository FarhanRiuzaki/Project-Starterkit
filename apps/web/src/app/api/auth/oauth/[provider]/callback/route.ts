import { cookies } from "next/headers";
import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { apiError } from "@/lib/server/api";
import { backend } from "@/lib/server/backend";
import { bodyOf } from "@/lib/server/forward";
import { isProvider, landingPage, OAUTH_COOKIE, oauthCookieOptions } from "@/lib/server/oauth";
import { getSession, storeSignIn } from "@/lib/server/session";

/**
 * Where the provider sends the browser back: `code` and `state` in the query (Google, the mock) or a posted form
 * (Apple). With this browser's `sk_oauth` binding (then cleared) the API spends the state and checks the provider's
 * answer. Sign-in: the session goes into the cookie (any earlier one ends). Every outcome is a landing page that moves
 * on to `next` (internal only), `/me/security?connected=<provider>`, `/login?error=oauth|inactive` or
 * `/me/security?oauth=failed`.
 */
async function callback(req: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  if (!isProvider(provider)) return apiError(404, "not_found", "This sign-in provider isn't available.");
  const jar = await cookies();
  const [mode, binding] = (jar.get(OAUTH_COOKIE)?.value ?? "").split(".");
  jar.set(OAUTH_COOKIE, "", { ...oauthCookieOptions(), maxAge: 0 });
  const failed = (code?: string) => landingPage(mode === "link" ? "/me/security?oauth=failed" : code === "account_inactive" ? "/login?error=inactive" : "/login?error=oauth");
  const form = req.method === "POST" ? await bodyOf(req) : null;
  const fields = req.method === "POST" ? new URLSearchParams(form ? await form.text() : "") : new URL(req.url).searchParams;
  const code = fields.get("code");
  const state = fields.get("state");
  // No code: the user canceled at the provider (`error=access_denied`) or the request didn't come from it.
  if (!code || !state || !binding) return failed();
  const res = await backend(`/v1/auth/oauth/${provider}/callback`, { method: "POST", contentType: "application/json", body: JSON.stringify({ code, state, binding }), req });
  if (!res.ok) return failed(((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code);
  const got = (await res.json()) as { next: string; token?: string };
  if (got.token) await storeSignIn(await getSession(), { token: got.token }, req);
  return landingPage(afterSignIn(got.next));
}

export { callback as GET, callback as POST };
