import "server-only";
import { type DehydratedState, dehydrate, QueryClient, type QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { z } from "zod";
import { Hydrate } from "@/lib/client/hydrate";
import { ActivityQuery, AuthLogQuery } from "@starterkit/shared/contracts/audit";
import { SessionListQuery } from "@starterkit/shared/contracts/me";
import { PermissionListQuery, RoleListQuery, RoleOptionQuery } from "@starterkit/shared/contracts/rbac";
import { UserListQuery } from "@starterkit/shared/contracts/users";
import type { PermissionName } from "@starterkit/shared/permissions";
import {
  ACTIVITY, AUTH_LOG, DASHBOARD_KEY, ME_KEY, MY_SESSIONS, PERMISSIONS_TABLE, roleKey, roleOptions, ROLES, SUPERADMINS,
  type TableDef, userDetail as userDetailQuery, USERS, userSessions as userSessionsTable,
} from "@/lib/shared/queries";
import { readTable, tableRequest } from "@/lib/shared/table-state";
import { activityPage, authLogPage } from "./audit-log";
import { dashboard } from "./dashboard";
import { db, toMeDto } from "./mock/db";
import { permissionPage, roleById, rolePage } from "./rbac";
import { type AuthCtx, authOf, getSession } from "./session";
import { roleOptionPage, sessionPage, userDetail, userPage } from "./users";

/**
 * One first-page read of a screen: the browser hook's query key, the permission its /api route checks, and the
 * route's own read function (null = the route would answer 400 or 404: nothing to prefetch).
 */
export type Read = { key: QueryKey; perm: PermissionName | null; data: (ctx: AuthCtx) => unknown };

export type SearchParams = Record<string, string | string[] | undefined>;
/** Next's `searchParams` prop → URLSearchParams (`get` = the first value, as in the browser). */
export function toSearch(sp: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v == null ? [] : [v]) out.append(k, x);
  return out;
}

/** The query of an /api URL, parsed with the route's schema exactly as the route parses it; null = the route's 400. */
function parse<T>(schema: z.ZodType<T>, url: string): T | null {
  const r = schema.safeParse(Object.fromEntries(new URL(url, "http://local").searchParams));
  return r.success ? r.data : null;
}

/**
 * The first page of a server table at the URL state `sp`: the key and request useTableQuery builds (tableRequest).
 * A request the route's schema would reject (400) reads nothing.
 */
export function table<F extends Record<string, string>, Q>(
  def: TableDef<F>, sp: URLSearchParams, perm: PermissionName | null, schema: z.ZodType<Q>, page: (q: Q, ctx: AuthCtx) => unknown,
): Read {
  const { url } = tableRequest(def.path, readTable(sp, def.spec), def.spec, def.params);
  return { key: [def.key, url], perm, data: (ctx) => { const q = parse(schema, url); return q && page(q, ctx); } };
}

/** What each screen reads first (app/(main)/** page.tsx lists its own), each mirroring its GET route. */
export const reads = {
  dashboard: (): Read => ({ key: DASHBOARD_KEY, perm: null, data: dashboard }),
  me: (): Read => ({ key: ME_KEY, perm: null, data: (ctx) => toMeDto(ctx.user) }),
  mySessions: (sp: URLSearchParams) => table(MY_SESSIONS, sp, null, SessionListQuery, (q, ctx) => sessionPage(ctx.user.id, q, ctx.sid)),
  users: (sp: URLSearchParams) => table(USERS, sp, "user.view", UserListQuery, userPage),
  roleOptions: (): Read => {
    const { key, url } = roleOptions();
    return { key, perm: "user.view", data: () => { const q = parse(RoleOptionQuery, url); return q && roleOptionPage(q); } };
  },
  superadmins: (): Read => ({ key: SUPERADMINS.key, perm: "user.view", data: () => { const q = parse(UserListQuery, SUPERADMINS.url); return q && userPage(q); } }),
  user: (id: string): Read => ({ key: userDetailQuery(id).key, perm: "user.view", data: (ctx) => userDetail(id, ctx) }),
  userSessions: (id: string, sp: URLSearchParams) =>
    table(userSessionsTable(id), sp, "user.view", SessionListQuery, (q, ctx) => (db().users.has(id) ? sessionPage(id, q, ctx.sid) : null)),
  roles: (sp: URLSearchParams) => table(ROLES, sp, "role.view", RoleListQuery, rolePage),
  role: (id: string): Read => ({ key: roleKey(id), perm: "role.view", data: () => roleById(id) }),
  permissions: (sp: URLSearchParams) => table(PERMISSIONS_TABLE, sp, "permission.view", PermissionListQuery, permissionPage),
  activity: (sp: URLSearchParams) => table(ACTIVITY, sp, "audit.view", ActivityQuery, activityPage),
  authLog: (sp: URLSearchParams) => table(AUTH_LOG, sp, "audit.view", AuthLogQuery, authLogPage),
};

/**
 * Runs the reads `ctx` may make, with the permission check of their /api route (a read it would refuse is skipped,
 * and the browser then shows its own forbidden or error state), into a dehydrated React Query cache.
 */
export function prefetchState(ctx: AuthCtx, list: readonly Read[]): DehydratedState {
  const client = new QueryClient();
  for (const r of list) {
    if (r.perm && !ctx.perms.has(r.perm)) continue;
    const data = r.data(ctx);
    if (data != null) client.setQueryData(r.key, data);
  }
  return dehydrate(client);
}

/**
 * Server half of the no-flicker standard: a page wraps its screen in `<Prefetch reads={[…]}>`, so its first data is
 * read on the server with the /api route's own functions and handed to React Query; the page renders filled on the
 * first paint and the browser doesn't fetch it again. Like withPermission, it marks the session seen (authOf).
 */
export async function Prefetch({ reads: list, children }: { reads: readonly Read[]; children: ReactNode }) {
  const ctx = authOf(await getSession());
  return <Hydrate state={ctx ? prefetchState(ctx, list) : undefined}>{children}</Hydrate>;
}
