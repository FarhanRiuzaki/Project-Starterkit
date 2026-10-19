import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatTile } from "./stat-tile";

/** R6: a tile given `tween` renders the NumberTween structure (aria-hidden animated text + sr-only final value). */
describe("StatTile tween", () => {
  const fmt = (v: number) => `${Math.round(v)} req`;
  it("renders an aria-hidden span plus an sr-only span with the formatted final value", () => {
    const out = renderToStaticMarkup(h(StatTile, { label: "AI requests", value: "ignored", tween: { value: 42, format: fmt } }));
    expect(out).toContain('<span aria-hidden="true">42 req</span>');
    expect(out).toContain('<span class="sr-only">42 req</span>');
    expect(out).not.toContain("ignored");
  });
  it("without tween the plain value is shown and there is no sr-only duplicate", () => {
    const out = renderToStaticMarkup(h(StatTile, { label: "Days", value: "3 of 7" }));
    expect(out).toContain("3 of 7");
    expect(out).not.toContain("sr-only");
  });
});
