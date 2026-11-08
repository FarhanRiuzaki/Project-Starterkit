"use client";

import { Brand } from "@starterkit/ui/ds";
import { cn } from "@starterkit/ui/lib/cn";
import { Icon } from "@starterkit/ui/ui/icon";
import { SidebarCollapseIcon, SidebarExpandIcon } from "@starterkit/ui/ui/icons";
import { ScrollArea } from "@starterkit/ui/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starterkit/ui/ui/tooltip";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { usePrefs } from "@/lib/client/prefs-context";
import { activeChild, isActive, navFor } from "@/lib/shared/nav";
import { viewHref } from "@/lib/shared/prefs";
import { NavGlyph } from "./nav-icon";
import { AccountMenu } from "./account-menu";
import { SidebarRailMenu } from "./sidebar-rail-menu";

/**
 * Sidebar. 248 px from 1280 px (`xl`), collapsible to the 64 px icon rail (preference per viewer, kept in a cookie);
 * 768–1279 px it is always the rail, so the page never scrolls sideways; below 768 px it is not shown and the same
 * sections open from the top bar's menu button (MobileNav, a drawer). Sections come from
 * `navFor(perms)`: a link the viewer cannot open is not shown. An item's `children` (views of its page) open under it,
 * on a guide line, while its page is open in the expanded sidebar (≥ 1280 px). Account controls live in the sidebar footer. The logo nodes come
 * from the server (AppShell), so the wordmark's path data stays out of the client bundle.
 */
export function Sidebar({ mark, wordmark }: { mark: ReactNode; wordmark: ReactNode }) {
  const path = usePathname();
  const sp = useSearchParams();
  const { perms } = useAuth();
  const { prefs, update } = usePrefs();
  const collapsed = prefs.sidebar === "collapsed";
  // The toggle swaps between two buttons, so the pressed one unmounts; hand keyboard focus to its counterpart.
  const toggleRef = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    toggleRef.current?.focus();
  }, [collapsed]);
  const toggle = (sidebar: "collapsed" | "expanded") => { toggled.current = true; update({ sidebar }); };
  // Labels keep `hidden` in the rail (never animated out); on expand they fade in as the width opens.
  const label = (cls: string) => (collapsed ? "hidden" : cn(cls, "animate-reveal-in"));
  // The rail (below 1280 px, or collapsed): every control is a centred 36 px square; expanded, a full-width row.
  const square = collapsed ? "mx-auto size-9" : "max-xl:mx-auto max-xl:size-9";
  return (
    <aside data-print="hide" aria-label="Main navigation" className={cn("animate-shell-side motion-safe:transition-sidebar sticky top-0 flex h-svh w-16 shrink-0 flex-col px-3 py-4 max-md:hidden", !collapsed && "xl:w-62")}>
      <div className={cn("flex h-9 items-center justify-center px-1.5", !collapsed && "xl:justify-start")}>
        {/* Below 1280 px the sidebar is always the rail, so the expanded slot keeps the mark until xl. */}
        <Brand collapsed={collapsed} mark={mark}
          wordmark={<><span className="contents xl:hidden">{mark}</span><span className="hidden xl:contents">{wordmark}</span></>} />
        {!collapsed && (
          <button ref={toggleRef} type="button" onClick={() => toggle("collapsed")} aria-label="Collapse sidebar" aria-expanded="true"
            className="ml-auto hidden size-8 shrink-0 cursor-pointer place-items-center rounded-md text-fg-3 hover:bg-tray hover:text-fg xl:inline-grid">
            <Icon icon={SidebarCollapseIcon} className="size-4" />
          </button>
        )}
      </div>
      <div aria-hidden="true" className="mx-1.5 mt-3 border-t border-line" />
      <nav data-slot="sidebar-nav" aria-label="Menu" className="mt-1 flex min-h-0 flex-1 flex-col">
        <ScrollArea className="-mx-1 px-1" thumbClassName="-right-2">
        {navFor(perms).map((s, si) => (
          <div key={s.id} role="group" aria-labelledby={`nav-section-${s.id}`} className={cn("grid gap-0.5", si > 0 && "mt-3")}>
            {/* The rail has no group labels: a hairline separates the groups instead. */}
            {si > 0 && <div aria-hidden="true" className={cn("mx-2 mb-2 border-t border-line", !collapsed && "xl:hidden")} />}
            {/* Hidden in the rail, still names the group (aria-labelledby reads hidden text). */}
            <span key={`${s.id}-${collapsed}`} id={`nav-section-${s.id}`} className={cn("eyebrow hidden px-2.5 pt-2 pb-2 text-fg-3", label("xl:block"))}>{s.label}</span>
            {s.items.map((n) => {
              const active = isActive(path, n.href);
              const child = active ? activeChild(n, path, sp) : null;
              return (
                <div key={n.href} className="grid gap-0.5">
                {n.children?.length ? <SidebarRailMenu item={n} active={active} child={child} collapsed={collapsed} /> : null}
                {(!n.children?.length || !collapsed) && <Tooltip>
                  <TooltipTrigger asChild>
                    {/* aria-label: the text label is hidden in the rail; the link keeps its name. */}
                    {/* With a child view open (expanded sidebar), the child carries the highlight and the item just reads fg. */}
                    <Link href={viewHref(n.href, prefs)} aria-label={n.label} aria-current={active && !(child && !collapsed) ? "page" : undefined}
                      className={cn("relative flex h-9 items-center justify-center gap-2.5 rounded-md border px-2.5 text-body text-fg-2 transition-colors duration-(--dur-fast)",
                        square, !collapsed && "xl:h-8 xl:justify-start xl:text-body-sm",
                        !!n.children?.length && "hidden xl:flex",
                        active ? "border-line bg-raised text-fg" : "border-transparent hover:bg-tray hover:text-fg",
                        active && child && !collapsed && "xl:border-transparent xl:bg-transparent xl:shadow-none")}>
                      <NavGlyph icon={n.icon} className="size-4 shrink-0" />
                      <span key={`label-${collapsed}`} className={cn("hidden min-w-0 flex-1 truncate", label("xl:inline"))}>{n.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className={cn(!collapsed && "xl:hidden")}>{n.label}</TooltipContent>
                </Tooltip>}
                {active && n.children && !collapsed && (
                  <div className="nav-tree ml-4.5 hidden gap-0.5 pl-3 xl:grid">
                    {n.children!.map((c) => (
                      <Link key={c.href} href={c.href} aria-current={c === child ? "page" : undefined}
                        className={cn("relative flex h-8 items-center gap-2.5 rounded-md border px-2.5 text-body-sm text-fg-2 transition-colors duration-(--dur-fast)",
                          c === child ? "border-line bg-raised text-fg" : "border-transparent hover:bg-tray hover:text-fg")}>
                        <span aria-hidden="true" className="nav-tree-branch" /><NavGlyph icon={c.icon} className="size-4 shrink-0" /><span className="min-w-0 truncate">{c.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        ))}
        </ScrollArea>
      </nav>
      <div className="grid gap-2 border-t border-line pt-3">
        <AccountMenu compact={collapsed} />
        {collapsed && (
          // The rail is wide enough for the logo only, so the expand toggle sits at the bottom (≥ 1280 only).
          <button ref={toggleRef} type="button" onClick={() => toggle("expanded")} aria-label="Expand sidebar" aria-expanded="false"
            className="hidden h-9 cursor-pointer place-items-center rounded-md text-fg-3 hover:bg-tray hover:text-fg xl:grid">
            <Icon icon={SidebarExpandIcon} className="size-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
