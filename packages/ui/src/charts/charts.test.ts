import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartLegend } from "./chart-frame";
import { legendItems, seriesColor } from "./chart-theme";
import { DistributionBar } from "./distribution-bar";

const DIR = import.meta.dirname;
const read = (f: string) => readFileSync(path.join(DIR, f), "utf8");

describe("ChartLegend", () => {
  const item = (label: string) => ({ label, color: "var(--chart-1)" });
  it("renders nothing for 0 or 1 series", () => {
    expect(renderToStaticMarkup(createElement(ChartLegend, { items: [] }))).toBe("");
    expect(renderToStaticMarkup(createElement(ChartLegend, { items: [item("Allowed")] }))).toBe("");
  });
  it("renders one named key per series from 2 series", () => {
    const html = renderToStaticMarkup(createElement(ChartLegend, { items: [item("Allowed"), item("Denied")] }));
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain("Allowed");
    expect(html).toContain("Denied");
  });
  it("dashed series get a dashed stroke swatch, not a dot", () => {
    const html = renderToStaticMarkup(createElement(ChartLegend, { items: [item("Actual"), { ...item("Forecast"), dashed: true }] }));
    expect(html.match(/border-dashed/g)).toHaveLength(1);
  });
});

describe("legendItems (Panel-header legend, spec §6.1)", () => {
  it("uses the same colour as the chart: fixed slot, else position; Other neutral", () => {
    expect(legendItems([{ label: "glm-5", slot: 2 }, { label: "qwen" }])).toEqual([
      { label: "glm-5", color: "var(--chart-3)", striped: false, dashed: false },
      { label: "qwen", color: "var(--chart-2)", striped: false, dashed: false },
    ]);
    expect(seriesColor("Other", 0)).toBe("var(--fg-3)");
  });
  it("keeps striped / dashed keys", () => {
    expect(legendItems([{ label: "Connected" }, { label: "Idle", striped: true }, { label: "Forecast", dashed: true }]).map((x) => [x.striped, x.dashed]))
      .toEqual([[false, false], [true, false], [false, true]]);
  });
  it("folds like the chart: more than six series → five + Other", () => {
    const items = legendItems(Array.from({ length: 8 }, (_, i) => ({ label: `m${i}`, slot: i })));
    expect(items.map((x) => x.label)).toEqual(["m0", "m1", "m2", "m3", "m4", "Other"]);
    expect(items.at(-1)!.color).toBe("var(--fg-3)");
  });
});

describe("DistributionBar layouts (spec §6.5)", () => {
  const parts = [{ label: "glm-5", value: 60, slot: 0 }, { label: "qwen", value: 30, slot: 1 }, { label: "kimi", value: 10, slot: 2 }];
  const render = (p: Record<string, unknown>) => renderToStaticMarkup(createElement(DistributionBar, { label: "Share", parts, format: String, ...p }));
  it("cards (default): a 2-column tray of legend cards", () => {
    expect(render({})).toContain("grid-template-columns:repeat(2, minmax(0, 1fr))");
  });
  it("list: one full-width row per part, stacked; fill stretches the rows to the chart height beside it", () => {
    const out = render({ layout: "list", fill: true });
    expect(out).toMatch(/<ul class="[^"]*flex-col[^"]*" style="min-height:220px">/);
    expect(out.match(/<li /g)).toHaveLength(3);
    expect(render({ layout: "list" })).not.toContain("min-height:220px");
  });
  it("empty copy follows the caller", () => {
    const empty = renderToStaticMarkup(createElement(DistributionBar, { label: "Share", parts: [], format: String, empty: { title: "No requests in this time range", description: "x" } }));
    expect(empty).toContain("No requests in this time range");
  });
});

/** Static (non-type, non-dynamic) relative imports of a charts module. */
function staticImports(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/^\s*(import|export)\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gm)) out.push(m[3]!);
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) out.push(m[1]!);
  return out;
}

describe("charts barrel keeps recharts lazy", () => {
  it("nothing statically reachable from index.ts imports recharts", () => {
    const seen = new Set<string>();
    const offenders: string[] = [];
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const spec of staticImports(read(file))) {
        if (spec === "recharts" || spec.startsWith("recharts/")) offenders.push(file);
        if (!spec.startsWith("./")) continue;
        const next = [".ts", ".tsx"].map((ext) => spec.slice(2) + ext).find((f) => existsSync(path.join(DIR, f)));
        if (next) visit(next);
      }
    };
    visit("index.ts");
    expect(offenders).toEqual([]);
    // The recharts charts are reached only through next/dynamic in lazy.tsx.
    expect(seen.has("bar-chart.tsx")).toBe(false);
    expect(seen.has("time-series-chart.tsx")).toBe(false);
    expect(read("lazy.tsx")).toMatch(/dynamic\(\(\) => import\("\.\/time-series-chart"\)/);
  });
});

describe("chart motion tokens", () => {
  it("the line draw uses --dur-draw (400 ms) from tokens.css", () => {
    expect(read("charts.css")).toContain("animation: chart-draw var(--dur-draw) var(--ease-out) both;");
    expect(readFileSync(path.join(DIR, "../styles/tokens.css"), "utf8")).toMatch(/--dur-draw: 400ms;/);
  });
});
