/** Category query keys whose repeated values are a selection set; all other query keys remain scalar. */
export const MULTI_FILTER_KEYS = ["role", "status", "module", "action", "event", "method"] as const;
import { canonicalSelection } from "@starterkit/ui/lib/filter-selection";
export { canonicalSelection, FILTER_SELECTION_MAX, FILTER_SEARCH_DEBOUNCE, selectionState, selectionValues } from "@starterkit/ui/lib/filter-selection";

/** Raw boundary values: comma and JSON-looking names stay literal; only allowlisted keys retain repeats. */
export function filterQueryValues(params: URLSearchParams, multiple: readonly string[] = MULTI_FILTER_KEYS): Record<string, string | string[]> {
  return Object.fromEntries([...new Set(params.keys())].map(key => {
    const values = params.getAll(key);
    return [key, multiple.includes(key) && values.length > 1 ? values : values[0]!];
  }));
}
/** Canonical query spelling used by named views and remembered navigation. */
export function canonicalFilterQuery(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(params);
  for (const key of MULTI_FILTER_KEYS) {
    const values = canonicalSelection(out.getAll(key).filter(value => value !== ""));
    out.delete(key);
    values.forEach(value => out.append(key, value));
  }
  out.sort();
  return out;
}
