// What a screen reads first, as query keys and API URLs: the browser hooks (features/*) and the server prefetch
// (lib/server/prefetch.tsx) both build their keys here, so a server-prefetched query is exactly the one the hook asks
// for and the browser never fetches it again. Pure (no React, no zod).
// Key scheme: the first element is the module that owns the data (users, rbac, me, audit, dashboard, projects), then what
// identifies the read (a table's URL, "detail" + id, …), so invalidating a module's key refreshes all of it.
import { isTimeExpression, resolveTimeRange } from "@starterkit/ui/lib/time-range";
import { ACTIVITY_ID_PATTERN } from "@starterkit/shared/audit-investigation";
import { ACTION_OPTIONS, ACTIVITY_SORTS, AUDIT_RANGES, AUTH_LOG_SORTS, presetRange, rangeProblem } from "@starterkit/shared/audit";
import { PERMISSION_SORTS, PROJECT_SORTS, ROLE_SORTS, SESSION_SORTS, USER_SORTS } from "@starterkit/shared/paging";
import { MODULES } from "@starterkit/shared/permissions";
import { timeRange } from "./time-controls";
import { type FilterParser, isoDate, multiChoice, oneOf, type TableSpec, type TableState, text } from "./table-state";

/** A server-driven table: query-key prefix, API path, URL state spec, and (optionally) URL filters → API params. */
export type TableDef<F extends Record<string, string>> = {
  key: string; path: `/api/${string}`; spec: TableSpec<F>; transient?: readonly string[]; rawFilters?: readonly string[]; params?: (filters: F) => Record<string, string>;
  edit?: (source: URLSearchParams, patch: Partial<TableState<F>>) => URLSearchParams | null;
};
export type NoFilters = Record<never, string>;

export const DASHBOARD_KEY = ["dashboard"] as const;
export function dashboardRead(sp: Pick<URLSearchParams, "get">) {
  if (!sp.get("range") && !sp.get("from") && !sp.get("to") && !sp.get("start") && !sp.get("end")) return { key: DASHBOARD_KEY, path: "/api/dashboard" };
  const { params } = timeRange(sp);
  const path = `/api/dashboard?${new URLSearchParams(params)}`;
  return { key: [...DASHBOARD_KEY, path], path };
}

/** The signed-in user; own sessions live under the same prefix, so one invalidation refreshes both. */
export const ME_KEY = ["me"] as const;
export const SESSIONS_SPEC: TableSpec<NoFilters> = { sorts: SESSION_SORTS, defaultSort: "-lastSeenAt", filters: {} };
export const MY_SESSIONS: TableDef<NoFilters> = { key: ME_KEY[0], path: "/api/me/sessions", spec: SESSIONS_SPEC };
/** The signed-in user's saved views of list page `path` (at most 20, so one page of 25 holds them all). */
export const savedViews = (path: string) => ({ key: [...ME_KEY, "views", path] as const, url: `/api/me/views?${new URLSearchParams({ path, pageSize: "25" })}` });

