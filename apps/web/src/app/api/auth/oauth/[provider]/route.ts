import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import { apiError } from "@/lib/server/api";
import { backend } from "@/lib/server/backend";
import { isProvider, OAUTH_COOKIE, oauthCookieOptions, seeOther } from "@/lib/server/oauth";
import { getSession } from "@/lib/server/session";

/**
 * Start a Google/Apple sign-in (`mode=login`, default; `next` for afterwards) or a link to the signed-in user
 * (`mode=link`, full session required, else sign-in). A navigation, so another site can link here; that's harmless:
 * a new random binding goes into `sk_oauth`, the API stores its hash with the state, and only this browser can finish.
 * Then 303 to the provider (or the mock authorize page). A refusal lands on the sign-in or security screen; a link
 * from a session that hasn't proved the user within 10 minutes lands on `/me/security?oauth=reauth`.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  if (!isProvider(provider)) return apiError(404, "not_found", "This sign-in provider isn't available.");
  const q = new URL(req.url).searchParams;
  const mode = q.get("mode") === "link" ? "link" : "login";
  const s = await getSession();
  if (mode === "link" && !(s.token && s.csrf)) return seeOther("/login?next=%2Fme%2Fsecurity");
  const binding = randomBytes(32).toString("base64url");
  // Internal and at most what the API accepts (2048), else Overview: an odd `next` never costs the sign-in.
  const next = afterSignIn(q.get("next"));
  const res = await backend(`/v1/auth/oauth/${provider}/start`, {
    // The bearer in both modes: the API ties the state to this session (ending it cancels the round trip; a sign-in ends it).
    method: "POST", contentType: "application/json", token: s.token && s.csrf ? s.token : null, req,
    body: JSON.stringify({ mode, next: next.length <= 2048 ? next : "/", bindingHash: createHash("sha256").update(binding).digest("base64url") }),
  });
  if (!res.ok) {
    await res.body?.cancel();
    // 403 on a link: the session hasn't proved the user within 10 minutes; the security screen asks for the proof.
    if (mode === "link") return seeOther(res.status === 403 ? "/me/security?oauth=reauth" : "/me/security?oauth=failed");
    return seeOther("/login?error=oauth");
  }
  const { url } = (await res.json()) as { url: string };
  (await cookies()).set(OAUTH_COOKIE, `${mode}.${binding}`, oauthCookieOptions());
  return seeOther(url);
}
