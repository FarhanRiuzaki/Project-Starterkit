// Transitional: the guard for the Hono routes until Tasks 16–18; the Elysia guard is modules/auth `guard`.
import type { Context } from "hono";
import type { PermissionName } from "@starterkit/shared/permissions";
import { authenticate, bearer as bearerOf, type Ctx } from "../modules/auth";
import type { AppEnv } from "./middleware";

export type { Ctx } from "../modules/auth";

/** The session token of `Authorization: Bearer <token>`, if any. */
export const bearer = (c: Context): string | undefined => bearerOf(c.req.header("authorization"));

/**
 * `Authorization: Bearer <session token>` → a live session (else 401 `unauthenticated`) → `perm` held (else 403
 * `forbidden`), before the handler reads anything. `null` = any signed-in user. CSRF is checked by Next, not here.
 */
export async function guard(c: Context<AppEnv>, perm: PermissionName | null): Promise<Ctx> {
  const auth = await authenticate(bearer(c), perm);
  return { ...auth, client: c.get("client"), requestId: c.get("requestId") };
}
