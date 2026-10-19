/** Stat tile delta (spec §5.5): the number goes in a tinted pill, the comparison in the caption under the value. */
export type DeltaDirection = "up" | "down" | "flat";

const NUMBER_FIRST = /^([+−-]?[\d.,]+\s?%?)\s+(vs\s.+)$/u;

/** "+18% vs previous 24 hours" → pill "+18%", caption "vs previous 24 hours". Anything else stays a caption. */
export function splitDelta(text: string): { pill: string | null; caption: string } {
  const m = NUMBER_FIRST.exec(text.trim());
  return m ? { pill: m[1]!.trim(), caption: m[2]! } : { pill: null, caption: text };
}

/** good = Healthy ink on Healthy soft, bad = Down ink on Down soft, neutral = fg-2 on tray. */
export function deltaTone(d: { direction: DeltaDirection; good: "up" | "down" | null }): "good" | "bad" | "neutral" {
  if (d.direction === "flat" || d.good == null) return "neutral";
  return d.direction === d.good ? "good" : "bad";
}
