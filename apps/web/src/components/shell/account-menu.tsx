"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Avatar } from "@starterkit/ui/ds";
import { cn } from "@starterkit/ui/lib/cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@starterkit/ui/ui/dropdown-menu";
import { Icon } from "@starterkit/ui/ui/icon";
import { ChevronsUpDownIcon } from "@starterkit/ui/ui/icons";
import { useAuth } from "@/lib/client/auth-context";

const AccountMenuItems = dynamic(() => import("./account-menu-content").then(m => m.AccountMenuItems, () => AccountMenuFailure), {
  ssr: false,
  loading: () => <DropdownMenuItem disabled>Loading account menu…</DropdownMenuItem>,
});
function AccountMenuFailure() {
  return <DropdownMenuItem onSelect={() => window.location.reload()}>Couldn&apos;t load account menu. Reload page</DropdownMenuItem>;
}

/**
 * Sidebar account menu: profile, security, sessions, theme, density and Sign out.
 * The drawer shows full labels; the tablet/collapsed rail shows the avatar.
 */
export function AccountMenu({ compact, drawer }: { compact?: boolean; drawer?: boolean }) {
  const { user } = useAuth();
  const [used, setUsed] = useState(false);
  const role = user.roles.join(", ") || "No role";
  return (
    <DropdownMenu onOpenChange={open => { if (open) setUsed(true); }}>
      <DropdownMenuTrigger asChild>
        {/* 32 px initials avatar, name + role, chevron; avatar only in the rail. */}
        <button type="button" aria-label={`${user.name}, account menu`}
          className={cn("flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-md px-1.5 text-left outline-none hover:bg-tray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[state=open]:bg-tray", drawer ? "justify-start" : !compact && "xl:justify-start")}>
          <Avatar name={user.name} seed={user.username} size={32} />
          <span className={cn("hidden min-w-0 flex-1 leading-tight", drawer ? "grid" : !compact && "xl:grid")}>
            <span className="truncate text-body-sm font-medium text-fg">{user.name}</span>
            <span className="truncate text-caption text-fg-3">{role}</span>
          </span>
          <Icon icon={ChevronsUpDownIcon} className={cn("hidden size-4 shrink-0 text-fg-3", drawer ? "block" : !compact && "xl:block")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">{used && <AccountMenuItems />}</DropdownMenuContent>

    </DropdownMenu>
  );
}
