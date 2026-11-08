export const FILTER_SELECTION_MAX = 50;
export const FILTER_SEARCH_DEBOUNCE = 300;
/** Exact deduplication with stable UTF-16 code-unit ordinal ordering, shared by URL, API predicates and saved views. */
export const canonicalSelection = (values: readonly string[]): string[] => [...new Set(values)].sort();

/** Internal string state only. Public URLs use repeated values, never JSON coercion or comma splitting. */
export function selectionValues(value: string): string[] {
  if (!value) return [];
  try {
    const values: unknown = JSON.parse(value);
    if (Array.isArray(values) && values.every(item => typeof item === "string")) return canonicalSelection(values);
  } catch { /* A legacy scalar passed by a local caller is a singleton. */ }
  return [value];
}
export const selectionState = (values: readonly string[]): string => values.length ? JSON.stringify(canonicalSelection(values)) : "";
