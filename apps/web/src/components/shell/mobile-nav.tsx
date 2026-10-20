"use client";

import { cn } from "@starterkit/ui/lib/cn";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "@starterkit/ui/ui/drawer";
import { Icon } from "@starterkit/ui/ui/icon";
import { CloseIcon, MenuIcon } from "@starterkit/ui/ui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { isActive, navFor } from "@/lib/shared/nav";
import { NavGlyph } from "./nav-icon";

const ICON_BUTTON = "inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-fg-2 hover:bg-tray hover:text-fg";

/**
 * Phone navigation (below 768 px, and on a touch tablet up to 1279 px, where the rail's hover labels can't be read; from 1280 the full sidebar has them; the top bar's
 * menu button): the sidebar's sections in a drawer from the left
 * (packages/ui `Drawer`, a deferred chunk). Items are 44 px. It closes on any route change (`closeOn`), on a tap on an
 * item (also the current page), on Escape and on the scrim; focus then returns to the menu button.
 */
export function MobileNav({ wordmark }: { wordmark: ReactNode }) {
  const path = usePathname();
  const { perms } = useAuth();
  return (
    <Drawer closeOn={path}>
      <DrawerTrigger asChild>
        <button type="button" aria-label="Open navigation" className={cn(ICON_BUTTON, "-ml-1 md:pointer-fine:hidden xl:hidden")}>
          <Icon icon={MenuIcon} className="size-5" />
        </button>
      </DrawerTrigger>
      <DrawerContent title="Navigation">
        <div className="flex h-14 shrink-0 items-center justify-between pr-3 pl-4">
          {wordmark}
          <DrawerClose asChild>
            <button type="button" aria-label="Close navigation" className={ICON_BUTTON}><Icon icon={CloseIcon} className="size-4" /></button>
          </DrawerClose>
        </div>
        <nav aria-label="Menu" className="flex-1 overflow-y-auto px-3 pb-4">
          {navFor(perms).map((s, si) => (
            <div key={s.id} role="group" aria-labelledby={`drawer-section-${s.id}`} className={cn("grid gap-0.5", si > 0 && "mt-4")}>
              <span id={`drawer-section-${s.id}`} className="eyebrow px-2.5 pt-2 pb-2 text-fg-3">{s.label}</span>
              {s.items.map((n) => {
                const active = isActive(path, n.href);
                return (
                  <DrawerClose key={n.href} asChild>
                    <Link href={n.href} aria-current={active ? "page" : undefined}
                      className={cn("flex h-11 items-center gap-3 rounded-md border px-2.5 text-body text-fg-2",
                        active ? "border-line bg-raised text-fg shadow-sm" : "border-transparent hover:bg-tray hover:text-fg")}>
                      <NavGlyph icon={n.icon} className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{n.label}</span>
                    </Link>
                  </DrawerClose>
                );
              })}
            </div>
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
