import { hashKey, type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/client/api";
import type { RoleDto } from "@/lib/shared/contracts/rbac";
import { RBAC_KEY, roleKey, roleUrl } from "@/lib/shared/queries";

/** One place that encodes a role id: its API URL and query key (lib/shared/queries), and its page. */
export { RBAC_KEY, roleKey, roleUrl };
export const rolePage = (id: string) => `/roles/${encodeURIComponent(id)}`;

export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** A 404 is final (no retry); `enabled: false` once the role is deleted from its own page. */
export const useRole = (id: string, enabled = true) => useQuery({
  queryKey: roleKey(id), queryFn: () => api<RoleDto>(roleUrl(id)), enabled,
  retry: (n, e) => !isNotFound(e) && n < 1,
});

/**
 * After a role or catalog change: refetch every query (but `except`, e.g. a role just deleted), since role names and
 * user permissions show up across features, and refresh the server layout, which holds the viewer's own permission
 * set (sidebar, `useAuth().can`): editing a role you hold changes what you may do.
 */
export function useAfterRbacChange(): (except?: QueryKey) => Promise<void> {
  const qc = useQueryClient();
  const router = useRouter();
  return async (except) => {
    const skip = except && hashKey(except);
    await qc.invalidateQueries({ predicate: (q) => q.queryHash !== skip });
    router.refresh();
  };
}
