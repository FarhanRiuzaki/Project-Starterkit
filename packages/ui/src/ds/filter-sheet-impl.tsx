"use client";

// The Radix dialog behind the phone filter sheet, loaded as its own chunk through ./filter-sheet (deferredOverlay); import that module, not this one.

import { type ComponentProps, type ReactNode, useId } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "../ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { InFilterSheet } from "./filter-sheet";

function Root(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

function Trigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="filter-sheet-trigger" {...props} />;
}

/** Bottom sheet on a phone (ui/dialog): "Filters", the controls one per row, "Show results" stuck to the bottom. */
function FilterSheetContent({ children, actions, description, onSubmit }: {
  children: ReactNode; actions?: ReactNode; description?: string; onSubmit?: ComponentProps<"form">["onSubmit"];
}) {
  const descriptionId = useId();
  const body = <>
      <DialogHeader><DialogTitle>Filters</DialogTitle>{description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}</DialogHeader>
      <InFilterSheet.Provider value>
        <div data-slot="filter-sheet-body" className="grid gap-4 px-6 py-5 [&_input]:w-full [&>button]:justify-self-start">{children}</div>
      </InFilterSheet.Provider>
      <DialogFooter>
        {actions ?? <DialogClose asChild><Button>Show results</Button></DialogClose>}
      </DialogFooter>
    </>;
  const className = "min-w-0 rounded-lg border border-line bg-card";
  return (
    <DialogContent aria-describedby={description ? descriptionId : undefined} className="bg-tray p-tray">
      {onSubmit ? <form onSubmit={onSubmit} className={className}>{body}</form> : <div className={className}>{body}</div>}
    </DialogContent>
  );
}

export { FilterSheetContent, Root, Trigger };
