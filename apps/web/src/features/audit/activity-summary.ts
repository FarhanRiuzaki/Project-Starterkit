import type { ActivityDto } from "@starterkit/shared/contracts/audit";

const TYPES: Record<string, string> = { user: "User", role: "Role", permission: "Permission", project: "Project", profile: "Profile" };
/** Event identity only: no lookup or assumption that the target still exists. */
export function activitySummary(entry: Pick<ActivityDto, "actor" | "target">): string {
  const actor = entry.actor.name || entry.actor.id || "Unknown user";
  const target = entry.target.label || entry.target.id || "Unknown target";
  const type = Object.hasOwn(TYPES, entry.target.type) ? TYPES[entry.target.type] : entry.target.type;
  return `By ${actor} · ${type ? `${type}: ` : ""}${target}`;
}
