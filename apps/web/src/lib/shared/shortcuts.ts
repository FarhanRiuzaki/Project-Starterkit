/** "G <letter>" shortcut sequence (Linear/GitHub style). Window: 1000 ms. */
export function matchSequence(prev: { key: string; at: number } | null, key: string, now: number): string | null {
  if (!prev || prev.key.toLowerCase() !== "g" || now - prev.at > 1000) return null;
  return /^[a-z]$/i.test(key) ? `G ${key.toUpperCase()}` : null;
}
