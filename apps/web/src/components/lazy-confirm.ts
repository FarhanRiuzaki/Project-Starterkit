"use client";

import dynamic from "next/dynamic";

/**
 * ConfirmActionDialog loaded on first render instead of with the page: for a dialog that only a click or a leave opens
 * (leave without saving, turn off 2FA, disconnect), so the form routes stay under the first-load budget (AGENTS.md §9).
 * Same props; render it only when it should show (or with `open`): the chunk loads after hydration.
 */
export const LazyConfirmActionDialog = dynamic(
  () => import("@starterkit/ui/ds/confirm-action-dialog").then((m) => m.ConfirmActionDialog),
  { ssr: false },
);
