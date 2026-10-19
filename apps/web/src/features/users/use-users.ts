import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { Page } from "@/lib/shared/contracts/common";
import type { UserDetailDto, UserDto } from "@/lib/shared/contracts/users";

export const USERS_KEY = ["users"] as const;
const qs = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)])).toString();

export const useUserDetail = (id: string) => useQuery({ queryKey: [...USERS_KEY, "detail", id], queryFn: () => api<UserDetailDto>(`/api/users/${encodeURIComponent(id)}`) });

export const useRoleNames = () => useQuery({ queryKey: [...USERS_KEY, "roles"], queryFn: () => api<string[]>("/api/users/roles"), staleTime: 60_000 });

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
