import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "../ui/tooltip";
import { StatusLegend, StatusLegendList } from "./status-legend";

const items = [{ health: "healthy", label: "Active" }, { health: "stopped", label: "Disabled", description: "Turned off by an admin." }] as const;
const html = (variant?: "popover" | "icon") => renderToStaticMarkup(h(TooltipProvider, null, h(StatusLegend, { items, variant })));

describe("StatusLegend", () => {
  it("icon: an icon-only button named after the labels it explains, no visible text", () => {
    const out = html("icon");
    expect(out).toContain('aria-label="Status guide: Active, Disabled"');
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toMatch(/<button[^>]*size-7[^>]*><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg><\/button>$/);
    expect(out.replace(/<[^>]*>/g, "")).toBe("");
  });
  it("popover (default): the labelled secondary button", () => {
    const out = html();
    expect(out).toContain("Status guide</button>");
    expect(out).not.toContain("aria-label");
  });
  it("the legend is one vertical list, with the label from props and an optional description", () => {
    const out = renderToStaticMarkup(h(StatusLegendList, { items }));
    expect(out).not.toMatch(/grid-cols-/);
    expect(out).toContain("Active");
    expect(out).toContain("Turned off by an admin.");
  });
});
