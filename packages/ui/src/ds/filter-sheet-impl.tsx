"use client";

// The Radix dialog behind the phone filter sheet, loaded as its own chunk through ./filter-sheet (deferredOverlay); import that module, not this one.

import type { ComponentProps, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "../ui/button";
import { DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { InFilterSheet } from "./filter-sheet";

function Root(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

function Trigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="filter-sheet-trigger" {...props} />;
}

/** Bottom sheet on a phone (ui/dialog): "Filters", the controls one per row, "Show results" stuck to the bottom. */
function FilterSheetContent({ children }: { children: ReactNode }) {
  return (
    <DialogContent aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Filters</DialogTitle></DialogHeader>
      <InFilterSheet.Provider value>
        <div data-slot="filter-sheet-body" className="grid gap-4 px-6 py-5 [&_input]:w-full [&>button]:justify-self-start">{children}</div>
      </InFilterSheet.Provider>
      <DialogFooter>
        <DialogClose asChild><Button>Show results</Button></DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

export { FilterSheetContent, Root, Trigger };
