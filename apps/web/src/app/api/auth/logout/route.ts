import { apiError, json } from "@/lib/server/api";
import { CSRF_HEADER, csrfOk } from "@/lib/server/csrf";
import { db } from "@/lib/server/mock/db";
import { getSession } from "@/lib/server/session";
import { logAuth } from "@/lib/server/sign-in";

/**
 * Sign out: ends the store session and clears the cookie. A full session must send its CSRF token; a sign-in still
 * waiting for its second factor has none and may cancel without one.
 */
export async function POST(req: Request): Promise<Response> {
  const s = await getSession();
  if (s.sid && !csrfOk(req.headers.get(CSRF_HEADER), s.csrf)) {
    return apiError(403, "csrf", "The security token is missing or expired. Reload the page and try again.");
  }
  const rec = s.sid ? db().sessions.get(s.sid) : undefined;
  const user = rec ? db().users.get(rec.userId) : undefined;
  if (rec && user) logAuth(req, "logout", rec.method, user.email, user.id);
  if (s.sid) db().sessions.delete(s.sid);
  s.destroy();
  return json({ ok: true });
}
