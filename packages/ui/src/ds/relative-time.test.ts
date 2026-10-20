import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatDateTime, formatRelative } from "../lib/format";
import { TooltipProvider } from "../ui/tooltip";
import { RelativeTime } from "./relative-time";

const AT = Date.UTC(2026, 9, 16, 7, 5);
const html = (props: Parameters<typeof RelativeTime>[0]) => renderToStaticMarkup(h(TooltipProvider, null, h(RelativeTime, props)));

/** The absolute time is a hover tooltip; a touch screen has no hover, so the server HTML carries it and CSS shows it (spec "Target sentuh"). */
describe("RelativeTime on touch", () => {
  it("renders the relative and the short absolute time in the server HTML; the absolute line shows only under a coarse pointer, in fg-3", () => {
    const out = html({ at: AT });
    expect(out).toContain(`>${formatRelative(AT)}</time>`);
    const line = new RegExp(`<span class="([^"]*)">${formatDateTime(AT)}</span>`).exec(out)?.[1]?.split(" ") ?? [];
    expect(line).toEqual(expect.arrayContaining(["hidden", "pointer-coarse:block", "text-caption", "text-fg-3"]));
  });

  it("touchDate={false} leaves it out (a caller that already prints the absolute time)", () => {
    expect(html({ at: AT, touchDate: false })).not.toContain(formatDateTime(AT));
  });

  it("no time: the dash only", () => {
    expect(html({ at: null })).toBe('<span class="text-fg-3">–</span>');
  });
});
