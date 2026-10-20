"use client";

import { Kbd } from "@starterkit/ui/ds";
import { Icon } from "@starterkit/ui/ui/icon";
import { SearchIcon, ThemeDarkIcon, ThemeLightIcon } from "@starterkit/ui/ui/icons";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { crumbs } from "@/lib/shared/nav";
import { AccountMenu } from "./account-menu";
import { OPEN_PALETTE } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { NavGlyph } from "./nav-icon";

const SEARCH = "Search pages";
const openPalette = () => window.dispatchEvent(new CustomEvent(OPEN_PALETTE));

/**
 * Top bar: 56 px, 1 px bottom line. Breadcrumb from the route (16 px icon + body per crumb, current in fg), the ⌘K
 * search field (32 × 280, opens the command palette) and a 32 px theme toggle. The shell never animates on navigation.
 * Below 768 px (no sidebar) it is the phone bar, sticky, under the safe-area inset: menu button (drawer), logo mark,
 * the breadcrumb as the page title, search as a 32 px icon button, and the account menu (the theme is in it). All of it
 * is in the server HTML and switched by CSS, so the bar never shifts on first paint.
 */
export function TopBar({ mark, wordmark }: { mark: ReactNode; wordmark: ReactNode }) {
  const path = usePathname();
  const { perms } = useAuth();
  const list = crumbs(path, perms);
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div data-print="hide" className="flex min-h-14 shrink-0 items-center gap-3 border-b border-line px-6 max-md:sticky max-md:top-0 max-md:z-30 max-md:gap-2 max-md:bg-sheet max-md:px-3 max-md:pt-safe">
      <MobileNav wordmark={wordmark} />
      <span className="contents md:hidden">{mark}</span>
      {/* A route without crumbs keeps the spacer but no empty landmark. */}
      {list.length === 0 ? <div className="flex-1" /> : <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-2 text-body text-fg-2">
          {list.map((c, i) => {
            const last = i === list.length - 1;
            return (
              <li key={`${c.label}-${i}`} className="inline-flex min-w-0 items-center gap-2">
                {i > 0 && <span aria-hidden="true" className="text-fg-4">/</span>}
                {c.icon && <NavGlyph icon={c.icon} className="size-4 shrink-0 text-fg-3" />}
                {last
                  ? <span aria-current="page" className="truncate font-medium text-fg">{c.label}</span>
                  : c.href ? <Link href={c.href} className="truncate rounded-xs hover:text-fg">{c.label}</Link> : <span className="truncate">{c.label}</span>}
              </li>
            );
          })}
        </ol>
      </nav>}
      <button type="button" onClick={openPalette} aria-label={SEARCH}
        className="flex h-8 w-70 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-card pr-1.5 pl-2.5 text-body-sm text-fg-3 transition-colors duration-(--dur-fast) hover:border-fg-4 hover:text-fg-2 max-lg:w-48 max-md:w-8 max-md:justify-center max-md:px-0 max-md:text-fg-2">
        <Icon icon={SearchIcon} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left max-md:hidden">{SEARCH}…</span>
        <span className="contents max-md:hidden"><Kbd keys={["⌘K"]} /></span>
      </button>
      {/* Stable name: the theme is unknown on the server, so a theme-dependent label would not hydrate. */}
      <button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Switch between light and dark theme"
        className="inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-line-strong bg-card text-fg-2 shadow-xs transition-colors duration-(--dur-fast) hover:bg-tray hover:text-fg max-md:hidden">
        {/* Both icons render; CSS picks one, so the server HTML matches before the theme is known. */}
        <Icon icon={ThemeDarkIcon} className="size-4 dark:hidden" />
        <Icon icon={ThemeLightIcon} className="hidden size-4 dark:block" />
      </button>
      <div className="w-11 shrink-0 md:hidden"><AccountMenu compact bar /></div>
    </div>
  );
}
