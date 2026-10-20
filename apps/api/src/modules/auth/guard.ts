import { Elysia } from "elysia";
import type { PermissionName } from "@starterkit/shared/permissions";
import { ApiError } from "../../kernel/errors";
import { type Client, context } from "../../kernel/plugins/context";
import { type AuthUser, resolveSession } from "./sessions";

/** What a guarded handler knows about its request: the user, session, permissions, client and request id. */
export type Ctx = AuthUser & { client: Client; requestId: string };

/** The session token of an `Authorization: Bearer <token>` header value, if any. */
export const bearer = (header: string | null | undefined): string | undefined => /^Bearer (\S+)$/i.exec(header ?? "")?.[1];

/**
 * A bearer token → a live session (else 401 `unauthenticated`) → `perm` held (else 403 `forbidden`), before anything
 * else is read. `null` = any signed-in user. CSRF is checked by Next, not here.
 */
export async function authenticate(token: string | undefined, perm: PermissionName | null): Promise<AuthUser> {
  const auth = token ? await resolveSession(token) : null;
  if (!auth) throw new ApiError("unauthenticated");
  if (perm && !auth.perms.has(perm)) throw new ApiError("forbidden");
  return auth;
}

/**
 * Route option `guard: perm | null` (a resolve, so it runs after the query schema and before the handler): the
 * contract's order is query 400 → guard 401/403 → body 400 (`body()` in the handler) → 404 → rules → change →
 * activity. The handler reads `ctx`.
 */
export const guard = new Elysia({ name: "auth.guard" }).use(context).macro({
  guard: (perm: PermissionName | null) => ({
    resolve: async ({ request, client, requestId }) => {
      const auth = await authenticate(bearer(request.headers.get("authorization")), perm);
      return { ctx: { ...auth, client, requestId } satisfies Ctx as Ctx };
    },
  }),
});
