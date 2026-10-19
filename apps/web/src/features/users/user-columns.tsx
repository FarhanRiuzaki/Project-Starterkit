import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, type Column, RelativeTime, StatusChip, Truncate } from "@starterkit/ui/ds";
import { UsersIcon } from "@starterkit/ui/ui/icons";
import { RoleChips } from "@/components/role-chips";
import type { UserDto, UserRowDto } from "@/lib/shared/contracts/users";
import { userStatus } from "@/lib/shared/user-status";

export function UserStatusChip({ user }: { user: UserDto }) {
  const s = userStatus(user);
  return <StatusChip health={s.health} label={s.label} />;
}

/** Table columns for the user list; keys of sortable columns are the server's sort keys. `select` (when the viewer can act on rows) is the leading checkbox column. */
export function userColumns(select?: { has: (id: string) => boolean; toggle: (id: string) => void }): Column<UserRowDto>[] {
  const cols: Column<UserRowDto>[] = [
    { key: "name", header: "User", icon: UsersIcon, sortable: true, cell: (u) => (
      <span className="flex min-w-0 max-w-72 items-center gap-2.5">
        <Avatar name={u.name} />
        <span className="grid min-w-0">
          <Truncate title={u.name}><Link href={`/users/${u.id}`} className="font-medium text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{u.name}</Link></Truncate>
          <span className="truncate font-mono text-caption text-fg-3">{u.email}</span>
        </span>
      </span>
    ) },
    { key: "roles", header: "Roles", cell: (u) => <RoleChips roles={u.roles} /> },
    { key: "status", header: "Status", cell: (u) => <UserStatusChip user={u} /> },
    { key: "type", header: "Sign-in", cell: (u): ReactNode => (u.isLdap ? "Directory" : "Password") },
    { key: "lastLoginAt", header: "Last sign-in", sortable: true, cell: (u) => <RelativeTime at={u.lastLoginAt ? Date.parse(u.lastLoginAt) : null} /> },
    { key: "createdAt", header: "Created", sortable: true, cell: (u) => <RelativeTime at={Date.parse(u.createdAt)} /> },
  ];
  if (!select) return cols;
  return [{ key: "select", header: "Select", className: "w-8", cell: (u) => (
    <input type="checkbox" aria-label={`Select ${u.name}`} checked={select.has(u.id)} onChange={() => select.toggle(u.id)} className="size-4 cursor-pointer accent-primary" />
  ) }, ...cols];
}
