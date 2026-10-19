import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Page } from "@/lib/shared/contracts/common";
import type { RoleOption } from "@/lib/shared/contracts/rbac";
import type { UserDetailDto, UserDto, UserRowDto } from "@/lib/shared/contracts/users";
import type { PermissionName } from "@/lib/shared/permissions";
import { roleOptions, SUPERADMINS, userDetail, USERS_KEY } from "@/lib/shared/queries";

export { USERS_KEY };

export function useUserDetail(id: string) {
  const { key, url } = userDetail(id);
  return useQuery({ queryKey: key, queryFn: () => api<UserDetailDto>(url) });
}

/**
 * Role names for pickers (filter, bulk assign, user form): the first 100 by name, or those matching `q`.
 * `more` = roles exist beyond this page, so the picker offers type-to-search instead of a fixed list.
 */
export function useRoleNames(q = "") {
  const { key, url } = roleOptions(q);
  const query = useQuery({ queryKey: key, staleTime: 60_000, placeholderData: keepPreviousData, queryFn: () => api<Page<RoleOption>>(url) });
  const data = query.data;
  return { query, names: data?.items.map((r) => r.name) ?? [], more: !!data && data.total > data.items.length };
}

/** `value` after it has stopped changing for `ms` (search-as-you-type). */
export function useDebounced<T>(value: T, ms = 200): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/** Id of the only active Superadmin, or null when there are several (that user can't be deactivated or deleted). */
export function useLastSuperadminId(): string | null {
  const q = useQuery({ queryKey: SUPERADMINS.key, queryFn: () => api<Page<UserDto>>(SUPERADMINS.url) });
  return q.data && q.data.total === 1 ? q.data.items[0]!.id : null;
}

export const SKIP_REASON: Record<string, string> = {
  self_action: "your own account",
  last_superadmin: "the last active Superadmin",
  not_found: "no longer exists",
  ldap_password: "directory user",
  forbidden: "has permissions your role doesn't hold",
};

/**
 * Actor rank, as the server checks it (rules.ts checkTargetRank): the reason the viewer can't act on `u` at all (edit,
 * status, password reset, sessions, delete) because `u` holds a permission the viewer lacks; else null.
 */
export function rankBlock(u: Pick<UserRowDto, "permissions">, perms: ReadonlySet<PermissionName>): string | null {
  return u.permissions.some((p) => !perms.has(p)) ? "This user has permissions your role doesn't hold. Ask an administrator who has all of them." : null;
}

/** Reason a user can't be deactivated or deleted, or null. `lastSuperId` from useLastSuperadminId. */
export function protection(u: UserRowDto, meId: string, perms: ReadonlySet<PermissionName>, lastSuperId: string | null): string | null {
  if (u.id === meId) return "You can't do this to your own account. Ask another administrator.";
  return rankBlock(u, perms) ?? (u.id === lastSuperId ? "This is the last active Superadmin. Make another user Superadmin first." : null);
}
