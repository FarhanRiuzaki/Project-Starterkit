// What a screen reads first, as query keys and API URLs: the browser hooks (features/*) and the server prefetch
// (lib/server/prefetch.tsx) both build their keys here, so a server-prefetched query is exactly the one the hook asks
// for and the browser never fetches it again. Pure (no React, no zod).
// Key scheme: the first element is the module that owns the data (users, rbac, me, audit, dashboard), then what
// identifies the read (a table's URL, "detail" + id, …), so invalidating a module's key refreshes all of it.
import { ACTION_OPTIONS, ACTIVITY_SORTS, AUDIT_RANGES, AUTH_EVENTS, AUTH_LOG_SORTS, AUTH_METHODS, presetRange, rangeProblem } from "@starterkit/shared/audit";
import type { AuthLogDto } from "@starterkit/shared/contracts/audit";
import { PERMISSION_SORTS, ROLE_SORTS, SESSION_SORTS, USER_SORTS } from "@starterkit/shared/paging";
import { MODULES } from "@starterkit/shared/permissions";
import { type FilterParser, isoDate, oneOf, type TableSpec, text } from "./table-state";

/** A server-driven table: query-key prefix, API path, URL state spec, and (optionally) URL filters → API params. */
export type TableDef<F extends Record<string, string>> = {
  key: string; path: `/api/${string}`; spec: TableSpec<F>; params?: (filters: F) => Record<string, string>;
};
export type NoFilters = Record<never, string>;

export const DASHBOARD_KEY = ["dashboard"] as const;

/** The signed-in user; own sessions live under the same prefix, so one invalidation refreshes both. */
export const ME_KEY = ["me"] as const;
export const SESSIONS_SPEC: TableSpec<NoFilters> = { sorts: SESSION_SORTS, defaultSort: "-lastSeenAt", filters: {} };
export const MY_SESSIONS: TableDef<NoFilters> = { key: ME_KEY[0], path: "/api/me/sessions", spec: SESSIONS_SPEC };
/** The signed-in user's saved views of list page `path` (at most 20, so one page of 25 holds them all). */
export const savedViews = (path: string) => ({ key: [...ME_KEY, "views", path] as const, url: `/api/me/views?${new URLSearchParams({ path, pageSize: "25" })}` });

export const USERS_KEY = ["users"] as const;
export const USER_STATUSES = ["", "active", "inactive"] as const;
export type UserFilters = { q: string; role: string; status: (typeof USER_STATUSES)[number] };
export const USERS: TableDef<UserFilters> = {
  key: USERS_KEY[0], path: "/api/users",
  spec: { sorts: USER_SORTS, defaultSort: "name", search: ["q"], filters: { q: text(200), role: text(64), status: oneOf(USER_STATUSES, "") } },
};
export const userDetail = (id: string) => ({ key: [...USERS_KEY, "detail", id] as const, url: `/api/users/${encodeURIComponent(id)}` });
export const userSessions = (id: string): TableDef<NoFilters> => ({ key: USERS_KEY[0], path: `/api/users/${encodeURIComponent(id)}/sessions`, spec: SESSIONS_SPEC });
/** Role pickers ask for one page of 100 (name A–Z), or the roles matching `q`. */
export const roleOptions = (q = "") => ({
  key: [...USERS_KEY, "roles", q] as const, url: `/api/users/roles?${new URLSearchParams(q ? { pageSize: "100", q } : { pageSize: "100" })}`,
});
/** Active Superadmins, to know whether one is the last (it can't be deactivated or deleted). */
export const SUPERADMINS = { key: [...USERS_KEY, "superadmins"] as const, url: "/api/users?role=Superadmin&status=active" };

export const RBAC_KEY = ["rbac"] as const;
export const roleUrl = (id: string) => `/api/roles/${encodeURIComponent(id)}`;
export const roleKey = (id: string) => [...RBAC_KEY, "role", id] as const;
export const ROLES: TableDef<{ q: string }> = {
  key: RBAC_KEY[0], path: "/api/roles", spec: { sorts: ROLE_SORTS, defaultSort: "name", search: ["q"], filters: { q: text(200) } },
};
export const PERMISSION_MODULES = ["", ...MODULES.map((m) => m.key)];
export const PERMISSIONS_TABLE: TableDef<{ q: string; module: string }> = {
  key: RBAC_KEY[0], path: "/api/permissions",
  spec: { sorts: PERMISSION_SORTS, defaultSort: "module", search: ["q"], filters: { q: text(200), module: oneOf(PERMISSION_MODULES, "") } },
};

export const AUDIT_KEY = ["audit"] as const;

/** Filters both audit logs share: who (free text, debounced) and the range: a preset, or a custom from–to pair that wins when valid. */
export type AuditFilters = { user: string; range: (typeof AUDIT_RANGES)[number]; from: string; to: string };
const AUDIT_FILTERS = { user: text(64), range: oneOf(AUDIT_RANGES, "7d"), from: isoDate, to: isoDate } satisfies { [K in keyof AuditFilters]: FilterParser<AuditFilters[K]> };
export const customRange = (f: { from: string; to: string }) => (f.from && f.to && rangeProblem(f.from, f.to) === null ? { from: f.from, to: f.to } : null);
/** API parameters: a valid custom from–to, else the preset as from/to calendar dates (app time zone, today included). */
const auditParams = ({ range, from, to, ...rest }: AuditFilters & Record<string, string>) =>
  ({ ...rest, ...(customRange({ from, to }) ?? presetRange(range, Date.now())) });

export type ActivityFilters = AuditFilters & { action: string };
export const ACTIONS = [{ value: "", label: "Any" }, ...ACTION_OPTIONS];
export const ACTIVITY: TableDef<ActivityFilters> = {
  key: AUDIT_KEY[0], path: "/api/audit/activity", params: auditParams,
  spec: { sorts: ACTIVITY_SORTS, defaultSort: "-at", search: ["user"], filters: { ...AUDIT_FILTERS, action: oneOf(ACTIONS.map((a) => a.value), "") } },
};
export type AuthLogFilters = AuditFilters & { event: AuthLogDto["event"] | ""; method: AuthLogDto["method"] | "" };
export const AUTH_LOG: TableDef<AuthLogFilters> = {
  key: AUDIT_KEY[0], path: "/api/audit/auth", params: auditParams,
  spec: {
    sorts: AUTH_LOG_SORTS, defaultSort: "-at", search: ["user"],
    filters: { ...AUDIT_FILTERS, event: oneOf(["", ...AUTH_EVENTS], ""), method: oneOf(["", ...AUTH_METHODS], "") },
  },
};
