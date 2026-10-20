"use client";

import { createContext, type ReactNode } from "react";
import { Button } from "../ui/button";
import { deferredOverlay } from "../ui/deferred-overlay";
import { CountBadge } from "./badges";

/** True inside the phone filter sheet: `FilterMenu` renders as a labelled native select there. */
export const InFilterSheet = createContext(false);

/**
 * Phone filters (below 768 px): a "Filters" button with the number of active filters opens a bottom sheet
 * (`Dialog phone="sheet"`) holding the toolbar's filter controls. The Radix dialog is a deferred chunk
 * (./filter-sheet-impl), out of every route's first-load JS. The controls write to the URL as they do inline, so
 * there is no separate apply step; "Show results" closes the sheet.
 */
const sheet = deferredOverlay("dialog", "filter-sheet-trigger", () => import("./filter-sheet-impl"));
const Content = sheet.part("FilterSheetContent");

export function FilterSheet({ active, children }: { active: number; children: ReactNode }) {
  return (
    <sheet.Root>
      <sheet.Trigger asChild>
        <Button variant="secondary" className="md:hidden" aria-label={active > 0 ? `Filters, ${active} active` : undefined}>
          Filters{active > 0 && <CountBadge>{active}</CountBadge>}
        </Button>
      </sheet.Trigger>
      <Content>{children}</Content>
    </sheet.Root>
  );
}
/** The chunk loader (tests: load it without a root). */
export const filterSheetLoader = sheet.loader;
