import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../styles/base.css"), "utf8");
const block = (name: string) => {
  const i = css.indexOf(name);
  if (i < 0) return "";
  let depth = 0, j = css.indexOf("{", i);
  const start = j;
  for (; j < css.length; j++) { if (css[j] === "{") depth++; if (css[j] === "}" && --depth === 0) break; }
  return css.slice(start, j + 1);
};

describe("motion utilities", () => {
  it.each(["@keyframes pop", "@keyframes row-new", "@keyframes swap"])("%s animates only transform / opacity / background-color", (k) => {
    const b = block(k);
    expect(b).not.toBe("");
    const props = [...b.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(props.every((p) => ["transform", "opacity", "background-color"].includes(p ?? ""))).toBe(true);
  });
  it.each(["@utility animate-pop", "@utility animate-row-new", "@utility animate-swap", "@utility transition-sidebar"])("%s has a reduced-motion branch", (u) => {
    expect(block(u)).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
  it("tokens only: utilities use var(--dur-*) and var(--ease-*)", () => {
    for (const u of ["@utility animate-pop", "@utility animate-row-new", "@utility animate-swap", "@utility transition-sidebar"]) {
      expect(block(u)).not.toMatch(/\d+ms|\d*\.\d+s\b/);
    }
  });
  it("sonner toasts keep their positioning transform under reduced motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n    *, *::before"));
    const media = reduced.slice(0, reduced.indexOf("\n  }\n") + 4);
    // sonner positions stacked and expanded toasts with transform: var(--y), and ships its own reduced-motion rule.
    expect(media).not.toMatch(/data-sonner/);
  });
  it("native disclosures animate block-size and opacity, with an opacity-only reduced branch", () => {
    expect(css).toMatch(/:root\s*\{\s*interpolate-size:\s*allow-keywords/);
    const closed = block("details::details-content");
    expect(closed).toMatch(/transition:[^;]*block-size var\(--dur-enter\) var\(--ease-out\)[^;]*opacity var\(--dur-enter\)/);
    expect(closed).not.toMatch(/\d+ms|\d*\.\d+s\b/);
    expect(block("details[open]::details-content")).toMatch(/block-size:\s*auto/);
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) { details::details-content"));
    expect(reduced.split("\n")[0]).toMatch(/transition:\s*opacity var\(--dur-instant\) linear/);
    expect(reduced.split("\n")[0]).not.toMatch(/block-size/);
  });
  it("the /ds reduced preview scope sets the same overrides as the reduced media block", () => {
    const media = block("@media (prefers-reduced-motion: reduce) {\n    *, *::before");
    const body = (selector: string, from: string) => {
      const at = from.indexOf(selector);
      expect(at).toBeGreaterThanOrEqual(0);
      return from.slice(from.indexOf("{", at) + 1, from.indexOf("}", at)).trim();
    };
    const SCOPE = '[data-motion-preview="reduced"]';
    const universal = body("*, *::before, *::after {", media);
    const vars = body("* { --tw-enter-scale", media);
    expect(body(`${SCOPE} *, ${SCOPE} *::before, ${SCOPE} *::after {`, css)).toBe(universal);
    expect(body(`${SCOPE} * { --tw-enter-scale`, css)).toBe(vars);
    // the declared custom properties and the animation / transition duration lines
    expect([...vars.matchAll(/(--[a-z-]+):\s*([^;]+)/g)].map((m) => `${m[1]}=${m[2]}`)).toHaveLength(6);
    expect(universal).toMatch(/animation-duration:\s*var\(--dur-instant\) !important/);
    expect(universal).toMatch(/transition-duration:\s*var\(--dur-instant\) !important/);
  });
  it("the preview mirrors every other reduced branch: disclosure, shimmer, card lift, utilities", () => {
    const SCOPE = '[data-motion-preview="reduced"]';
    const real = css.match(/@media \(prefers-reduced-motion: reduce\) \{ details::details-content \{([^}]*)\} \}/)?.[1]?.trim();
    const preview = css.match(/\[data-motion-preview="reduced"\] details::details-content \{([^}]*)\}/)?.[1]?.trim();
    expect(real).toBe("transition: opacity var(--dur-instant) linear;");
    expect(preview).toBe(real);
    expect(block("@utility skeleton-shimmer")).toMatch(/&::after \{ display: none; \}/);
    expect(css).toContain(`${SCOPE} .skeleton-shimmer::after { display: none !important; }`);
    expect(block("@utility card-lift")).toMatch(/&:hover, &:active \{ transform: none; \}/);
    expect(css).toContain(`${SCOPE} .card-lift:hover, ${SCOPE} .card-lift:active { transform: none !important; }`);
    // utilities whose reduced branch is a 100 ms fade, or none
    const fade = css.match(/\[data-motion-preview="reduced"\] :is\(([^)]*)\) \{ animation: fade-in var\(--dur-instant\) linear both !important; \}/)?.[1] ?? "";
    expect(fade).not.toBe("");
    for (const u of ["animate-page-enter", "animate-enter", "animate-reveal-in", "animate-pop", "animate-swap", "animate-shell-sheet"]) {
      expect(block(`@utility ${u}`)).toMatch(/reduce\) \{ animation: fade-in var\(--dur-instant\) linear both; \}/);
      expect(fade).toContain(`.${u}`);
    }
    expect(block("@utility animate-row-new")).toMatch(/reduce\) \{ animation: none; \}/);
    // DataTable applies it as motion-safe:animate-row-new, so the preview mirrors both spellings
    expect(css).toContain(`${SCOPE} :is(.animate-row-new, .motion-safe\\:animate-row-new) { animation: none !important; }`);
    expect(block("@utility transition-sidebar")).toMatch(/reduce\) \{ transition: none; \}/);
    expect(css).toContain(`${SCOPE} .transition-sidebar { transition: none !important; }`);
    expect(block("@utility indicator-move")).toMatch(/reduce\) \{ transition: opacity var\(--dur-instant\) linear; \}/);
    expect(css).toContain(`${SCOPE} .indicator-move { transition: opacity var(--dur-instant) linear !important; }`);
    expect(css).toContain(`${SCOPE} .stagger-children > * { animation: fade-in var(--dur-instant) linear both !important; }`);
  });
});
