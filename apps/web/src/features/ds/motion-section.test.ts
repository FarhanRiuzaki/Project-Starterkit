import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DUR, EASE, SPRING_FLIP, SPRING_INDICATOR, SPRING_SOFT } from "@starterkit/ui/motion";
import { TooltipProvider } from "@starterkit/ui/ui/tooltip";
import { fmtEase, fmtMs, fmtSpring, MotionSection, PATTERNS, RULES, RULES_ONLY } from "./motion-section";

const html = renderToStaticMarkup(h(TooltipProvider, null, h(MotionSection)));

describe("MotionSection tokens", () => {
  it("renders one row per key of DUR and EASE, formatted from the constants", () => {
    for (const k of Object.keys(DUR)) expect(html).toContain(`data-token="--dur-${k}"`);
    for (const k of Object.keys(EASE)) expect(html).toContain(`data-token="--ease-${k}"`);
    expect(fmtMs(DUR.pop)).toBe("180 ms");
    expect(html).toContain("180 ms");
    expect(html).toContain("1200 ms");
    expect(html).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(fmtEase(EASE.out)).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
  });
  it("renders the three springs", () => {
    expect(html).toContain("SPRING_INDICATOR");
    expect(html).toContain("SPRING_SOFT");
    expect(html).toContain(fmtSpring(SPRING_FLIP));
    expect(fmtSpring(SPRING_SOFT)).toContain("stiffness 380 · damping 36");
    expect(html).toContain("stiffness 380 · damping 36");
    expect(html).toContain(fmtSpring(SPRING_INDICATOR));
  });
});

describe("MotionSection patterns and rules", () => {
  it("has the 14 patterns, each with a Replay button and a data-run counter starting at 0", () => {
    expect(PATTERNS).toHaveLength(14);
    for (const p of PATTERNS) {
      expect(html).toContain(`data-demo="${p.id}" data-run="0"`);
      expect(html).toMatch(new RegExp(`Replay ${p.name}<`));
    }
  });
  it("rules table has the four columns and one row per pattern plus the rules-only rows", () => {
    for (const c of ["Pattern", "Layer", "Duration", "Reduced motion"]) expect(html).toMatch(new RegExp(`<th scope="col"[^>]*>${c}</th>`));
    expect(html.match(/data-pattern="/g)).toHaveLength(RULES.length);
    for (const id of ["tab-reveal", "card-lift", "page-swap", "card-reorder", "skeleton-shimmer", "chart"]) expect(RULES_ONLY.map((r) => r.id)).toContain(id);
    expect(RULES_ONLY.every((r) => !html.includes(`data-demo="${r.id}"`))).toBe(true);
    expect(PATTERNS.every((p) => p.layer === "CSS" || p.layer === "Motion")).toBe(true);
  });
  it("starts with the reduced-motion preview off", () => {
    expect(html).not.toContain("data-motion-preview=");
    expect(html).toContain("Preview reduced motion");
    expect(html).toContain("Applies to the inline demos. Dialog, menu and toast render outside this section");
  });
});
