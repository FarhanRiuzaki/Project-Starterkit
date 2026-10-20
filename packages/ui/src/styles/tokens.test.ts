import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(path.resolve(import.meta.dirname, "./tokens.css"), "utf8");

/** `--name: value` pairs of the first `selector { ... }` block. */
function decls(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`block ${selector} missing`);
  const body = CSS.slice(start, CSS.indexOf("\n}", start)).replace(/\/\*[\s\S]*?\*\//g, "");
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)].map((m) => [m[1]!, m[2]!.trim()]));
}

/** Theme = :root, overridden by .dark for the dark theme; `var(--x)` aliases resolve to their hex. */
function theme(dark: boolean): Record<string, string> {
  const raw = { ...decls(":root"), ...(dark ? decls(".dark") : {}) };
  const resolve = (v: string, depth = 0): string => {
    const m = /^var\(--([a-z0-9-]+)\)$/.exec(v);
    if (!m || depth > 5) return v.toLowerCase();
    return resolve(raw[m[1]!] ?? v, depth + 1);
  };
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, resolve(v)]));
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["bg", "sheet", "tray", "card", "inset", "raised", "row-selected", "primary-soft"];
const INKS = ["fg", "fg-2", "fg-3", "primary", "primary-ink", "healthy-ink", "degraded-ink", "down-ink", "stopped-ink", "unknown-ink"];
const STATES = ["healthy", "degraded", "down", "stopped", "unknown"];
const TEXT: [string, string][] = [
  ...INKS.flatMap((ink) => SURFACES.map((s) => [ink, s] as [string, string])),
  ...STATES.map((s) => [`${s}-ink`, `${s}-soft`] as [string, string]),
  ...STATES.map((s) => ["fg", `${s}-soft`] as [string, string]),
  ["primary-foreground", "primary"], ["primary-foreground", "primary-hover"], ["action-fg", "action"], ["action-fg", "action-hover"], ["on-crit", "down-ink"],
  // Active segment / tab thumb: only fg (label) and fg-2 (count pill) sit on it — fg-3 is 4.28:1 in dark, so
  // ds/segmented.tsx never uses fg-3 inside the active segment.
  ["fg", "seg-active"], ["fg-2", "seg-active"],
  ["tip-fg", "tip"], ["tip-2", "tip"],
];
const MARKS: [string, string][] = [
  ...["healthy-mark", "degraded-mark", "down-mark"].flatMap((m) => [[m, "card"], [m, "sheet"]] as [string, string][]),
  ...[1, 2, 3, 4, 5, 6].map((i) => [`chart-${i}`, "card"] as [string, string]),
  ["primary", "card"],
  // Focus ring (2 px outline) against the surfaces it sits on.
  ["ring", "bg"], ["ring", "sheet"], ["ring", "card"],
  // StatusChip draws Stopped and Unknown shapes in stopped-mark (unknown-mark is decorative only, < 3:1).
  ["stopped-mark", "card"], ["stopped-mark", "sheet"],
];

/** Spec §3.3: slot order is fixed (hue follows the entity, never the rank). */
const PALETTE = {
  light: ["#1a7cf0", "#e8690c", "#0f9e86", "#8a3ff0", "#b88700", "#d6428e"],
  dark: ["#3a8ff5", "#d9692a", "#1a9c86", "#9b6bf0", "#b8890f", "#d65592"],
};
const SEQ = {
  light: ["#ebf4ff", "#cfe3fd", "#a6cbfa", "#74adf5", "#3f8cef", "#1a7cf0", "#0f5fc2", "#0a4590"],
  dark: ["#162236", "#1b3254", "#214577", "#2a5c9e", "#3a78cc", "#5aa6ff", "#8cc1ff", "#bfdcff"],
};

describe.each([["light", false], ["dark", true]] as const)("tokens (%s)", (name, dark) => {
  const t = theme(dark);
  it.each(TEXT)("text %s on %s ≥ 4.5:1", (a, b) => {
    expect(t[a], a).toMatch(/^#[0-9a-f]{6}$/); expect(t[b], b).toMatch(/^#[0-9a-f]{6}$/);
    expect(contrast(t[a]!, t[b]!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(MARKS)("mark %s on %s ≥ 3:1", (a, b) => {
    expect(contrast(t[a]!, t[b]!)).toBeGreaterThanOrEqual(3);
  });
  it("categorical palette: six slots in the fixed order", () => {
    expect([1, 2, 3, 4, 5, 6].map((i) => t[`chart-${i}`])).toEqual(PALETTE[name]);
  });
  it("sequential ramp: eight steps, slot-1 blue, light → dark", () => {
    const seq = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => t[`chart-seq-${i}`]);
    expect(seq).toEqual(SEQ[name]);
    const l = seq.map((h) => lum(h!));
    // Magnitude reads as contrast against the card: monotonic in the theme's direction.
    for (let i = 1; i < l.length; i++) expect(dark ? l[i]! > l[i - 1]! : l[i]! < l[i - 1]!).toBe(true);
  });
  it("brand: navy (light) / white (dark) letters, amber sun in both; amber nowhere else; primary is navy in light", () => {
    expect(t["brand-ink"]).toBe(dark ? "#ffffff" : "#0d1530");
    expect(t["brand-sun"]).toBe("#ffa928");
    expect(Object.keys(t).filter((k) => t[k] === "#ffa928")).toEqual(["brand-sun"]);
    if (!dark) expect([t.primary, t["primary-ink"], t["primary-soft"]]).toEqual(["#0d1530", "#0d1530", "#eff2fa"]);
  });
  it("surfaces step: bg ≠ sheet ≠ tray, card distinct from tray", () => {
    expect(new Set([t.bg, t.sheet, t.tray]).size).toBe(3);
    expect(t.card).not.toBe(t.tray);
  });
});

describe("token aliases", () => {
  it("shadcn names used by vendored ui/ map onto v3 tokens", () => {
    const r = decls(":root");
    expect(r).toMatchObject({
      muted: "var(--tray)", accent: "var(--tray)", popover: "var(--raised)",
    });
  });
  it("dark overrides only raw values, never the aliases", () => {
    const d = decls(".dark");
    expect(Object.values(d).filter((v) => v.startsWith("var("))).toEqual([]);
  });
});
