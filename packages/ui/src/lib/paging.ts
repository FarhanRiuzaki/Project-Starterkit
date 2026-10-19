// Logika halaman murni untuk tabel berhalaman (data di memori). Halaman berbasis 1.
import { formatNumber } from "./format";

export const PAGE_SIZE = 25;

const safeTotal = (total: number) => (Number.isFinite(total) && total > 0 ? Math.floor(total) : 0);
const safeSize = (size: number) => (Number.isFinite(size) && size >= 1 ? Math.floor(size) : PAGE_SIZE);

/** Jumlah halaman; minimal 1 agar tabel kosong tetap punya "halaman 1". */
export function pageCount(total: number, size: number = PAGE_SIZE): number {
  const t = safeTotal(total);
  return t === 0 || !(size >= 1) ? 1 : Math.ceil(t / safeSize(size));
}

/** Halaman dibatasi ke [1, pageCount]; NaN/pecahan aman. */
export function clampPage(page: number, total: number, size: number = PAGE_SIZE): number {
  const p = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(p, 1), pageCount(total, size));
}

/** "1–25 of 312" (en dash, thousands via formatNumber); empty → "0 of 0". */
export function rangeLabel(page: number, size: number, total: number): string {
  const t = safeTotal(total);
  if (t === 0) return "0 of 0";
  const s = safeSize(size);
  const p = clampPage(page, t, s);
  const from = (p - 1) * s + 1;
  const to = Math.min(p * s, t);
  return `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(t)}`;
}

/**
 * Pagination buttons: every page up to 7; otherwise the first, the last and the current page ± 1, with "gap"
 * for a skipped run (a run of one page shows that page instead, so a gap always hides at least two).
 */
export function pageWindow(page: number, last: number): (number | "gap")[] {
  const n = Number.isFinite(last) && last >= 1 ? Math.floor(last) : 1;
  const p = Math.min(Math.max(Number.isFinite(page) ? Math.floor(page) : 1, 1), n);
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
  const keep = new Set([1, n, p - 1, p, p + 1].filter((x) => x >= 1 && x <= n));
  // Fill one-page holes: [1, 3] → [1, 2, 3].
  const sorted = [...keep].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) if (sorted[i]! - sorted[i - 1]! === 2) keep.add(sorted[i]! - 1);
  // Near an edge keep three pages on that side (1, 2, 3 … 13) so the row length stays steady.
  if (p <= 2) keep.add(3);
  if (p >= n - 1) keep.add(n - 2);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const x of [...keep].sort((a, b) => a - b)) {
    if (x - prev > 1) out.push("gap");
    out.push(x);
    prev = x;
  }
  return out;
}

/** Footer status of a paged table: "Showing 1–15 of 12,345"; `capped` (the server stopped counting) → "of 100,000+". */
export function showingLabel(page: number, size: number, total: number, capped = false): string {
  const label = rangeLabel(page, size, total);
  return `Showing ${capped && safeTotal(total) > 0 ? `${label}+` : label}`;
}
