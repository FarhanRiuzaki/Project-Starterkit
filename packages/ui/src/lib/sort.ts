export type SortDir = "asc" | "desc";
const collator = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true });

/** Urut stabil; null/undefined selalu di akhir apa pun arahnya. Tidak memutasi input. */
export function sortRows<T>(rows: T[], value: (r: T) => string | number | null | undefined, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, v: value(r) }))
    .sort((a, b) => {
      if (a.v == null || b.v == null) return a.v == null && b.v == null ? a.i - b.i : a.v == null ? 1 : -1;
      const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : collator.compare(String(a.v), String(b.v));
      return c === 0 ? a.i - b.i : c * sign;
    })
    .map((x) => x.r);
}
