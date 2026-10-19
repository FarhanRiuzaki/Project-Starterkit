/** Natively focusable tags: they never get a tabindex from focusBack. */
const FOCUSABLE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

export type ReturnOptions = {
  /** The action changed the page (e.g. removed the opener's row once the list reloads): don't return to the opener. */
  skipOrigin?: boolean;
  /** Selectors tried in order before the page's h1, e.g. the table title or the page's primary button. */
  fallbacks?: readonly string[];
};

const usable = (e: HTMLElement | null, doc: Document): e is HTMLElement =>
  !!e && e.isConnected && e !== doc.body && !(e as HTMLButtonElement).disabled;

/**
 * Where focus goes when a dialog mounted on click (next/dynamic, no Radix trigger) closes: the control that opened it
 * while it is still there (and `skipOrigin` isn't set), else the first usable fallback, else the page's h1. Never the body.
 */
export function returnTarget(origin: HTMLElement | null, doc: Document = document, o: ReturnOptions = {}): HTMLElement | null {
  if (!o.skipOrigin && usable(origin, doc)) return origin;
  for (const sel of [...(o.fallbacks ?? []), "main h1"]) {
    const e = doc.querySelector<HTMLElement>(sel);
    if (usable(e, doc)) return e;
  }
  return null;
}

/**
 * Focus return for dialogs mounted on click: focus `returnTarget(...)`, made programmatically focusable when it isn't
 * a control (h1, a table title). Use from the dialog's `onCloseAutoFocus` after `preventDefault()`.
 */
export function focusBack(origin: HTMLElement | null, doc: Document = document, o: ReturnOptions = {}): void {
  const back = returnTarget(origin, doc, o);
  if (back && !FOCUSABLE.has(back.tagName) && !back.hasAttribute("tabindex")) back.setAttribute("tabindex", "-1");
  back?.focus();
}

/** The element that has focus now (the control being activated), or null on the server. */
export const activeElement = (): HTMLElement | null => (typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
