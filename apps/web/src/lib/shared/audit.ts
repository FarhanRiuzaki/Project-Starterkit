// Audit log vocabulary and pure helpers shared by the routes (filters, CSV) and the screens (labels, diff, ranges).
// No zod and no React: the screens import this in their first load.
import { appDate, shiftDate } from "@starterkit/ui/lib/format";
import type { AuthLogDto } from "./contracts/audit";

export const AUTH_EVENTS = ["login_success", "login_failed", "logout", "2fa_success", "2fa_failed"] as const;
export const AUTH_METHODS = ["password", "ldap", "google", "apple"] as const;
/** Sort keys each log's endpoint accepts (`sortParam`). */
export const ACTIVITY_SORTS = ["at", "actor", "action"] as const;
export const AUTH_LOG_SORTS = ["at", "login", "event"] as const;

/** Longest from–to span the audit endpoints accept, both days included. */
export const MAX_RANGE_DAYS = 92;
/** Most rows one CSV export returns (newest first). */
export const CSV_MAX_ROWS = 10_000;

const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** What is wrong with an optional from–to pair of "YYYY-MM-DD" dates (already format-checked), or null. */
export function rangeProblem(from: string | undefined, to: string | undefined): "pair" | "order" | "span" | null {
  if (!from !== !to) return "pair";
  if (!from || !to) return null;
  if (from > to) return "order";
  return (dayMs(to) - dayMs(from)) / 86_400_000 + 1 > MAX_RANGE_DAYS ? "span" : null;
}

/** Range presets of the audit screens. */
export const AUDIT_RANGES = ["7d", "30d", "90d"] as const;
export type AuditRange = (typeof AUDIT_RANGES)[number];
const RANGE_DAYS: Record<AuditRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
export const RANGE_LABEL: Record<AuditRange, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

/** The last N calendar days in the app time zone, today included. */
export function presetRange(range: AuditRange, now: number): { from: string; to: string } {
  const to = appDate(now);
  return { from: shiftDate(to, -(RANGE_DAYS[range] - 1)), to };
}

const ACTION_LABEL: Record<string, string> = {
  "user.create": "User created", "user.update": "User updated", "user.activate": "User activated", "user.deactivate": "User deactivated",
  "user.delete": "User deleted", "user.assign_role": "Role assigned", "user.reset_password": "Password reset by admin",
  "user.password": "Password changed by admin", "user.session_end": "User session ended",
  "role.create": "Role created", "role.update": "Role updated", "role.delete": "Role deleted", "permission.create": "Permissions added",
  "me.update": "Profile updated", "me.password": "Own password changed", "me.connect": "Account connected", "me.disconnect": "Account disconnected",
  "me.session_end": "Own session ended", "me.2fa_setup": "Two-factor setup started", "me.2fa_enable": "Two-factor turned on",
  "me.2fa_disable": "Two-factor turned off",
};
/** Readable name of an activity action; an action this build doesn't know shows as recorded. */
export const actionLabel = (action: string) => ACTION_LABEL[action] ?? action;
/** Actions the activity filter offers, in label order. */
export const ACTION_OPTIONS = Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));

export const EVENT_LABEL: Record<AuthLogDto["event"], string> = {
  login_success: "Signed in", login_failed: "Sign-in failed", logout: "Signed out", "2fa_success": "One-time code accepted", "2fa_failed": "One-time code rejected",
};
export const METHOD_LABEL: Record<AuthLogDto["method"], string> = { password: "Password", ldap: "Directory (LDAP)", google: "Google", apple: "Apple" };

/** Shown in place of any value whose field name says it is a credential. */
export const MASK = "••••";
const SECRET = /password|secret|token|recovery/i;
export type DiffRow = { field: string; before: string; after: string };

const record = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** JSON text with credential-named fields masked at every depth. */
const masked = (v: unknown) => JSON.stringify(v, (k, x: unknown) => (k && SECRET.test(k) ? MASK : x));
function show(v: unknown): string {
  if (v === undefined || v === null || v === "") return "–";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) return v.length ? v.join(", ") : "–";
  return masked(v);
}

/**
 * Field-by-field change between an entry's `before` and `after` (top-level keys, `before`'s first): only fields whose
 * value differs. A credential-named field (password, secret, token, recovery…) shows `MASK` for any value it had;
 * nested credential fields are masked inside the JSON text. Non-object sides count as empty.
 */
export function diffFields(before: unknown, after: unknown): DiffRow[] {
  const b = record(before), a = record(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  // Compared unmasked (a changed nested credential still counts as a change); shown masked.
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k])).map((k) => SECRET.test(k)
    ? { field: k, before: b[k] == null ? "–" : MASK, after: a[k] == null ? "–" : MASK }
    : { field: k, before: show(b[k]), after: show(a[k]) });
}

/** The diff on one line, for the CSV: "name: Old → New; roles: Admin → Admin, Viewer". */
export const changeText = (before: unknown, after: unknown) => diffFields(before, after).map((d) => `${d.field}: ${d.before} → ${d.after}`).join("; ");
