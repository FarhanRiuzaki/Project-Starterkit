import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Icon, type IconData } from "./icon";

/** Two elements in the Hugeicons shape: a stroked path and a filled dot (no strokeWidth of its own). */
const DATA: IconData = [
  ["path", { d: "M4 12H20", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.5", key: "0" }],
  ["circle", { cx: "12", cy: "12", r: "1", fill: "currentColor", key: "1" }],
];
const html = (props: Partial<Parameters<typeof Icon>[0]> = {}) => renderToStaticMarkup(h(Icon, { icon: DATA, ...props }));

describe("Icon (Hugeicons renderer)", () => {
  it("renders a 24-grid svg, 16 px by default, decorative (aria-hidden, not focusable), no fill on the root", () => {
    const out = html();
    expect(out).toMatch(/^<svg [^>]*viewBox="0 0 24 24"/);
    expect(out).toMatch(/^<svg [^>]*width="16" height="16"/);
    expect(out).toMatch(/^<svg [^>]*fill="none"/);
    expect(out).toMatch(/^<svg [^>]*aria-hidden="true"/);
    expect(out).toMatch(/^<svg [^>]*focusable="false"/);
    expect(out).not.toMatch(/role="img"/);
  });
  it("draws every element with currentColor and stroke width 1.5 (spec §3.6)", () => {
    const out = html();
    expect(out).toContain('<path d="M4 12H20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path>');
    expect(out).toContain('<circle cx="12" cy="12" r="1" fill="currentColor"></circle>');
    expect(out).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
  it("size, strokeWidth and className apply; strokeWidth only touches stroked elements", () => {
    const out = html({ size: 20, strokeWidth: 2, className: "size-5 text-fg-3" });
    expect(out).toMatch(/^<svg [^>]*width="20" height="20"/);
    expect(out).toMatch(/^<svg [^>]*class="size-5 text-fg-3"/);
    expect(out).toContain('stroke-width="2"');
    expect(out).toContain('<circle cx="12" cy="12" r="1" fill="currentColor"></circle>');
  });
  it("an aria-label makes it a labelled image instead of decorative", () => {
    const out = html({ "aria-label": "Warning" });
    expect(out).toMatch(/role="img"/);
    expect(out).toMatch(/aria-label="Warning"/);
    expect(out).not.toMatch(/aria-hidden/);
  });
  it("builds an icon's children once per stroke width and reuses them on every render (render hot path)", () => {
    type El = { props: { children: unknown } };
    const kids = (p: Partial<Parameters<typeof Icon>[0]> = {}) => (Icon({ icon: DATA, ...p }) as unknown as El).props.children;
    expect(kids()).toBe(kids({ className: "size-5" }));
    expect(kids({ strokeWidth: 2 })).toBe(kids({ strokeWidth: 2 }));
    expect(kids({ strokeWidth: 2 })).not.toBe(kids());
  });
});
