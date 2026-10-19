import { hashKey, type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/client/api";
import type { RoleDto } from "@/lib/shared/contracts/rbac";

export const RBAC_KEY = ["rbac"] as const;

/** One place that encodes a role id: its API URL, its page and its query key. */
export const roleUrl = (id: string) => `/api/roles/${encodeURIComponent(id)}`;
export const rolePage = (id: string) => `/roles/${encodeURIComponent(id)}`;
export const roleKey = (id: string) => [...RBAC_KEY, "role", id] as const;

export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** A 404 is final (no retry); `enabled: false` once the role is deleted from its own page. */
export const useRole = (id: string, enabled = true) => useQuery({
  queryKey: roleKey(id), queryFn: () => api<RoleDto>(roleUrl(id)), enabled,
  retry: (n, e) => !isNotFound(e) && n < 1,
});

/**
 * After a role or catalog change: refetch every query (but `except`, e.g. a role just deleted), since role names and
 * user permissions show up across features.
 * The sidebar comes from the layout and follows on the next page load; the API enforces the new permissions at once.
 */
// ponytail: no router.refresh() here, it currently drops the toast that reports the change (Toaster in components/providers.tsx); revisit with that fix.
export function useAfterRbacChange(): (except?: QueryKey) => Promise<void> {
  const qc = useQueryClient();
  return async (except) => {
    const skip = except && hashKey(except);
    await qc.invalidateQueries({ predicate: (q) => q.queryHash !== skip });
  };
}
