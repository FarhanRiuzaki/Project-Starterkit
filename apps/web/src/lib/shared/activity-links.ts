/** Internal, shareable Activity URLs. Recorded target strings remain exact; only entry UUID spelling is canonicalized. */
export function activityEntryHref(id: string): string {
  return `/audit/activity?${new URLSearchParams({ entry: id.toLowerCase() })}`;
}
export function activityHistoryHref(type: "user" | "project", id: string, entry?: string): string {
  const query = new URLSearchParams({ range: "90d", targetType: type, targetId: id });
  if (entry !== undefined) query.set("entry", entry.toLowerCase());
  return `/audit/activity?${query}`;
}
export function activityOpenHref(search: string, id: string): string {
  const query = new URLSearchParams(search);
  query.set("entry", id.toLowerCase());
  return `/audit/activity?${query}`;
}
export function activityCloseHref(search: string): string {
  const query = new URLSearchParams(search);
  query.delete("entry");
  return `/audit/activity${query.size ? `?${query}` : ""}`;
}
export function activityInvestigationHref(search: string, filter: { actorId: string } | { targetType: string; targetId: string }): string {
  const query = new URLSearchParams(search);
  for (const [key, value] of Object.entries(filter)) query.set(key, value);
  query.delete("page"); query.delete("entry");
  return `/audit/activity?${query}`;
}
