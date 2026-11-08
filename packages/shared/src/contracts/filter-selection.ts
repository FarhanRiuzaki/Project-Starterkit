import { z } from "zod";
import { canonicalSelection, FILTER_SELECTION_MAX } from "../filter-selection";

/** Legacy scalar (including empty = Any), or at most 50 raw choices before exact deduplication. */
export function filterSelection<T extends z.ZodType<string>>(item: T) {
  return z.union([z.literal(""), item, z.array(item).max(FILTER_SELECTION_MAX)])
    .transform(value => canonicalSelection(typeof value === "string" ? value === "" ? [] : [value] : value));
}