export const USERS_KEY = ["users"] as const;
export const USER_STATUSES = ["", "active", "inactive"] as const;
export type UserFilters = { q: string; role: string; status: string };
export const USERS: TableDef<UserFilters> = {
  key: USERS_KEY[0], path: "/api/users",
  spec: { sorts: USER_SORTS, defaultSort: "name", search: ["q"], filters: { q: text(200), role: multiChoice(), status: multiChoice() } },
};
export const userDetail = (id: string) => ({ key: [...USERS_KEY, "detail", id] as const, url: `/api/users/${encodeURIComponent(id)}` });
export const userSessions = (id: string): TableDef<NoFilters> => ({ key: USERS_KEY[0], path: `/api/users/${encodeURIComponent(id)}/sessions`, spec: SESSIONS_SPEC });
/** Role pickers ask for one page of 100 (name A–Z), or the roles matching `q`. */
export const roleOptions = (q = "", page = 1) => ({
  key: [...USERS_KEY, "roles", q, ...(page === 1 ? [] : [page])] as const, url: `/api/users/roles?${new URLSearchParams({ pageSize: "100", ...(q ? { q } : {}), ...(page === 1 ? {} : { page: String(page) }) })}`,
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
  spec: { sorts: PERMISSION_SORTS, defaultSort: "module", search: ["q"], filters: { q: text(200), module: multiChoice() } },
};

export const PROJECTS_KEY = ["projects"] as const;
export const PROJECT_STATUSES = ["", "active", "archived"] as const;
export type ProjectFilters = { q: string; status: string };
export const PROJECTS: TableDef<ProjectFilters> = {
  key: PROJECTS_KEY[0], path: "/api/projects",
  spec: { sorts: PROJECT_SORTS, defaultSort: "name", search: ["q"], filters: { q: text(200), status: multiChoice() } },
};
export const projectDetail = (id: string) => ({ key: [...PROJECTS_KEY, "detail", id] as const, url: `/api/projects/${encodeURIComponent(id)}` });

export const AUDIT_KEY = ["audit"] as const;
/** Entry identity is independent of list state; only validated, normalized UUIDs become BFF paths. */
export const activityEntry = (id: string) => ({
  key: [...AUDIT_KEY, "entry", id.toLowerCase()] as const,
  url: ACTIVITY_ID_PATTERN.test(id) ? `/api/audit/activity/${id.toLowerCase()}` as const : null,
});


/** Filters both audit logs share: who (free text, debounced) and the range: a preset, or a custom from–to pair that wins when valid. */
export type AuditFilters = { user: string; range: (typeof AUDIT_RANGES)[number]; from: string; to: string; start: string; end: string };
const timeExpression: FilterParser<string> = raw => raw && isTimeExpression(raw) ? raw : "";
const AUDIT_FILTERS = { start: timeExpression, end: timeExpression, user: text(64), range: oneOf(AUDIT_RANGES, "7d"), from: isoDate, to: isoDate } satisfies { [K in keyof AuditFilters]: FilterParser<AuditFilters[K]> };
export const customRange = (f: { from: string; to: string }) => (f.from && f.to && rangeProblem(f.from, f.to) === null ? { from: f.from, to: f.to } : null);
/** API parameters: a valid custom from–to, else the preset as from/to calendar dates (app time zone, today included). */
const auditParams = ({ range, from, to, start, end, ...rest }: AuditFilters & Record<string, string>) =>
  ({ ...rest, ...(resolveTimeRange({ start, end }, Date.now()) ? { start, end } : customRange({ from, to }) ?? presetRange(range, Date.now())) });

export type ActivityFilters = AuditFilters & { action: string; actorId: string; targetType: string; targetId: string };
const exact: FilterParser<string> = raw => raw ?? "";
export const ACTIONS = [{ value: "", label: "Any" }, ...ACTION_OPTIONS];
export const ACTIVITY: TableDef<ActivityFilters> = {
  key: AUDIT_KEY[0], path: "/api/audit/activity", params: auditParams, transient: ["entry"], rawFilters: ["actorId", "targetType", "targetId"],
  spec: { sorts: ACTIVITY_SORTS, defaultSort: "-at", search: ["user"], filters: { ...AUDIT_FILTERS, action: multiChoice(), actorId: exact, targetType: exact, targetId: exact } },
};
export type AuthLogFilters = AuditFilters & { event: string; method: string };
export const AUTH_LOG: TableDef<AuthLogFilters> = {
  key: AUDIT_KEY[0], path: "/api/audit/auth", params: auditParams,
  spec: {
    sorts: AUTH_LOG_SORTS, defaultSort: "-at", search: ["user"],
    filters: { ...AUDIT_FILTERS, event: multiChoice(), method: multiChoice() },
  },
};
