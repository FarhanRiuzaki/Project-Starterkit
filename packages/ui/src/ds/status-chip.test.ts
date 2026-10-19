import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusChip } from "./status-chip";

/** R5: the crossfade plays only after the value changes; a first render (page load) is the baseline. */
describe("StatusChip change animation", () => {
  it("first render has no data-changed and no reveal animation", () => {
    const out = renderToStaticMarkup(h(StatusChip, { health: "healthy", label: "Healthy" }));
    expect(out).not.toContain("data-changed");
    expect(out).not.toContain("animate-reveal-in");
  });
});
