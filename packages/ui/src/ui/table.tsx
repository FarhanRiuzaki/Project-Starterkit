"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * True while the element is wider inside than its box (it scrolls sideways): such a box must be reachable by keyboard
 * (a named, focusable region; axe scrollable-region-focusable), and only then, so a table that fits adds no tab stop.
 */
export function useScrollsX<T extends HTMLElement>(): [React.RefCallback<T>, boolean] {
  const [el, setEl] = React.useState<T | null>(null);
  const [scrolls, setScrolls] = React.useState(false);
  React.useEffect(() => {
    if (!el) return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, scrolls];
}

/**
 * Table (spec §5.7): header 40 px on the tray tint, rows --row-h (44 / compact 36), 1 px dividers, no zebra, no vertical rules.
 * Wider than the screen (a phone), it scrolls sideways inside its card; the box is then a focusable region named after the table.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  const [ref, scrolls] = useScrollsX<HTMLDivElement>();
  return (
    <div ref={ref} data-slot="table-container" className="scroll-quiet relative w-full overflow-x-auto"
      {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": props["aria-label"] } : {})}>
      <table data-slot="table" className={cn("w-full border-separate border-spacing-0 text-body", className)} {...props} />
    </div>
  );
}
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("bg-tray", className)} {...props} />;
}
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child_td]:border-b-0", className)} {...props} />;
}
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot data-slot="table-footer" className={cn("bg-tray font-medium", className)} {...props} />;
}
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("group/row transition-colors duration-(--dur-instant) hover:bg-tray/60 data-[state=selected]:bg-row-selected data-[state=selected]:[&>td:first-child]:row-mark", className)} {...props} />;
}
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <th data-slot="table-head" className={cn("h-10 border-b border-line px-3 text-left align-middle text-label font-normal whitespace-nowrap text-fg-3", className)} {...props} />;
}
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("h-(--row-h) border-b border-line px-3 py-1.5 align-middle whitespace-nowrap", className)} {...props} />;
}
function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("mt-3 text-label font-normal text-fg-3", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
