"use client";

import { Brand } from "@starterkit/ui/ds";
import { cn } from "@starterkit/ui/lib/cn";
import { Icon } from "@starterkit/ui/ui/icon";
import { SidebarCollapseIcon, SidebarExpandIcon } from "@starterkit/ui/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starterkit/ui/ui/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { usePrefs } from "@/lib/client/prefs-context";
import { isActive, navFor } from "@/lib/shared/nav";
import { viewHref } from "@/lib/shared/prefs";
import { AccountMenu } from "./account-menu";
import { NavGlyph } from "./nav-icon";

/**
 * Sidebar. 248 px from 1280 px (`xl`), collapsible to the 64 px icon rail (preference per viewer, kept in a cookie);
 * 768–1279 px it is always the rail, so the page never scrolls sideways; below 768 px it is not shown and the same
 * sections open from the top bar's menu button (MobileNav, a drawer). Sections come from
 * `navFor(perms)`: a link the viewer cannot open is not shown. Account row pinned to the bottom. The logo nodes come
 * from the server (AppShell), so the wordmark's path data stays out of the client bundle.
 */
export function Sidebar({ mark, wordmark }: { mark: ReactNode; wordmark: ReactNode }) {
  const path = usePathname();
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
      <nav aria-label="Menu" className="-mx-1 mt-2 flex-1 overflow-y-auto px-1">
        {navFor(perms).map((s, si) => (
          <div key={s.id} role="group" aria-labelledby={`nav-section-${s.id}`} className={cn("grid gap-0.5", si > 0 && "mt-4")}>
            {/* Hidden in the rail, still names the group (aria-labelledby reads hidden text). */}
            <span key={`${s.id}-${collapsed}`} id={`nav-section-${s.id}`} className={cn("eyebrow hidden px-2.5 pt-2 pb-2 text-fg-3", label("xl:block"))}>{s.label}</span>
            {s.items.map((n) => {
              const active = isActive(path, n.href);
              return (
                <Tooltip key={n.href}>
                  <TooltipTrigger asChild>
                    {/* aria-label: the text label is hidden in the rail; the link keeps its name. */}
                    <Link href={viewHref(n.href, prefs)} aria-label={n.label} aria-current={active ? "page" : undefined}
                      className={cn("relative flex h-9 items-center justify-center gap-2.5 rounded-md border px-2.5 text-body text-fg-2 transition-colors duration-(--dur-fast)",
                        !collapsed && "xl:justify-start",
                        active ? "border-line bg-raised text-fg shadow-sm" : "border-transparent hover:bg-tray hover:text-fg")}>
                      <NavGlyph icon={n.icon} className="size-4 shrink-0" />
                      <span key={`label-${collapsed}`} className={cn("hidden min-w-0 flex-1 truncate", label("xl:inline"))}>{n.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className={cn(!collapsed && "xl:hidden")}>{n.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="grid gap-2 border-t border-line pt-3">
        {collapsed && (
          // The rail is wide enough for the logo only, so the expand toggle sits above the account row (≥ 1280 only).
          <button ref={toggleRef} type="button" onClick={() => toggle("expanded")} aria-label="Expand sidebar" aria-expanded="false"
            className="hidden h-9 cursor-pointer place-items-center rounded-md text-fg-3 hover:bg-tray hover:text-fg xl:grid">
            <Icon icon={SidebarExpandIcon} className="size-4" />
          </button>
        )}
        <AccountMenu compact={collapsed} />
      </div>
    </aside>
  );
}
