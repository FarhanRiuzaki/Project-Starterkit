"use client";

import { type ComponentProps, type ReactNode, type RefObject, useRef } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { SidebarExpandIcon, CloseIcon, FilterIcon } from "../ui/icons";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { CountBadge } from "./badges";
import { InFilterSheet } from "./filter-sheet";
import { ChunkBoundary } from "./chunk-boundary";
import { FilterGroupRenderer } from "./filter-group";
import { FilterChecksContent, FilterGroupContent, FilterSearchContent } from "./filter-group-content";
const GROUP_RENDERER = { Group: FilterGroupContent, Checks: FilterChecksContent, Search: FilterSearchContent };
export function Root(props: ComponentProps<typeof DialogPrimitive.Root>) { return <DialogPrimitive.Root {...props} />; }
export function Trigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) { return <DialogPrimitive.Trigger data-slot="filter-panel-trigger" {...props} />; }

export function FilterPanelContent({ top, scrollDismissedRef, active, open, phone, focusIdRef, description, clear, canClear, children, onSubmit, restoreFocus }: {
  top: number;
  scrollDismissedRef: RefObject<boolean>;
  active: number; open: boolean; phone: boolean; focusIdRef: RefObject<string | null>; description: string; clear: () => void; canClear: boolean; children: ReactNode;
  onSubmit: ComponentProps<"form">["onSubmit"]; restoreFocus: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const restore = useRef(true);
  return <DialogContent showCloseButton={false} data-slot="floating-filters" aria-modal={phone || undefined} style={phone ? undefined : { top }}
    className="grid-rows-[minmax(0,1fr)] bg-card p-0 md:right-4 md:bottom-4 md:left-auto md:h-auto md:max-h-none md:w-80 md:max-w-80 md:translate-x-0 md:translate-y-0"
    onOpenAutoFocus={e => { e.preventDefault(); scrollDismissedRef.current = false; restore.current = true; const target = focusIdRef.current ? document.getElementById(focusIdRef.current) : null; (target ?? heading.current)?.focus({ preventScroll: true }); focusIdRef.current = null; }}
    onPointerDownOutside={() => { if (!phone) restore.current = false; }}
    onFocusOutside={() => { if (!phone) restore.current = false; }}
    onEscapeKeyDown={() => { restore.current = true; }}
    onCloseAutoFocus={e => { e.preventDefault(); if (!open && restore.current && !scrollDismissedRef.current) restoreFocus(); }}>
    <form onSubmit={onSubmit} className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
        <Icon icon={FilterIcon} />
        <DialogTitle ref={heading} tabIndex={-1} className="text-title-2 outline-none">Filters</DialogTitle>
        {active > 0 && <CountBadge>{active}</CountBadge>}
        <Button type="button" variant="link" size="sm" className="ml-auto" data-filter-clear disabled={!canClear} title={!canClear ? "No filters to clear" : undefined} onClick={clear}>Clear all</Button>
        <DialogClose asChild><Button type="button" size="icon" variant="ghost" data-filter-collapse aria-label={phone ? "Close filters" : "Collapse filters"} onClick={() => { restore.current = true; }}><Icon icon={phone ? CloseIcon : SidebarExpandIcon} /></Button></DialogClose>
      </div>
      <DialogDescription className="sr-only">{description}</DialogDescription>
      <InFilterSheet.Provider value><FilterGroupRenderer.Provider value={GROUP_RENDERER}>
        <div data-slot="filter-panel-body" className="scroll-quiet grid min-h-0 content-start gap-4 overflow-y-auto overscroll-contain p-4 max-md:pb-safe"><ChunkBoundary>{children}</ChunkBoundary></div>
      </FilterGroupRenderer.Provider></InFilterSheet.Provider>
    </form>
  </DialogContent>;
}
