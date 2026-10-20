"use client";

import { cn } from "@starterkit/ui/lib/cn";
import { Icon } from "@starterkit/ui/ui/icon";
import { SearchIcon } from "@starterkit/ui/ui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { useTrail } from "@/lib/client/crumb-trail";
import { usePrefs } from "@/lib/client/prefs-context";
import { type Crumb, crumbs, isSubPage } from "@/lib/shared/nav";
import { viewHref } from "@/lib/shared/prefs";
import { AccountMenu } from "./account-menu";
import { openPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { NavGlyph } from "./nav-icon";

const SEARCH = "Search pages";

/**
 * Top bar: 56 px, 1 px bottom line, the breadcrumb (16 px icon + body per crumb, current in fg): the nav page, then on
 * a sub-page the parents and the page itself that its PageHeader publishes ("Users / Rina Wulandari"). The search is in
 * the sidebar and the theme in the account menu. The shell never animates on navigation.
 * Below 768 px (no sidebar) it is the phone bar, sticky, under the safe-area inset (the 56 px row stays below it): menu
 * button (navigation drawer), logo mark, the nav page as the page title, search as a 32 px icon button and the account
 * menu (the theme is in it). All of it is in the server HTML and switched by CSS, so the bar never shifts on first paint.
 */
export function TopBar({ mark, wordmark }: { mark: ReactNode; wordmark: ReactNode }) {
  const path = usePathname();
  const { perms } = useAuth();
  const { prefs } = usePrefs();
  const list = crumbs(path, perms);
  const sub = isSubPage(path);
  const trail = useTrail(path);
  return (
    <div data-print="hide" className="flex min-h-14 shrink-0 items-center gap-3 border-b border-line px-6 max-md:sticky max-md:top-0 max-md:z-30 max-md:gap-2 max-md:min-h-(--topbar-h) max-md:bg-sheet max-md:px-3 max-md:pt-safe">
      <MobileNav wordmark={wordmark} />
      <span className="contents md:hidden">{mark}</span>
      {/* A route without crumbs keeps the spacer but no empty landmark. */}
      {list.length === 0 ? <div className="flex-1" /> : <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-2 text-body text-fg-2">
          {[...list, ...(sub ? trail : [])].map((c: Crumb, i, all) => {
            // The open page is plain text: the nav page itself, or the trail's last crumb on a sub-page (/users/<id>),
            // where the nav page and any parents link back. Phone: the nav page only (the bar's title, in the server
            // HTML); the trail arrives after hydration and would swap the title.
            const last = i === all.length - 1 && !(sub && i === 0);
            return (
              <li key={`${c.label}-${i}`} className={cn("inline-flex min-w-0 items-center gap-2", i > 0 && "max-md:hidden")}>
                {i > 0 && <span aria-hidden="true" className="text-fg-4">/</span>}
                {c.icon && <NavGlyph icon={c.icon} className="size-4 shrink-0 text-fg-3" />}
                {last
                  ? <span aria-current="page" className="truncate font-medium text-fg">{c.label}</span>
                  : c.href ? <Link href={i === 0 ? viewHref(c.href, prefs) : c.href} className="truncate rounded-xs hover:text-fg">{c.label}</Link> : <span className="truncate">{c.label}</span>}
              </li>
            );
          })}
        </ol>
      </nav>}
      <button type="button" onClick={openPalette} aria-label={SEARCH}
        className="inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-line-strong bg-card text-fg-2 transition-colors duration-(--dur-fast) hover:border-fg-4 md:hidden">
        <Icon icon={SearchIcon} className="size-4 shrink-0" />
      </button>
      <div className="w-11 shrink-0 md:hidden"><AccountMenu compact bar /></div>
    </div>
  );
}
