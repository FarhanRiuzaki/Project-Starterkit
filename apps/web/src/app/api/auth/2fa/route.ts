import { crossSite, json, sameOrigin } from "@/lib/server/api";
import { backend, relay } from "@/lib/server/backend";
import { bodyOf, tooLarge } from "@/lib/server/forward";
import { getSession, storeSignIn } from "@/lib/server/session";

/**
 * Sign-in step 2: the code goes to `POST /v1/auth/2fa` with the cookie's challenge (`X-Auth-Challenge`). Success
 * stores the session; an expired or unknown challenge (401) or a deactivated account (403) clears the cookie.
 */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  const body = await bodyOf(req);
  if (!body) return tooLarge();
  const s = await getSession();
  const res = await backend("/v1/auth/2fa", { method: "POST", body, contentType: "application/json", challenge: s.challenge, req });
  if (!res.ok) {
    if (s.challenge && (res.status === 401 || res.status === 403)) s.destroy();
    return relay(res);
  }
  const { next, token } = (await res.json()) as { next: string; token: string };
  s.challenge = undefined; // spent by the API
  s.challengeAt = undefined;
  await storeSignIn(s, { token }, req);
  return json({ next });
}
