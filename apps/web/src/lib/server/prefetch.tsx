import "server-only";
import { type DehydratedState, dehydrate, QueryClient, type QueryKey } from "@tanstack/react-query";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import type { z } from "zod";
import { Hydrate } from "@/lib/client/hydrate";
import { ActivityQuery, AuthLogQuery } from "@starterkit/shared/contracts/audit";
import { SessionListQuery } from "@starterkit/shared/contracts/me";
import { PermissionListQuery, RoleListQuery } from "@starterkit/shared/contracts/rbac";
import { UserListQuery } from "@starterkit/shared/contracts/users";
import {
  ACTIVITY, AUTH_LOG, DASHBOARD_KEY, ME_KEY, MY_SESSIONS, PERMISSIONS_TABLE, roleKey, roleOptions, roleUrl, ROLES, SUPERADMINS,
  type TableDef, userDetail as userDetailQuery, USERS, userSessions as userSessionsTable,
} from "@/lib/shared/queries";
import { readTable, tableRequest } from "@/lib/shared/table-state";
import { backendJson, v1Path } from "./backend";
import { getSession } from "./session";

/**
 * One first-page read of a screen: the browser hook's query key and the `/api/...` URL the hook fetches (null = the
 * request would be the route's 400: nothing to prefetch).
 */
export type Read = { key: QueryKey; path: string | null };

export type SearchParams = Record<string, string | string[] | undefined>;
/** Next's `searchParams` prop → URLSearchParams (`get` = the first value, as in the browser). */
export function toSearch(sp: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v == null ? [] : [v]) out.append(k, x);
  return out;
}

/**
 * The first page of a server table at the URL state `sp`: the key and request useTableQuery builds (tableRequest).
 * A request the route's schema would reject (400) reads nothing.
 */
export function table<F extends Record<string, string>, Q>(def: TableDef<F>, sp: URLSearchParams, schema: z.ZodType<Q>): Read {
  const { url } = tableRequest(def.path, readTable(sp, def.spec), def.spec, def.params);
  const ok = schema.safeParse(Object.fromEntries(new URL(url, "http://local").searchParams)).success;
  return { key: [def.key, url], path: ok ? url : null };
}

/** What each screen reads first (app/(main)/** page.tsx lists its own), each the GET its browser hook sends. */
export const reads = {
  dashboard: (): Read => ({ key: DASHBOARD_KEY, path: "/api/dashboard" }),
  me: (): Read => ({ key: ME_KEY, path: "/api/me" }),
  mySessions: (sp: URLSearchParams) => table(MY_SESSIONS, sp, SessionListQuery),
  users: (sp: URLSearchParams) => table(USERS, sp, UserListQuery),
  roleOptions: (): Read => ({ key: roleOptions().key, path: roleOptions().url }),
  superadmins: (): Read => ({ key: SUPERADMINS.key, path: SUPERADMINS.url }),
  user: (id: string): Read => ({ key: userDetailQuery(id).key, path: userDetailQuery(id).url }),
  userSessions: (id: string, sp: URLSearchParams) => table(userSessionsTable(id), sp, SessionListQuery),
  roles: (sp: URLSearchParams) => table(ROLES, sp, RoleListQuery),
  role: (id: string): Read => ({ key: roleKey(id), path: roleUrl(id) }),
  permissions: (sp: URLSearchParams) => table(PERMISSIONS_TABLE, sp, PermissionListQuery),
  activity: (sp: URLSearchParams) => table(ACTIVITY, sp, ActivityQuery),
  authLog: (sp: URLSearchParams) => table(AUTH_LOG, sp, AuthLogQuery),
};

/**
 * Sends every read to the API (`/api/x` → `/v1/x`) with the session token, all at once, and puts each 200 answer under
 * its key in a dehydrated React Query cache. Anything else (403, 404, the API down) is left out: the browser then
 * fetches it and shows its own forbidden, not-found or error state.
 */
export async function prefetchState(token: string, list: readonly Read[], req?: { headers: Headers }): Promise<DehydratedState> {
  const client = new QueryClient();
  const answers = await Promise.all(list.map((r) => {
    const path = r.path && v1Path(r.path);
    return path ? backendJson(path, { token, req }) : null;
  }));
  answers.forEach((a, i) => {
    if (a?.status === 200) client.setQueryData(list[i]!.key, a.data);
  });
  return dehydrate(client);
}

/**
 * Server half of the no-flicker standard: a page wraps its screen in `<Prefetch reads={[…]}>`, so its first data is
 * read on the server from the same API endpoints the browser hooks call and handed to React Query; the page renders
 * filled on the first paint and the browser doesn't fetch it again. Without a full session nothing is read (the
 * layout sends the browser to sign-in).
 */
export async function Prefetch({ reads: list, children }: { reads: readonly Read[]; children: ReactNode }) {
  const s = await getSession();
  const state = s.token && s.csrf ? await prefetchState(s.token, list, { headers: await headers() }) : undefined;
  return <Hydrate state={state}>{children}</Hydrate>;
}
