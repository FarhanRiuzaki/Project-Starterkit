import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NumberTween } from "./number-tween";
import { Reveal } from "./reveal";
import { Stagger, StaggerItem } from "./stagger";

/**
 * Server markup of the motion primitives: what a viewer gets before (or without) JavaScript and the lazy motion
 * chunk. Nothing may start hidden in an inline style; enters are CSS keyframes that run on their own.
 */
const HIDDEN = /opacity:\s*0|visibility:\s*hidden/;
const fmt = (v: number) => `${Math.round(v).toLocaleString("en-GB")} req`;

describe("NumberTween markup", () => {
  it("visible text is aria-hidden; screen readers get the final value only", () => {
    const html = renderToStaticMarkup(h(NumberTween, { value: 1284, format: fmt }));
    expect(html).toBe('<span><span aria-hidden="true">1,284 req</span><span class="sr-only">1,284 req</span></span>');
  });
  it("with `from`, the first frame shows `from` but the accessible value is already the target", () => {
    const html = renderToStaticMarkup(h(NumberTween, { value: 40, from: 0, format: fmt }));
    expect(html).toContain('<span aria-hidden="true">0 req</span>');
    expect(html).toContain('<span class="sr-only">40 req</span>');
  });
});

describe("Reveal markup", () => {
  const sk = h("p", null, "skeleton");
  const body = h("p", null, "content");
  it("loading: the skeleton holds the place, hidden for the first 150 ms (no flash on a fast load), no aria-busy yet", () => {
    const html = renderToStaticMarkup(h(Reveal, { loading: true, skeleton: sk, children: body }));
    expect(html).not.toContain("aria-busy");
    expect(html).toContain('<div aria-hidden="true" data-reveal="skeleton" class="min-w-0 invisible"><p>skeleton</p></div>');
    expect(html).not.toContain("content");
  });
  it("ready on first render: content visible with no animation and no skeleton", () => {
    const html = renderToStaticMarkup(h(Reveal, { loading: false, skeleton: sk, children: body }));
    expect(html).toContain('<div data-reveal="content" class="min-w-0"><p>content</p></div>');
    expect(html).not.toContain("skeleton");
    expect(html).not.toContain("aria-busy");
    expect(html).not.toMatch(HIDDEN);
  });
});

describe("Stagger markup", () => {
  it("items carry the CSS enter and a capped 35 ms step delay; nothing hidden inline", () => {
    const html = renderToStaticMarkup(h(Stagger, { as: "ul", label: "Cards",
      children: [0, 1, 9].map((i) => h(StaggerItem, { key: i, index: i, as: "li", children: `item ${i}` })) }));
    expect(html).toContain('<ul aria-label="Cards">');
    expect(html).toContain('<li class="animate-enter" style="animation-delay:0s">item 0</li>');
    expect(html).toContain('style="animation-delay:0.035s"');
    expect(html).toContain('style="animation-delay:0.245s">item 9');
    expect(html).not.toMatch(HIDDEN);
  });
});

describe("CSS enters (base.css)", () => {
  const G = readFileSync(path.resolve(import.meta.dirname, "../styles/base.css"), "utf8");
  const block = (name: string) => G.slice(G.indexOf(`@utility ${name} {`), G.indexOf("\n}", G.indexOf(`@utility ${name} {`)));
  it("enter = fade + rise over --dur-enter; reveal in 220 ms, out 150 ms", () => {
    expect(block("animate-enter")).toContain("animation: page-enter var(--dur-enter) var(--ease-out) both;");
    expect(block("animate-reveal-in")).toContain("animation: fade-in var(--dur-enter) var(--ease-out) both;");
    expect(block("animate-reveal-out")).toContain("animation: fade-out var(--dur-fast) var(--ease-in) forwards;");
  });
  it("reduced motion: every enter is opacity only, 100 ms, no delay", () => {
    for (const u of ["animate-enter", "animate-reveal-in", "stagger-children"]) {
      expect(block(u)).toMatch(/prefers-reduced-motion: reduce\)[^}]*fade-in var\(--dur-instant\) linear both/);
    }
    expect(G).toMatch(/@keyframes fade-out \{ to \{ opacity: 0; \} \}/);
  });
  it("global reduced-motion rule shortens to 100 ms instead of 1 ms (spec §7.6)", () => {
    expect(G).not.toContain("animation-duration: 1ms");
    expect(G).toMatch(/prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: var\(--dur-instant\) !important;/);
  });
});
