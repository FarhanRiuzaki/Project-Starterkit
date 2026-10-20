import type { toast as sonnerToast } from "sonner";

type Toast = typeof sonnerToast;

/**
 * sonner drops a toast published while no Toaster is subscribed (its Toaster keeps no backlog), and the app mounts its
 * Toaster lazily (next/dynamic after hydration; React StrictMode mounts it twice in development). So a toast waits
 * until a Toaster is mounted: `./sonner` reports mount and unmount here.
 */
let markReady: () => void = () => {};
let ready = new Promise<void>((r) => { markReady = r; });
export function toasterMounted(on: boolean): void {
  if (on) markReady();
  else ready = new Promise<void>((r) => { markReady = r; });
}

/** sonner itself, loaded on the first toast, once a Toaster listens. */
const sonner = () => Promise.all([import("sonner"), ready]).then(([m]) => m.toast);

/** How long an undo toast stays (Material snackbar: 4–10 s); sonner pauses it while hovered or focused. */
const UNDO_MS = 8000;

/**
 * Result toasts without sonner in a route's first load: a toast only follows a user action, so the library can load
 * then (AGENTS.md §9, `bun run budget`). Same call shapes as sonner's `toast`, `toast.success` and `toast.error`.
 * `toast.undo`: the result of a reversible action with an "Undo" button (NN/g: undo over a confirmation for what can be
 * reversed); `onUndo` reports its own outcome.
 */
export const toast = Object.assign(
  (...a: Parameters<Toast>): void => void sonner().then((t) => t(...a)),
  {
    success: (...a: Parameters<Toast["success"]>): void => void sonner().then((t) => t.success(...a)),
    error: (...a: Parameters<Toast["error"]>): void => void sonner().then((t) => t.error(...a)),
    undo: (message: string, onUndo: () => void, opts: { description?: string } = {}): void =>
      void sonner().then((t) => t(message, { ...opts, duration: UNDO_MS, action: { label: "Undo", onClick: onUndo } })),
  },
);
