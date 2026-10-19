import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent } from "./tabs";

describe("TabsContent", () => {
  it("the active panel reveals on mount (animate-reveal-in on the active state)", () => {
    const out = renderToStaticMarkup(h(Tabs, { defaultValue: "a" }, h(TabsContent, { value: "a" }, "A"), h(TabsContent, { value: "b" }, "B")));
    expect(out).toContain("data-[state=active]:animate-reveal-in");
    expect(out).toContain(">A<");
    expect(out).not.toContain(">B<");
  });
});
