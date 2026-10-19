import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Page } from "@/lib/shared/contracts/common";
import type { RoleOption } from "@/lib/shared/contracts/rbac";
import type { UserDetailDto, UserDto } from "@/lib/shared/contracts/users";

export const USERS_KEY = ["users"] as const;
const qs = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)])).toString();

export const useUserDetail = (id: string) => useQuery({ queryKey: [...USERS_KEY, "detail", id], queryFn: () => api<UserDetailDto>(`/api/users/${encodeURIComponent(id)}`) });

/** Role pickers ask for one page of 100; beyond that they search on the server. */
const ROLE_PAGE = 100;

/**
 * Role names for pickers (filter, bulk assign, user form): the first 100 by name, or those matching `q`.
 * `more` = roles exist beyond this page, so the picker offers type-to-search instead of a fixed list.
 */
export function useRoleNames(q = "") {
  const query = useQuery({
    queryKey: [...USERS_KEY, "roles", q], staleTime: 60_000, placeholderData: keepPreviousData,
    queryFn: () => api<Page<RoleOption>>(`/api/users/roles?${qs({ pageSize: ROLE_PAGE, q })}`),
  });
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
  const q = useQuery({
    queryKey: [...USERS_KEY, "superadmins"],
    queryFn: () => api<Page<UserDto>>(`/api/users?${qs({ role: "Superadmin", status: "active" })}`),
  });
  return q.data && q.data.total === 1 ? q.data.items[0]!.id : null;
}

export const SKIP_REASON: Record<string, string> = {
  self_action: "your own account",
  last_superadmin: "the last active Superadmin",
  not_found: "no longer exists",
  ldap_password: "directory user",
};

/** Reason a user can't be deactivated or deleted, or null. `lastSuperId` from useLastSuperadminId. */
export function protection(u: UserDto, meId: string, lastSuperId: string | null): string | null {
  if (u.id === meId) return "You can't do this to your own account. Ask another administrator.";
  if (u.id === lastSuperId) return "This is the last active Superadmin. Make another user Superadmin first.";
  return null;
}
