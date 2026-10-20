import type { SQL } from "bun";
import type { Page } from "@starterkit/shared/contracts/common";
import { PERMISSION_ROLES_SHOWN, type PermissionDto, type PermissionListQuery, type RoleDto, type RoleListQuery, type RoleOption, type RoleOptionQuery } from "@starterkit/shared/contracts/rbac";
import type { PermissionName } from "@starterkit/shared/permissions";
import { sql } from "../db/client";
import { likeEscape, pageQuery, sortSql } from "../db/page";

type RoleRow = { id: string; name: string; locked: boolean; permissions: PermissionName[]; userCount: number };

// Holder counts and permission lists come from one grouped subquery each, never one query per role.
const ROLE_SELECT = sql`r.id, r.name, r.locked, coalesce(rp.perms, '{}') as permissions, coalesce(uc.n, 0) as "userCount"`;
const ROLE_FROM = sql`from roles r
  left join (select role_id, count(*)::int as n from user_roles group by role_id) uc on uc.role_id = r.id
  left join (select x.role_id, array_agg(x.permission order by p.position) as perms, count(*)::int as n
             from role_permissions x join permissions p on p.name = x.permission group by x.role_id) rp on rp.role_id = r.id`;
const ROLE_SORTS = { name: "lower(r.name)", permissions: "coalesce(rp.n, 0)", users: "coalesce(uc.n, 0)", id: "r.id" };
const toRole = (r: RoleRow): RoleDto => ({ id: r.id, name: r.name, locked: r.locked, permissions: r.permissions, userCount: r.userCount });

/** `q` as a case-insensitive literal substring of `column`; no `q` = no filter. */
const matches = (column: string, q: string | undefined) => (q?.trim() ? sql`${sql.unsafe(column)} ilike ${`%${likeEscape(q.trim())}%`}` : sql`true`);

/** One page of roles (GET /v1/roles), name A–Z unless `sort` says otherwise; `q` matches the name. */
export const rolePage = (q: RoleListQuery): Promise<Page<RoleDto>> =>
  pageQuery<RoleRow, RoleDto>({ select: ROLE_SELECT, from: sql`${ROLE_FROM} where ${matches("r.name", q.q)}`, orderBy: sortSql(q.sort, ROLE_SORTS, "name"), query: q, map: toRole });

/** One page of role options (GET /v1/users/roles), name A–Z; `q` matches the name. */
export const roleOptionPage = (q: RoleOptionQuery): Promise<Page<RoleOption>> =>
  pageQuery<RoleOption, RoleOption>({ select: sql`r.id, r.name`, from: sql`from roles r where ${matches("r.name", q.q)}`, orderBy: sortSql(q.sort, ROLE_SORTS, "name"), query: q, map: (r) => ({ id: r.id, name: r.name }) });

/** One role (a transaction's `db` sees its own changes); null = no such role. */
export async function roleById(db: SQL, id: string): Promise<RoleDto | null> {
  const [r] = await db<RoleRow[]>`select ${ROLE_SELECT} ${ROLE_FROM} where r.id = ${id}`;
  return r ? toRole(r) : null;
}

// The catalog with the roles holding each: one grouped subquery; `names` are the first PERMISSION_ROLES_SHOWN by name.
const PERM_SORTS = { module: "p.position", name: "p.name", action: "split_part(p.name, '.', 2)", id: "p.name" };

/** One page of the catalog (GET /v1/permissions), catalog order unless `sort` says otherwise; `q` matches the name, `module` is exact. */
export const permissionPage = (q: PermissionListQuery): Promise<Page<PermissionDto>> =>
  pageQuery<{ id: string; roles: string[]; roleCount: number }, PermissionDto>({
    select: sql`p.name as id, p.name, coalesce(h.names, '{}') as roles, coalesce(h.n, 0) as "roleCount"`,
    from: sql`from permissions p
      left join (select x.permission, count(*)::int as n, (array_agg(r.name order by lower(r.name), r.name))[1:${PERMISSION_ROLES_SHOWN}] as names
                 from role_permissions x join roles r on r.id = x.role_id group by x.permission) h on h.permission = p.name
      where ${matches("p.name", q.q)} and ${q.module ? sql`p.name like ${`${q.module}.%`}` : sql`true`}`,
    orderBy: sortSql(q.sort, PERM_SORTS, "module"),
    query: q,
    map: (r) => ({ id: r.id, name: r.id, roles: r.roles, roleCount: r.roleCount }),
  });
