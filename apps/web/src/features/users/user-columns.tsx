import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, type Column, RelativeTime, StatusChip, Truncate } from "@starterkit/ui/ds";
import { UsersIcon } from "@starterkit/ui/ui/icons";
import { RoleChips } from "@/components/role-chips";
import type { UserDto, UserRowDto } from "@starterkit/shared/contracts/users";
import { userStatus } from "@/lib/shared/user-status";

export function UserStatusChip({ user }: { user: UserDto }) {
  const s = userStatus(user);
  return <StatusChip health={s.health} label={s.label} />;
}

/**
 * Table columns for the user list; keys of sortable columns are the server's sort keys. `select` (when the viewer can
 * act on rows) is the leading checkbox column. On a phone card: the user is the title, roles, status and last sign-in
 * are lines under it; sign-in type and created stay on the detail page. On a tablet (below 1280) those two columns
 * hide too (and the row's Deactivate / Activate button moves into its menu, users-page.tsx), so the name keeps its
 * 192 px (`min-w-48`) without the table scrolling sideways.
 */
export function userColumns(select?: { has: (id: string) => boolean; toggle: (id: string) => void; all: { checked: boolean; count: number; toggle: () => void } }): Column<UserRowDto>[] {
  const cols: Column<UserRowDto>[] = [
    { key: "name", header: "User", icon: UsersIcon, sortable: true, mobile: "title", className: "min-w-48", cell: (u) => (
      <span className="flex min-w-0 max-w-72 items-center gap-2.5">
        <Avatar name={u.name} />
        <span className="grid min-w-0">
          <Truncate title={u.name}><Link href={`/users/${u.id}`} className="font-medium text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{u.name}</Link></Truncate>
          <span className="truncate text-caption text-fg-3">{u.email}</span>
        </span>
      </span>
    ) },
    { key: "roles", header: "Roles", cell: (u) => <RoleChips roles={u.roles} /> },
    { key: "status", header: "Status", cell: (u) => <UserStatusChip user={u} /> },
    { key: "type", header: "Sign-in", mobile: "hidden", className: "max-xl:hidden", cell: (u): ReactNode => (u.isLdap ? "Directory" : "Password") },
    { key: "lastLoginAt", header: "Last sign-in", sortable: true, cell: (u) => <RelativeTime at={u.lastLoginAt ? Date.parse(u.lastLoginAt) : null} /> },
    { key: "createdAt", header: "Created", sortable: true, mobile: "hidden", className: "max-xl:hidden", cell: (u) => <RelativeTime at={Date.parse(u.createdAt)} /> },
  ];
  if (!select) return cols;
  // The header's checkbox selects the page (tablet and desktop); on a phone the bulk bar holds it (the header is hidden).
  const all = (
    <label className="inline-grid size-7 cursor-pointer place-items-center">
      <input type="checkbox" aria-label={`Select all ${select.all.count} on this page`} checked={select.all.checked} onChange={select.all.toggle} className="size-4 cursor-pointer accent-primary" />
    </label>
  );
  return [{ key: "select", header: "Select", headerCell: all, className: "w-8", mobile: "lead", cell: (u) => (
    // The label is the touch hit area (base.css): a native checkbox can't carry one.
    <label className="inline-grid size-7 cursor-pointer place-items-center"><input type="checkbox" aria-label={`Select ${u.name}`} checked={select.has(u.id)} onChange={() => select.toggle(u.id)} className="size-4 cursor-pointer accent-primary" /></label>
  ) }, ...cols];
}
