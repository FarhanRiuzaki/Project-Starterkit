"use client";

import { FilterMenu, FilterSearch } from "@starterkit/ui/ds";
import { RadioGroup } from "@starterkit/ui/ds/form-options";
import { USER_STATUSES, type UserFilters } from "@/lib/shared/queries";
import { RoleSearch } from "./role-search";
import { useRoleNames } from "./use-users";

const STATUS_LABEL = { "": "Any", active: "Active", inactive: "Inactive" } as const;
const STATUSES = USER_STATUSES.map(value => ({ value, label: STATUS_LABEL[value] }));

/** Loaded when the filter card opens; draft changes remain owned by FilterLayout. */
export function UsersFilters({ draft, patch }: { draft: UserFilters; patch: (values: Partial<UserFilters>) => void }) {
  const roles = useRoleNames();
  return <>
    <FilterSearch label="Search users" value={draft.q} onChange={q => patch({ q })} placeholder="Name, username or email" />
    {roles.more
      ? <RoleSearch className="w-full" label="Role" value={draft.role} onChange={role => patch({ role })} />
      : <FilterMenu label="Role" value={draft.role} options={[{ value: "", label: "Any" }, ...roles.names.map(r => ({ value: r, label: r }))]} onChange={role => patch({ role })} />}
    <RadioGroup legend="Status" value={draft.status} options={STATUSES} onValueChange={value => { const status = STATUSES.find(s => s.value === value); if (status) patch({ status: status.value }); }} />
  </>;
}
