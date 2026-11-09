import { readTable, tableSearch, writeTable, type FilterParser, type TableSpec, type TableState } from "./table-state";

/** A table edit starting from the raw current URL. */
export function writeTableFromSearch<F extends Record<string, string>>(source: URLSearchParams, patch: Partial<TableState<NoInfer<F>>>, spec: TableSpec<F>, rawKeys: readonly string[]): URLSearchParams | null {
  const state = readTable(source, spec);
  const desired = (key: string) => (spec.filters[key] as FilterParser<string>)(patch[key as keyof typeof patch] as string ?? null);
  const rawChanged = rawKeys.some(key => Object.hasOwn(patch, key) && (desired(key) === (spec.filters[key] as FilterParser<string>)(null)
    ? source.has(key) : !source.has(key) || source.get(key) !== desired(key)));
  const next = writeTable(state, patch, spec) ?? (rawChanged ? tableSearch(state, spec) : null);
  if (!next) return null;
  for (const key of rawKeys) {
    if (Object.hasOwn(patch, key)) {
      const value = desired(key);
      if (value === (spec.filters[key] as FilterParser<string>)(null)) next.delete(key); else next.set(key, value);
    } else if (source.has(key)) next.set(key, source.get(key)!); else next.delete(key);
  }
  if (rawChanged) next.delete("page");
  return next;
}
