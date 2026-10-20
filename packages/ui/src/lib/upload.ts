import { formatBytes } from "./format";

/**
 * Upload rules, pure (ds/file-upload.tsx uses them). `accept` entries are MIME types ("image/png"), MIME families
 * ("image/*") or extensions (".pdf"), as the native `accept` attribute takes them.
 */
export type AcceptRule = { accept?: readonly string[]; maxSize?: number };

export function accepts(file: { name: string; type: string }, accept: readonly string[] | undefined): boolean {
  if (!accept?.length) return true;
  const name = file.name.toLowerCase(), type = file.type.toLowerCase();
  return accept.some((a) => {
    const x = a.trim().toLowerCase();
    if (x.startsWith(".")) return name.endsWith(x);
    if (x.endsWith("/*")) return type.startsWith(x.slice(0, -1));
    return type === x;
  });
}

/** Why `file` can't be added (type, then size, then empty), worded as GOV.UK file upload errors; null when it can. */
export function fileProblem(file: { name: string; type: string; size: number }, rule: AcceptRule, acceptLabel?: string): string | null {
  if (!accepts(file, rule.accept)) return `The file must be ${acceptLabel ?? `one of ${rule.accept?.join(", ")}`}.`;
  if (rule.maxSize != null && file.size > rule.maxSize) return `The file must be smaller than ${formatBytes(rule.maxSize)}.`;
  if (file.size === 0) return "The file is empty.";
  return null;
}

/** Of `incoming`, how many fit beside `current` files under `max` (all of them without a max). */
export const roomFor = (current: number, incoming: number, max?: number) => (max == null ? incoming : Math.max(0, Math.min(incoming, max - current)));
