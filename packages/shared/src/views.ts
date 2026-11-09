export const SAVED_VIEW_QUERY_MAX = 4096;
export const REMEMBERED_VIEW_QUERY_MAX = 300;

/** Activity entry is transient dialog identity. Preserve every other raw segment and all other pages' query bytes. */
export function withoutActivityEntry(path: string, query: string): string {
  return path === "/audit/activity" ? query.split("&").filter(part => !new URLSearchParams(part).has("entry")).join("&") : query;
}
