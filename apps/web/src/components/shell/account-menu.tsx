"use client";

import { Avatar } from "@starterkit/ui/ds";
import { cn } from "@starterkit/ui/lib/cn";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@starterkit/ui/ui/dropdown-menu";
import { Icon } from "@starterkit/ui/ui/icon";
import { ChevronsUpDownIcon, IdentityIcon, KeyIcon, SessionsIcon, SignOutIcon } from "@starterkit/ui/ui/icons";
import { useTheme } from "next-themes";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { usePrefs } from "@/lib/client/prefs-context";

/**
 * Account row at the bottom of the sidebar: profile, security, sessions, theme, density, Sign out. `bar`: the phone top
 * bar's copy (avatar only, opens downwards, aligned to the right edge).
 */
export function AccountMenu({ compact, bar }: { compact?: boolean; bar?: boolean }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { prefs, update } = usePrefs();
  const role = user.roles.join(", ") || "No role";
  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    // Full reload on purpose: drops every cached query and client state of the signed-out user.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard navigation clears client caches
    window.location.assign("/login");
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* 32 px initials avatar, name + role, chevron; avatar only in the rail. */}
        <button type="button" aria-label={`${user.name}, account menu`}
          className={cn("flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-md px-1.5 text-left outline-none hover:bg-tray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[state=open]:bg-tray", !compact && "xl:justify-start")}>
          <Avatar name={user.name} seed={user.username} size={32} />
          <span className={cn("hidden min-w-0 flex-1 leading-tight", !compact && "xl:grid")}>
            <span className="truncate text-body-sm font-medium text-fg">{user.name}</span>
            <span className="truncate text-caption text-fg-3">{role}</span>
          </span>
          <Icon icon={ChevronsUpDownIcon} className={cn("hidden size-4 shrink-0 text-fg-3", !compact && "xl:block")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={bar ? "end" : "start"} side={bar ? "bottom" : "top"} className="w-64">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="text-body-sm font-medium text-fg">{user.name}</span>
          <span className="truncate font-mono text-caption text-fg-3">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/me"><Icon icon={IdentityIcon} className="size-4" />Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/me/security"><Icon icon={KeyIcon} className="size-4" />Security</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/me/sessions"><Icon icon={SessionsIcon} className="size-4" />Sessions</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-caption font-normal text-fg-3">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">Match system</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuLabel className="text-caption font-normal text-fg-3">Density</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={prefs.density} onValueChange={(v) => update({ density: v === "compact" ? "compact" : "comfortable" })}>
          <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}><Icon icon={SignOutIcon} className="size-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
