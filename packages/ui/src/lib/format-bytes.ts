import { nf0, nf1 } from "./number-format";

/** Kept separate so adding upload metadata does not grow unrelated routes' shared format chunk. */
export function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${(v < 10 && (i > 0 || !Number.isInteger(v)) ? nf1 : nf0).format(v)} ${units[i]}`;
}
