import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "../ui/tooltip";
import { Panel } from "./panel";
import { StatusLegend, StatusLegendList } from "./status-legend";

const items = [{ health: "healthy", label: "Active" }, { health: "stopped", label: "Disabled", description: "Turned off by an admin." }] as const;
const wrap = (el: ReturnType<typeof h>) => renderToStaticMarkup(h(TooltipProvider, null, el));

describe("StatusLegend", () => {
  it("an icon-only button labelled Status legend plus the labels it explains, opening a dialog popover", () => {
    const out = wrap(h(StatusLegend, { items }));
    expect(out).toContain('aria-label="Status legend: Active, Disabled"');
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toMatch(/^<button[^>]*size-7[^>]*><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg><\/button>$/);
    expect(out.replace(/<[^>]*>/g, "")).toBe("");
  });
  it("the legend is one vertical list, with the label from props and an optional description", () => {
    const out = renderToStaticMarkup(h(StatusLegendList, { items }));
    expect(out).not.toMatch(/grid-cols-/);
    expect(out).toContain("Active");
    expect(out).toContain("Turned off by an admin.");
  });
});

describe("Panel legend", () => {
  it("puts the legend button at the end of the card header, after the actions", () => {
    const out = wrap(h(Panel, { title: "Users", legend: items, actions: h("button", { type: "button" }, "Export"), children: "rows" }));
    const header = out.slice(out.indexOf("<header"), out.indexOf("</header>"));
    expect(header).toMatch(/Export<\/button>.*aria-label="Status legend: Active, Disabled"/);
    expect(out.indexOf("Status legend")).toBeLessThan(out.indexOf("rows"));
  });
  it("renders a header for a legend alone, and no legend button without `legend`", () => {
    expect(wrap(h(Panel, { legend: items, children: "rows" }))).toMatch(/<header[^>]*>.*Status legend.*<\/header>/);
    expect(wrap(h(Panel, { title: "Users", children: "rows" }))).not.toContain("Status legend");
  });
});
