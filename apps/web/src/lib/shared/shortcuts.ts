/** "G <letter>" shortcut sequence (Linear/GitHub style). Window: 1000 ms. */
export function matchSequence(prev: { key: string; at: number } | null, key: string, now: number): string | null {
  if (!prev || prev.key.toLowerCase() !== "g" || now - prev.at > 1000) return null;
  return /^[a-z]$/i.test(key) ? `G ${key.toUpperCase()}` : null;
}

/** The keys of a "G D" shortcut as key caps: ["G", "D"]. */
export const goKeys = (shortcut: string): string[] => shortcut.split(" ").filter(Boolean);

/** "?" (Shift + /) opens the shortcut list: the character itself, without Ctrl, Alt or Meta. */
export const isHelpKey = (e: { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean }) => e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey;
