import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChunkBoundary } from "./chunk-boundary";

/** The boundary after it caught `error` (server rendering has no error boundaries, so its state is set directly). */
const caught = (error: unknown) => {
  const b = new ChunkBoundary({ children: h("p", null, "chart") });
  b.state = ChunkBoundary.getDerivedStateFromError(error);
  return () => renderToStaticMarkup(b.render() as never);
};

describe("ChunkBoundary (lazy charts, LazyMount)", () => {
  it("no error: the children", () => {
    expect(renderToStaticMarkup(h(ChunkBoundary, null, h("p", null, "chart")))).toBe("<p>chart</p>");
  });
  it("a chunk that failed to load: only this part shows the error, with Reload page and no Try again", () => {
    const html = caught(Object.assign(new Error("Failed to load chunk /_next/static/chunks/x.js from module 1"), { name: "ChunkLoadError" }))();
    expect(html).toContain("Couldn&#x27;t load this part of the page");
    expect(html).toContain("Reload page");
    expect(html).not.toContain("Try again");
    expect(html).not.toContain("x.js");
  });
  it("any other error goes on up to the page's error boundary", () => {
    const err = new Error("render bug");
    expect(caught(err)).toThrow(err);
  });
});
