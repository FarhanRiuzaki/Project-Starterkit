import type { FilterField } from "@starterkit/ui/ds";
import type { ActivityFilters } from "@/lib/shared/queries";

const identity = (value: string) => value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value) || value.includes(" · ") ? JSON.stringify(value) : value;
export function exactFilterSummary(search: Pick<URLSearchParams, "has" | "get">): Record<string, string> {
  return {
    exactActor: search.has("actorId") ? JSON.stringify([search.get("actorId")]) : "",
    exactTarget: search.has("targetType") || search.has("targetId") ? JSON.stringify([search.get("targetType"), search.get("targetId")]) : "",
  };
}
export const EXACT_FILTER_FIELDS: readonly FilterField[] = [
  { key: "exactActor", label: "Actor ID", format: value => { const [id] = JSON.parse(value) as [string]; return id === "" ? "Empty value" : identity(id); } },
  { key: "exactTarget", label: "Target", format: value => {
    const [type, id] = JSON.parse(value) as [string | null, string | null];
    return `${type === null ? "Missing type" : type === "" ? "Empty type" : identity(type)} · ${id === null ? "Missing ID" : id === "" ? "Empty ID" : identity(id)}`;
  } },
];
/** These virtual fields are chip-only: only a deliberate clear produces real URL keys. Context actions set identities directly. */
export function exactFilterClearPatch(next: Record<string, string>, previous: Record<string, string>): Partial<ActivityFilters> {
  return {
    ...(next.exactActor === "" && previous.exactActor !== "" ? { actorId: "" } : {}),
    ...(next.exactTarget === "" && previous.exactTarget !== "" ? { targetType: "", targetId: "" } : {}),
  };
}
