import { formatDateTimeLong } from "@starterkit/ui/lib/format";
import { ACTION_LABEL, MASK, SECRET_KEY } from "./audit";

export type ActivityChangeRow = { key: string; label: string } & ({ kind: "change"; before: string; after: string } | { kind: "value"; value: string });
export type ActivityChanges = { heading: string; rows: ActivityChangeRow[]; message?: string };
const LABELS: Record<string, string> = {
  name: "Name", username: "Username", email: "Email", isActive: "Status", isLdap: "Directory sign-in",
  roles: "Roles", permissions: "Permissions", invited: "Invitation requested", connected: "Connected accounts",
  twoFactorEnabled: "Two-factor authentication", description: "Description", createdAt: "Created", updatedAt: "Updated",
  session: "Session", provider: "Provider",
};
const has = (v: object, key: string) => Object.hasOwn(v, key);
const label = (key: string) => has(LABELS, key) ? LABELS[key]! : key;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string" && x.trim().length > 0);
const ordered = (v: string[]) => [...new Set(v)].sort();
/** Compare only evidence we can display: a changed raw secret is not proof of changed masked content. */
const safeJson = (v: unknown) => JSON.stringify(v, (key, value: unknown) => key && SECRET_KEY.test(key) && value != null ? MASK : value);
const comparable = (key: string, v: unknown) => SECRET_KEY.test(key) && v != null ? MASK : safeJson(v);
function dateValue(v: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(v);
  if (!match) return null;
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const ms = Date.parse(v);
  return day.toISOString().slice(0, 10) === v.slice(0, 10) && Number.isFinite(ms) ? ms : null;
}
function show(key: string, v: unknown, present = true, stringSet = false): string {
  if (!present || v === undefined) return "Not recorded";
  if (v === null) return "Not set";
  if (SECRET_KEY.test(key)) return MASK;
  if (v === "") return "Empty text";
  if (typeof v === "boolean") return key === "isActive" ? (v ? "Active" : "Inactive") : (v ? "Yes" : "No");
  if (typeof v === "string") {
    const ms = key === "createdAt" || key === "updatedAt" ? dateValue(v) : null;
    return ms === null ? v : formatDateTimeLong(ms);
  }
  if (typeof v === "number") return String(v);
  if (Array.isArray(v) && v.length === 0) return "None";
  if (stringSet && strings(v) && v.every(x => !/[,\r\n]/.test(x) && x === x.trim())) return v.join(", ");
  return safeJson(v) ?? "Not recorded";
}
const value = (key: string, title: string, text: string): ActivityChangeRow => ({ key, label: title, kind: "value", value: text });

/** Action-aware presentation only. Stored snapshots and the API DTO are never changed. Unknown shapes stay visible. */
export function presentActivityChanges(action: string, before: unknown, after: unknown): ActivityChanges {
  const known = has(ACTION_LABEL, action);
  const create = known && action.endsWith(".create") && object(after) && before == null;
  const remove = known && action.endsWith(".delete") && object(before) && after == null;
  const heading = create ? "Initial values" : remove ? "Values before deletion" : "Changes";
  const rows: ActivityChangeRow[] = [];
  if (before == null && after == null) return { heading, rows, message: "Field values were not recorded for this event." };
  // Scalar/array legacy snapshots are recorded values too, never silently converted to an empty object.
  if ((before != null && !object(before)) || (after != null && !object(after))) {
    if (safeJson(before) !== safeJson(after)) rows.push({ key: "snapshot", label: "Recorded values", kind: "change", before: show("", before, before != null), after: show("", after, after != null) });
  } else {
    const b = object(before) ? before : {}, a = object(after) ? after : {};
    const roleDelta = (action === "role.create" || action === "role.update") && has(a, "added") && has(a, "removed") && strings(a.added) && strings(a.removed) && !a.added.some(x => (a.removed as string[]).includes(x));
    const createdPermissions = action === "permission.create" && has(a, "created") && strings(a.created);
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
    for (const key of keys) {
      if ((roleDelta && (key === "added" || key === "removed")) || (createdPermissions && key === "created")) continue;
      if (create || remove) {
        const side = create ? a : b;
        if (has(side, key)) rows.push(value(key, remove && action === "role.delete" && key === "permissions" ? "Permissions before deletion" : label(key), show(key, side[key], true, known && (key === "roles" || key === "permissions"))));
      } else if (known && (key === "roles" || key === "permissions") && has(b, key) && has(a, key) && strings(b[key]) && strings(a[key])) {
        const oldSet = ordered(b[key]), newSet = ordered(a[key]);
        const added = newSet.filter(x => !oldSet.includes(x)), removed = oldSet.filter(x => !newSet.includes(x));
        if (added.length) rows.push(value(`${key}:added`, `${label(key)} added`, show("", added, true, true)));
        if (removed.length) rows.push(value(`${key}:removed`, `${label(key)} removed`, show("", removed, true, true)));
      } else if (has(b, key) !== has(a, key) || comparable(key, b[key]) !== comparable(key, a[key])) {
        rows.push({ key, label: label(key), kind: "change", before: show(key, b[key], has(b, key), known && (key === "roles" || key === "permissions")), after: show(key, a[key], has(a, key), known && (key === "roles" || key === "permissions")) });
      }
    }
    if (roleDelta) {
      rows.push(value("permissions:added", "Permissions added", show("", ordered(a.added as string[]), true, true)));
      rows.push(value("permissions:removed", "Permissions removed", show("", ordered(a.removed as string[]), true, true)));
    }
    if (createdPermissions) rows.push(value("permissions:added", "Permissions added", show("", ordered(a.created as string[]), true, true)));
  }
  return rows.length ? { heading, rows } : { heading, rows, message: "No field changes are shown for the recorded values." };
}

/** Same facts and redaction as the detail UI; the existing CSV encoder still applies cell/formula safety. */
export function activityChangeText(action: string, before: unknown, after: unknown): string {
  const result = presentActivityChanges(action, before, after);
  return result.rows.map(row => row.kind === "change" ? `${row.label}: ${row.before} → ${row.after}` : `${row.label}: ${row.value}`).join("; ") || result.message || "";
}
