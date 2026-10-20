import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BRAND } from "@starterkit/shared/brand";
import { SunnyGoMark, SunnyGoWordmark } from ".";

/** The logo is the outline SVG from the brand kit: an image named BRAND.name, coloured only by the brand tokens. */
describe.each([["mark", SunnyGoMark, "0 8.76 57.3 57.3"], ["wordmark", SunnyGoWordmark, "0 20.9 201.4 39.85"]] as const)("SunnyGo %s", (_, Logo, viewBox) => {
  const out = renderToStaticMarkup(h(Logo, { className: "size-7" }));
  it("is one image named by BRAND, sized by className, with the kit's viewBox", () => {
    expect(out).toMatch(new RegExp(`^<svg [^>]*role="img"[^>]*aria-label="${BRAND.name}"`));
    expect(out).toContain(`viewBox="${viewBox}"`);
    expect(out).toContain('class="size-7"');
  });
  it("letters fill with --brand-ink, the sun with --brand-sun; no hex, no text, no stroke", () => {
    expect(out.match(/<path /g)).toHaveLength(2);
    expect(out).toContain('fill="var(--brand-ink)"');
    expect(out).toContain('fill="var(--brand-sun)"');
    expect(out).not.toMatch(/#[0-9a-f]{3,6}\b|<text|stroke/i);
  });
});
