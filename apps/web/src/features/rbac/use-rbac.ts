import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { PermissionDto, RoleDto } from "@/lib/shared/contracts/rbac";

export const RBAC_KEY = ["rbac"] as const;

export const useRoles = () => useQuery({ queryKey: [...RBAC_KEY, "roles"], queryFn: () => api<RoleDto[]>("/api/roles") });
export const useRole = (id: string) => useQuery({ queryKey: [...RBAC_KEY, "role", id], queryFn: () => api<RoleDto>(`/api/roles/${encodeURIComponent(id)}`) });
export const usePermissions = () => useQuery({ queryKey: [...RBAC_KEY, "permissions"], queryFn: () => api<PermissionDto[]>("/api/permissions") });

/**
 * After a role or catalog change: refetch every query, since role names and user permissions show up across features.
 * The sidebar comes from the layout and follows on the next page load; the API enforces the new permissions at once.
 */
// ponytail: no router.refresh() here, it currently drops the toast that reports the change (Toaster in components/providers.tsx); revisit with that fix.
export function useAfterRbacChange(): () => Promise<void> {
  const qc = useQueryClient();
  return async () => { await qc.invalidateQueries(); };
}
