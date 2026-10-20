import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { apiError } from "@/lib/server/api";
import { backend } from "@/lib/server/backend";
import { isProvider, OAUTH_COOKIE, oauthCookieOptions, seeOther } from "@/lib/server/oauth";
import { getSession } from "@/lib/server/session";

/**
 * Start a Google/Apple sign-in (`mode=login`, default; `next` for afterwards) or a link to the signed-in user
 * (`mode=link`, full session required, else sign-in). A navigation, so another site can link here; that's harmless:
 * a new random binding goes into `sk_oauth`, the API stores its hash with the state, and only this browser can finish.
 * Then 303 to the provider (or the mock authorize page). A refusal lands on the sign-in or security screen.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  if (!isProvider(provider)) return apiError(404, "not_found", "This sign-in provider isn't available.");
  const q = new URL(req.url).searchParams;
  const mode = q.get("mode") === "link" ? "link" : "login";
  const s = await getSession();
  if (mode === "link" && !(s.token && s.csrf)) return seeOther("/login?next=%2Fme%2Fsecurity");
  const binding = randomBytes(32).toString("base64url");
  const res = await backend(`/v1/auth/oauth/${provider}/start`, {
    method: "POST", contentType: "application/json", token: mode === "link" ? s.token : null, req,
    body: JSON.stringify({ mode, next: q.get("next") ?? undefined, bindingHash: createHash("sha256").update(binding).digest("base64url") }),
  });
  if (!res.ok) {
    await res.body?.cancel();
    return seeOther(mode === "link" ? "/me/security?oauth=failed" : "/login?error=oauth");
  }
  const { url } = (await res.json()) as { url: string };
  (await cookies()).set(OAUTH_COOKIE, `${mode}.${binding}`, oauthCookieOptions());
  return seeOther(url);
}
