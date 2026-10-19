/** Initials avatar (spec §5.11): no photos; the tint is one of the six categorical softs, chosen by name hash. */
export function initials(name: string): string {
  const s = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  return s || "?";
}

/** FNV-1a 32-bit → slot 1–6 (deterministic across sessions and browsers). */
export function avatarSlot(name: string): 1 | 2 | 3 | 4 | 5 | 6 {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (((h >>> 0) % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}
