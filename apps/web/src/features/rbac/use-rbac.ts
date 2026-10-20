import { hashKey, type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, retryUnlessNotFound } from "@/lib/client/api";
import type { RoleDetailDto } from "@starterkit/shared/contracts/rbac";
import { RBAC_KEY, roleKey, roleUrl } from "@/lib/shared/queries";

/** One place that encodes a role id: its API URL and query key (lib/shared/queries), and its page. */
export { RBAC_KEY, roleKey, roleUrl };
export const rolePage = (id: string) => `/roles/${encodeURIComponent(id)}`;

/** A 404 is final (no retry); `enabled: false` once the role is deleted from its own page. */
export const useRole = (id: string, enabled = true) => useQuery({
  queryKey: roleKey(id), queryFn: () => api<RoleDetailDto>(roleUrl(id)), enabled, retry: retryUnlessNotFound,
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
