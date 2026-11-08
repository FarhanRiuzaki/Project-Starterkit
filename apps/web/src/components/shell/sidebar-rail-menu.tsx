"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@starterkit/ui/lib/cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@starterkit/ui/ui/dropdown-menu";
import { Icon } from "@starterkit/ui/ui/icon";
import { ChevronRightIcon } from "@starterkit/ui/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@starterkit/ui/ui/tooltip";
import type { NavChild, NavItem } from "@/lib/shared/nav";
import { NavGlyph } from "./nav-icon";

/** Icon-rail view picker: a standard label tooltip, then the shared menu on click, tap or keyboard open. */
export function SidebarRailMenu({ item, active, child, collapsed }: { item: NavItem; active: boolean; child: NavChild | null; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const quiet = useRef(false);
  const outside = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // CSS decides the breakpoint. Close a flyout when its rail trigger becomes hidden on expansion/resize.
  useEffect(() => {
    if (!open || !trigger.current) return;
    const el = trigger.current;
    const observer = new ResizeObserver(() => { if (!el.getClientRects().length) setOpen(false); });
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={value => { setOpen(value); setTip(false); if (!value) quiet.current = !outside.current; outside.current = false; }}>
      <Tooltip open={tip} onOpenChange={value => setTip(value && !open && !quiet.current)}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button ref={trigger} type="button" aria-label={item.label}
              onBlur={() => { quiet.current = false; }} onPointerLeave={() => { quiet.current = false; }}
              className={cn("relative mx-auto flex size-9 cursor-pointer items-center justify-center rounded-md border text-fg-2 transition-colors duration-(--dur-fast)",
                !collapsed && "xl:hidden", active ? "border-line bg-raised text-fg" : "border-transparent hover:bg-tray hover:text-fg")}>
              <NavGlyph icon={item.icon} className="size-4 shrink-0" />
              <Icon icon={ChevronRightIcon} className="absolute right-0.5 size-2.5 text-fg-3" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="start" sideOffset={8}
        onInteractOutside={() => { outside.current = true; }} className="w-52">
        <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
        {item.children?.map(view => (
          <DropdownMenuItem key={view.href} asChild>
            <Link href={view.href} aria-current={view === child ? "page" : undefined} className={cn(view === child && "bg-tray text-fg")}>
              <NavGlyph icon={view.icon} className="size-4" />{view.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
