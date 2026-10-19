/**
 * When a deferred overlay's stand-in trigger opens (no React; tested in deferred-intent.test.ts). It mirrors the
 * closed-state behaviour of the Radix trigger it stands in for, so a press before the overlay chunk arrives does the
 * same thing as after:
 * - `menu` (DropdownMenu.Trigger): primary-button pointer down without Ctrl, or Enter / Space / ArrowDown.
 * - `dialog` (Popover.Trigger): the button's click only (Enter and Space fire it too), so nothing here.
 */
export type OverlayKind = "menu" | "dialog";

export function opensOnPointer(kind: OverlayKind, e: { button: number; ctrlKey: boolean }): boolean {
  return kind === "menu" && e.button === 0 && !e.ctrlKey;
}

export function opensOnKey(kind: OverlayKind, key: string): boolean {
  return kind === "menu" && (key === "Enter" || key === " " || key === "ArrowDown");
}

/** How a stand-in was pressed: a key press opens with focus on the first item, as the Radix menu does. */
export type OpenHow = "pointer" | "key";
export type Intent = { how: OpenHow; at: number };
/** A press older than this when the chunk finally arrives is dropped: the user has moved on. */
export const INTENT_MAX_AGE_MS = 5000;

/** The press to honour when the chunk arrives at `now`, or null. Callers clear the intent either way (once only). */
export function takeIntent(intent: Intent | null, now: number): OpenHow | null {
  return intent && now - intent.at <= INTENT_MAX_AGE_MS ? intent.how : null;
}
