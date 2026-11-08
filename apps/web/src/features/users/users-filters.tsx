"use client";

import { useState } from "react";
import { FilterChecks, FilterSearch } from "@starterkit/ui/ds";
import { USER_STATUSES, type UserFilters } from "@/lib/shared/queries";
import { useDebounced } from "@/lib/client/use-debounced";
import { useRoleNames } from "./use-users";

const STATUS_LABEL = { "": "Any", active: "Active", inactive: "Inactive" } as const;
const STATUSES = USER_STATUSES.filter(value => value !== "").map(value => ({ value, label: STATUS_LABEL[value] }));

/** Server-paged option lookup is independent of the users search; selected roles survive missing/failed option pages. */
export function UsersFilters({ draft, patch }: { draft: UserFilters; patch: (values: Partial<UserFilters>) => void }) {
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim());
  const [page, setPage] = useState(1);
  const roles = useRoleNames(term, page);
  const [cache, setCache] = useState<{ term: string; pages: Record<number, string[]> }>({ term: "", pages: {} });
  const [seen, setSeen] = useState("");
  const version = `${term}|${page}|${roles.query.dataUpdatedAt}`;
  if (roles.query.data && !roles.query.isPlaceholderData && seen !== version) {
    setSeen(version);
    setCache(previous => ({ term, pages: { ...(previous.term === term ? previous.pages : {}), [page]: roles.names } }));
  }
  const names = cache.term === term ? [...new Set(Object.values(cache.pages).flat())] : [];
  const lookup = names.length > 6 || roles.more || query !== "" || page > 1 || roles.query.isError || roles.query.isPending;
  return <>
    <FilterSearch label="Search users" value={draft.q} onChange={q => patch({ q })} placeholder="Name, username or email" />
    <FilterChecks label="Role" value={draft.role} options={names.map(value => ({ value, label: value }))} onChange={role => patch({ role })}
      search={lookup ? {
        value: query, onChange: value => { setQuery(value); setPage(1); }, loading: roles.query.isFetching,
        error: roles.query.isError, more: roles.more, onMore: () => setPage(current => current + 1), onRetry: () => { void roles.query.refetch(); },
      } : undefined} />
    <FilterChecks label="Status" value={draft.status} options={STATUSES} onChange={status => patch({ status })} />
  </>;
}
