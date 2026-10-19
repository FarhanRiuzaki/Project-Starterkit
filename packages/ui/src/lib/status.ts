// The five health states (design-system.md): names equal the `--<health>-mark/ink/soft` tokens.
// This file is the single source of generic status wording; copy that states real thresholds belongs next to the
// feature that owns them, not here.
export type Health = "healthy" | "degraded" | "down" | "stopped" | "unknown";

/** `order` = severity for rollups (stopped is the quietest, down the loudest). */
export const HEALTH: Record<Health, { label: string; description: string; order: number }> = {
  healthy: { label: "Healthy", description: "Working normally; no action needed.", order: 1 },
  degraded: { label: "Degraded", description: "Running, but something needs attention.", order: 3 },
  down: { label: "Down", description: "Not working; check the reason and fix it first.", order: 4 },
  stopped: { label: "Stopped", description: "Turned off on purpose.", order: 0 },
  unknown: { label: "Unknown", description: "No current data, so the status can't be determined.", order: 2 },
};

export function worstHealth(list: Health[]): Health {
  if (list.length === 0) return "unknown";
  return list.reduce((a, b) => (HEALTH[b].order > HEALTH[a].order ? b : a));
}
