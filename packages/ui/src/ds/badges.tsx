import type { ReactNode } from "react";
import { Icon } from "../ui/icon";
import { CloseIcon } from "../ui/icons";
import { cn } from "../lib/cn";

/** Count badge (spec §5.8): 18 px pill, --tray (on a tray: --card), label fg-2, tabular. Counts only, never words. */
export function CountBadge({ children, inTray, className }: { children: ReactNode; inTray?: boolean; className?: string }) {
  return (
    <span data-slot="count-badge" className={cn("inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1.5 text-label text-fg-2 tabular",
      inTray ? "bg-card" : "bg-tray", className)}>{children}</span>
  );
}

/** A categorical slot 1–6, or "neutral" for the plain, lowest-rank member of a set (Viewer): grey, no hue. */
export type CategorySlot = 1 | 2 | 3 | 4 | 5 | 6 | "neutral";
const SLOT_BG: Record<CategorySlot, string> = { 1: "bg-chart-1/10", 2: "bg-chart-2/10", 3: "bg-chart-3/10", 4: "bg-chart-4/10", 5: "bg-chart-5/10", 6: "bg-chart-6/10", neutral: "bg-inset" };
const SLOT_DOT: Record<CategorySlot, string> = { 1: "bg-chart-1", 2: "bg-chart-2", 3: "bg-chart-3", 4: "bg-chart-4", 5: "bg-chart-5", 6: "bg-chart-6", neutral: "bg-fg-4" };

/**
 * Category chip (spec §5.8) for models, teams, result types: 22 px, radius 6, the categorical slot's soft tint
 * (10 %) with a 6 px slot-colour dot and text in --fg (never the series colour). `slot` follows the entity's
 * series slot so the chip matches its chart colour. Internet results: Allowed = slot 1, Denied = slot 2.
 */
export function CategoryChip({ label, slot, className }: { label: string; slot: CategorySlot; className?: string }) {
  return (
    <span data-slot="category-chip" className={cn("inline-flex h-5.5 items-center gap-1.5 rounded-sm px-2 text-label whitespace-nowrap text-fg", SLOT_BG[slot], className)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", SLOT_DOT[slot])} />{label}
    </span>
  );
}

/**
 * Active filter chip (spec §5.6): 24 px, radius 6, --primary-soft, primary text, × 14 px removes it. The × is 20 px
 * drawn; a pseudo-element extends its hit area to 28 px (desktop target minimum).
 */
export function FilterChip({ children, onRemove, removeLabel }: { children: ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <span data-slot="filter-chip" className="inline-flex h-6 items-center gap-1 rounded-sm bg-primary-soft pr-0.5 pl-2 font-mono text-label text-primary-ink">
      {children}
      <button type="button" aria-label={removeLabel} onClick={onRemove}
        className="relative inline-grid size-5 cursor-pointer place-items-center rounded-xs outline-none after:absolute after:-inset-1 after:content-[''] hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">
        <Icon icon={CloseIcon} className="size-3.5" />
      </button>
    </span>
  );
}
