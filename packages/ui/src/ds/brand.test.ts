import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Brand } from "./brand";

/** Brand is a layout slot: the app passes its logo nodes; the slot picks one by width. */
const mark = h("svg", { role: "img", "aria-label": "Acme", "data-logo": "mark" });
const wordmark = h("svg", { role: "img", "aria-label": "Acme", "data-logo": "wordmark" });

describe("Brand", () => {
  it("expanded (default) shows the wordmark only", () => {
    const out = renderToStaticMarkup(h(Brand, { mark, wordmark }));
    expect(out).toContain('data-logo="wordmark"');
    expect(out).not.toContain('data-logo="mark"');
  });
  it("collapsed shows the mark only", () => {
    const out = renderToStaticMarkup(h(Brand, { mark, wordmark, collapsed: true }));
    expect(out).toContain('data-logo="mark"');
    expect(out).not.toContain('data-logo="wordmark"');
  });
  it("adds no name text or monogram of its own; the logo keeps role img and its accessible name", () => {
    const out = renderToStaticMarkup(h(Brand, { mark, wordmark, className: "x" }));
    expect(out).toBe('<span class="inline-flex shrink-0 items-center x"><svg role="img" aria-label="Acme" data-logo="wordmark"></svg></span>');
  });
});
