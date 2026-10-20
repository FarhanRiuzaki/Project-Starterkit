import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { AuthContextDto } from "@starterkit/shared/contracts/auth";
import type { UserDto } from "@starterkit/shared/contracts/users";
import type { PermissionName } from "@starterkit/shared/permissions";
import { backend, backendJson } from "./backend";
import { type Config, config } from "./config";
import { newCsrfToken } from "./csrf";

export const SESSION_COOKIE = "sk_session";

/**
 * The sealed cookie holds only `{ token, csrf }` (a full session: the API's session token and the mutation token) or
 * `{ challenge }` (password passed, second factor due). The user, permissions and session times live in the API.
 */
export type AppSession = { token?: string; csrf?: string; challenge?: string };

export function sessionOptions(c: Config = config()): SessionOptions {
  return {
    password: c.SESSION_SECRET,
    cookieName: SESSION_COOKIE,
    ttl: c.SESSION_TTL_HOURS * 3600,
    cookieOptions: { httpOnly: true, sameSite: "strict", secure: c.COOKIE_SECURE, path: "/" },
  };
}

export async function getSession() {
  return getIronSession<AppSession>(await cookies(), sessionOptions());
}

/**
 * The signed-in user and their permissions (catalog order) from `GET /v1/auth/context`, or null: no full session in
 * the cookie, or the API answers 401 (ended, expired, idle, user gone or inactive; the cookie is then cleared where
 * cookies can be written). Any other answer throws, so a down API shows the error page, not the sign-in page.
 * Memoized per request (React.cache): the layout, the page guard and the title share one call.
 */
export const authContext = cache(async (): Promise<{ user: UserDto; perms: PermissionName[] } | null> => {
  const s = await getSession();
  if (!s.token || !s.csrf) return null;
  const { status, data } = await backendJson<AuthContextDto>("/v1/auth/context", { token: s.token, req: { headers: await headers() } });
  if (status === 401) {
    try {
      s.destroy();
    } catch {
      // A server component can't write cookies; the next /api call or sign-in replaces it.
    }
    return null;
  }
  if (!data) throw new Error(`auth context answered ${status}`);
  return { user: data.user, perms: data.permissions };
});

/**
 * Stores a sign-in in the cookie: a full session (`token` + a new CSRF token) or a pending second factor
 * (`challenge`). A session or pending sign-in the browser already held ends at the API first (best effort), so one
 * browser holds one session.
 */
export async function storeSignIn(s: Awaited<ReturnType<typeof getSession>>, got: { token?: string; challenge?: string }, req: Request): Promise<void> {
  if (s.token || s.challenge) await backend("/v1/auth/logout", { method: "POST", token: s.token, challenge: s.challenge, req });
  s.token = got.token;
  s.csrf = got.token ? newCsrfToken() : undefined;
  s.challenge = got.challenge;
  await s.save();
}
