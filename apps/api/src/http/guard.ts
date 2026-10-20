import type { Context } from "hono";
import type { PermissionName } from "@starterkit/shared/permissions";
import { type AuthUser, resolveSession } from "../auth/sessions";
import { ApiError } from "./errors";
import type { AppEnv } from "./middleware";

/** What a guarded handler knows about its request: the user, session, permissions, client and request id. */
export type Ctx = AuthUser & { client: { ip: string; ua: string }; requestId: string };

/** The session token of `Authorization: Bearer <token>`, if any. */
export const bearer = (c: Context): string | undefined => /^Bearer (\S+)$/i.exec(c.req.header("authorization") ?? "")?.[1];

/**
 * `Authorization: Bearer <session token>` → a live session (else 401 `unauthenticated`) → `perm` held (else 403
 * `forbidden`), before the handler reads anything. `null` = any signed-in user. CSRF is checked by Next, not here.
 */
export async function guard(c: Context<AppEnv>, perm: PermissionName | null): Promise<Ctx> {
  const token = bearer(c);
  const auth = token ? await resolveSession(token) : null;
  if (!auth) throw new ApiError("unauthenticated");
  if (perm && !auth.perms.has(perm)) throw new ApiError("forbidden");
  return { ...auth, client: c.get("client"), requestId: c.get("requestId") };
}
