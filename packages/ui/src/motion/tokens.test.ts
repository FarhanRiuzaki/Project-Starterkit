import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DUR, EASE, SHIFT_ENTER, SPRING_SOFT, STAGGER, staggerDelay, tweenDuration } from "./tokens";

const CSS = readFileSync(path.resolve(import.meta.dirname, "../styles/tokens.css"), "utf8");
const cssVar = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(CSS)?.[1]?.trim();

describe("motion tokens mirror tokens.css (spec §7.1)", () => {
  it.each(Object.entries(DUR))("--dur-%s = %s s", (k, s) => {
    expect(cssVar(`dur-${k}`)).toBe(`${Math.round(s * 1000)}ms`);
  });
  it.each(Object.entries(EASE))("--ease-%s", (k, pts) => {
    expect(cssVar(`ease-${k}`)).toBe(`cubic-bezier(${pts.join(", ")})`);
  });
  it("shift and stagger step", () => {
    expect(cssVar("shift-enter")).toBe(`${SHIFT_ENTER}px`);
    expect(cssVar("stagger")).toBe(`${Math.round(STAGGER.step * 1000)}ms`);
  });
  it("spec values", () => {
    expect(DUR).toEqual({ instant: 0.1, fast: 0.15, pop: 0.18, enter: 0.22, page: 0.26, exit: 0.16, slow: 0.28, tween: 0.6, flash: 1.2 });
    expect(STAGGER).toEqual({ step: 0.035, max: 8 });
    // exits are always faster than enters
    expect(DUR.exit).toBeLessThan(DUR.page);
    expect(DUR.fast).toBeLessThan(DUR.enter);
  });
});

describe("pop / flash / SPRING_SOFT", () => {
  it("pop and flash durations exist on both sides", () => {
    expect(DUR.pop).toBe(0.18);
    expect(DUR.flash).toBe(1.2);
    expect(CSS).toMatch(/--dur-pop:\s*180ms/);
    expect(CSS).toMatch(/--dur-flash:\s*1200ms/);
  });
  it("SPRING_SOFT is near-critically damped (damping ratio ≥ 0.92, no visible overshoot)", () => {
    const { stiffness, damping, mass } = SPRING_SOFT;
    expect(damping / (2 * Math.sqrt(stiffness * mass))).toBeGreaterThanOrEqual(0.92); // critically damped within 8%
  });
});

describe("staggerDelay", () => {
  it("35 ms per item, the first 8 staggered, the rest appear with the 8th", () => {
    expect([0, 1, 2, 7, 8, 20].map((i) => staggerDelay(i))).toEqual([0, 0.035, 0.07, 0.245, 0.245, 0.245]);
  });
  it("total stagger stays within 280 ms", () => {
    expect(staggerDelay(1000) + STAGGER.step).toBeLessThanOrEqual(0.28 + 1e-9);
  });
  it("reduced motion or a bad index → no delay", () => {
    expect(staggerDelay(5, true)).toBe(0);
    expect(staggerDelay(-3)).toBe(0);
    expect(staggerDelay(Number.NaN)).toBe(0);
  });
});

describe("tweenDuration (spec §7.4)", () => {
  it("min(0.6, 0.3 + |Δ|/total · 0.3)", () => {
    expect(tweenDuration(0, 100)).toBeCloseTo(0.6);
    expect(tweenDuration(50, 100)).toBeCloseTo(0.45);
    expect(tweenDuration(90, 100, 1000)).toBeCloseTo(0.303);
    expect(tweenDuration(0, 5000, 1000)).toBe(0.6);
  });
  it("no change, non-finite values or reduced motion → 0 (swap instantly)", () => {
    expect(tweenDuration(42, 42)).toBe(0);
    expect(tweenDuration(0, Number.NaN)).toBe(0);
    expect(tweenDuration(Number.POSITIVE_INFINITY, 3)).toBe(0);
    expect(tweenDuration(0, 100, undefined, true)).toBe(0);
  });
});

describe("page enter (CSS, base.css)", () => {
  const G = readFileSync(path.resolve(import.meta.dirname, "../styles/base.css"), "utf8");
  const util = G.slice(G.indexOf("@utility animate-page-enter"), G.indexOf("}\n}", G.indexOf("@utility animate-page-enter")) + 3);
  it("fade + --shift-enter rise over --dur-page with --ease-out", () => {
    expect(G).toMatch(/@keyframes page-enter \{ from \{ opacity: 0; transform: translateY\(var\(--shift-enter\)\); \} \}/);
    expect(util).toContain("animation: page-enter var(--dur-page) var(--ease-out) both;");
  });
  it("Tailwind ease-* utilities use the same curves as tokens.css", () => {
    for (const [k, pts] of Object.entries(EASE)) expect(G).toContain(`--ease-${k}: cubic-bezier(${pts.join(", ")});`);
  });
  it("reduced motion: opacity only", () => {
    expect(util).toMatch(/prefers-reduced-motion: reduce\) \{ animation: fade-in var\(--dur-instant\) linear both; \}/);
    expect(G).toMatch(/@keyframes fade-in \{ from \{ opacity: 0; \} \}/);
  });
});
