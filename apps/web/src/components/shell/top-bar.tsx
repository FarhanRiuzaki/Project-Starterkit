"use client";

import { TimeControls } from "./time-controls";
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
import { refreshScope } from "@/lib/shared/time-controls";
import { openPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { NavGlyph } from "./nav-icon";

const SEARCH = "Search pages";

/** Shared navbar: breadcrumb, scoped calendar range, refresh and search.
 * Phone controls occupy a second row; CSS owns the layout at every width. */
export function TopBar({ mark, wordmark }: { mark: ReactNode; wordmark: ReactNode }) {
  const path = usePathname();
  const { perms } = useAuth();
  const { prefs } = usePrefs();
  const list = crumbs(path, perms);
  const sub = isSubPage(path);
  const trail = useTrail(path);
  return (
    <div data-shell-header data-time-controls={refreshScope(path) ? "visible" : undefined} data-print="hide" className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-line px-6 max-md:sticky max-md:top-0 max-md:z-30 max-md:gap-x-2 max-md:gap-y-0 max-md:min-h-(--topbar-h) max-md:bg-sheet max-md:px-3 max-md:pt-safe">
      <MobileNav wordmark={wordmark} />
      <span className="contents md:hidden">{mark}</span>
      {/* A route without crumbs keeps the spacer but no empty landmark. */}
      {list.length === 0 ? <div className="flex-1" /> : <nav aria-label="Breadcrumb" className="min-w-0 flex-1 max-md:min-h-14 max-md:content-center">
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
      <div className={cn("md:flex md:h-10 md:w-100 xl:w-128 md:shrink-0 md:items-center md:justify-end", refreshScope(path) ? "max-md:order-last max-md:w-full max-md:pb-2" : "max-md:hidden")}><TimeControls /></div>
      <button type="button" onClick={openPalette} aria-label={SEARCH}
        className="inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-line-strong bg-card text-fg-2 transition-colors duration-(--dur-fast) hover:border-fg-4 xl:flex xl:w-44 xl:justify-start xl:gap-2 xl:px-2.5">
        <Icon icon={SearchIcon} className="size-4 shrink-0" /><span className="hidden text-body-sm xl:inline">Search pages…</span>
      </button>
    </div>
  );
}
