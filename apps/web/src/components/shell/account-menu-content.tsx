"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuShortcut,
} from "@starterkit/ui/ui/dropdown-menu";
import { Icon } from "@starterkit/ui/ui/icon";
import { IdentityIcon, KeyIcon, SessionsIcon, ShortcutsIcon, SignOutIcon } from "@starterkit/ui/ui/icons";
import { api } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { PALETTES } from "@/lib/shared/palette";
import { usePalette } from "@/lib/client/palette-context";
import { usePrefs } from "@/lib/client/prefs-context";
import { openShortcuts } from "./command-palette";

/** Account controls load on the first open; the shell keeps its original trigger on first paint. */
export function AccountMenuItems() {
  const { user } = useAuth();
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const menu = first.current?.closest('[role="menu"]');
    // A cold open initially focuses the loading menu, before enabled items exist.
    if (menu && (document.activeElement === menu || menu.contains(document.activeElement))) first.current?.focus();
  }, []);
  const { theme, setTheme } = useTheme();
  const { prefs, update } = usePrefs();
  const { palette, change } = usePalette();
  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    // Full reload drops cached private data.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard navigation clears client caches
    window.location.assign("/login");
  }
  return (
      <>
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="text-body-sm font-medium text-fg">{user.name}</span>
          <span className="truncate text-caption text-fg-3">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link ref={first} href="/me"><Icon icon={IdentityIcon} className="size-4" />Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/me/security"><Icon icon={KeyIcon} className="size-4" />Security</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/me/sessions"><Icon icon={SessionsIcon} className="size-4" />Sessions</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-caption font-normal text-fg-3">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">Match system</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuLabel className="text-caption font-normal text-fg-3">Color palette</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={palette} onValueChange={change}>
          {PALETTES.map((p) => <DropdownMenuRadioItem key={p.value} value={p.value}>{p.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        <DropdownMenuLabel className="text-caption font-normal text-fg-3">Density</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={prefs.density} onValueChange={(v) => update({ density: v === "compact" ? "compact" : "comfortable" })}>
          <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openShortcuts}><Icon icon={ShortcutsIcon} className="size-4" />Keyboard shortcuts<DropdownMenuShortcut>?</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onSelect={logout}><Icon icon={SignOutIcon} className="size-4" />Sign out</DropdownMenuItem>
      </>
  );
}
