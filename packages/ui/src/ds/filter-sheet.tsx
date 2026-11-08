"use client";

import { createContext, type FormEventHandler, type ReactNode } from "react";
import { Button } from "../ui/button";
import { deferredOverlay } from "../ui/deferred-overlay";
import { CountBadge } from "./badges";

/** Filter form context: `FilterMenu` renders as a labelled native select in the floating card or sheet. */
export const InFilterSheet = createContext(false);

/**
 * Phone filters (below 768 px): a "Filters" button with the number of active filters opens a bottom sheet
 * (`Dialog phone="sheet"`) holding the toolbar's filter controls. The Radix dialog is a deferred chunk
 * (./filter-sheet-impl), out of every route's first-load JS. The controls write to the URL as they do inline, so
 * legacy callers use "Show results"; FilterLayout supplies a controlled Apply form and footer.
 */
const sheet = deferredOverlay("dialog", "filter-sheet-trigger", () => import("./filter-sheet-impl"));
const Content = sheet.part("FilterSheetContent");

export function FilterSheet({ active, children, triggerClassName = "md:hidden", actions, description, onSubmit, open, onOpenChange }: {
  active: number; children: ReactNode; triggerClassName?: string; actions?: ReactNode; description?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>; open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  return (
    <sheet.Root open={open} onOpenChange={onOpenChange}>
      <sheet.Trigger asChild>
        <Button variant="secondary" className={triggerClassName} aria-label={active > 0 ? `Filters, ${active} active` : undefined}>
          Filters{active > 0 && <CountBadge>{active}</CountBadge>}
        </Button>
      </sheet.Trigger>
      <Content actions={actions} description={description} onSubmit={onSubmit}>{children}</Content>
    </sheet.Root>
  );
}
/** The chunk loader (tests: load it without a root). */
export const filterSheetLoader = sheet.loader;
