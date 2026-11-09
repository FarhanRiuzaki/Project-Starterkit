/** Bounds for exact recorded identities in activity investigation URLs; IDs remain opaque and case-sensitive. */
export const ACTIVITY_TARGET_TYPE_MAX = 64;
export const ACTIVITY_TARGET_ID_MAX = 512;
/** UUID shape shared with the API's path parser (legacy UUIDs and upper-case spellings are supported). */
export const ACTIVITY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Presence matters: explicitly empty or partial exact filters must never silently become an unfiltered request. */
export function validActivityExactFilters(query: Pick<URLSearchParams, "has" | "get">): boolean {
  if (query.has("actorId") && !ACTIVITY_ID_PATTERN.test(query.get("actorId")!)) return false;
  if (query.has("targetType") !== query.has("targetId")) return false;
  if (!query.has("targetType")) return true;
  const type = query.get("targetType")!, id = query.get("targetId")!;
  return type.length >= 1 && type.length <= ACTIVITY_TARGET_TYPE_MAX && id.length >= 1 && id.length <= ACTIVITY_TARGET_ID_MAX && !type.includes("\0") && !id.includes("\0");
}
