import { crossSite, csrfFailed, json, sameOrigin } from "@/lib/server/api";
import { backend } from "@/lib/server/backend";
import { CSRF_HEADER, csrfOk } from "@/lib/server/csrf";
import { getSession } from "@/lib/server/session";

/**
 * Sign out: ends the API session (or the pending sign-in) and clears the cookie. A full session must send its CSRF
 * token; a sign-in still waiting for its second factor has none and may cancel without one.
 */
export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return crossSite();
  const s = await getSession();
  if (s.token && !csrfOk(req.headers.get(CSRF_HEADER), s.csrf)) return csrfFailed();
  if (s.token || s.challenge) await backend("/v1/auth/logout", { method: "POST", token: s.token, challenge: s.challenge, req });
  s.destroy();
  return json({ ok: true });
}
