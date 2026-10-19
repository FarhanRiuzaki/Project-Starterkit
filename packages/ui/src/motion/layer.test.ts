import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { MotionLayer } from "./layer";
import { PageTransition } from "./page-transition";
import { SharedIndicator } from "./indicator";

const DIR = import.meta.dirname;
const SRC = path.resolve(DIR, "..");
const read = (p: string) => readFileSync(p, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("deferred Framer layer stays out of first-load JS", () => {
  it("framer-motion / motion are imported statically only by framer.tsx", () => {
    const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const statics = files.filter((f) => /from\s+["'](framer-motion|motion(\/[^"']*)?)["']/.test(strip(read(path.join(DIR, f)))));
    expect(statics).toEqual(["framer.tsx"]);
  });
  it("framer.tsx is reached only through a dynamic import() in layer.tsx", () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(d, e.name)] : []);
    const importers = walk(SRC).filter((f) => /["'](\.\/|@\/components\/motion\/)framer["']/.test(strip(read(f))));
    expect(importers.map((f) => path.relative(DIR, f))).toEqual(["layer.tsx"]);
    expect(strip(read(path.join(DIR, "layer.tsx")))).toMatch(/import\(\s*["']\.\/framer["']\s*\)/);
    expect(strip(read(path.join(DIR, "layer.tsx")))).not.toMatch(/^import[^;]*["']\.\/framer["']/m);
  });
});

describe("before the layer loads (server HTML, blocked chunk): CSS motion, nothing hidden", () => {
  it("MotionLayer renders its children unchanged; SharedIndicator renders nothing", () => {
    expect(renderToStaticMarkup(h(MotionLayer, null, h("p", null, "x"), h(SharedIndicator, { layoutId: "a" })))).toBe("<p>x</p>");
  });
  it("PageTransition keeps the CSS page enter", () => {
    expect(renderToStaticMarkup(h(PageTransition, null, "page"))).toBe('<div class="grid min-w-0 gap-section animate-page-enter">page</div>');
  });
  it("Tabs: the active trigger draws its own underline, no motion indicator", () => {
    const html = renderToStaticMarkup(h(Tabs, { defaultValue: "b" },
      h(TabsList, { "aria-label": "Sections" }, h(TabsTrigger, { value: "a" }, "A"), h(TabsTrigger, { value: "b" }, "B"))));
    expect(html).toContain("[&amp;_[role=tab][data-state=active]]:after:bg-fg");
    expect(html).toContain('data-state="active"');
    expect(html).not.toContain("motion-indicator");
  });
});
