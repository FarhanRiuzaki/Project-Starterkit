import type { toast as sonnerToast } from "sonner";

type Toast = typeof sonnerToast;

/** sonner itself, loaded on the first toast. The Toaster (`./sonner`) is mounted lazily too, by the app's Providers. */
const sonner = () => import("sonner").then((m) => m.toast);

/**
 * Result toasts without sonner in a route's first load: a toast only follows a user action, so the library can load
 * then (AGENTS.md §9, `bun run budget`). Same call shapes as sonner's `toast`, `toast.success` and `toast.error`.
 */
export const toast = Object.assign(
  (...a: Parameters<Toast>): void => void sonner().then((t) => t(...a)),
  {
    success: (...a: Parameters<Toast["success"]>): void => void sonner().then((t) => t.success(...a)),
    error: (...a: Parameters<Toast["error"]>): void => void sonner().then((t) => t.error(...a)),
  },
);
