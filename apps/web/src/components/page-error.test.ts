import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MainError from "@/app/(main)/error";
import RootError from "@/app/error";
import { isChunkError } from "./page-error";

const chunk = Object.assign(new Error("Loading chunk 812 failed. (error: /_next/static/chunks/812.js)"), { name: "ChunkLoadError" });
const render = (C: typeof MainError, error: Error & { digest?: string }) => renderToStaticMarkup(h(C, { error, reset: () => {} }));

describe("isChunkError", () => {
  it("webpack, Turbopack and browser import() failures; not other errors", () => {
    expect(isChunkError(chunk)).toBe(true);
    expect(isChunkError(new Error("Failed to load chunk /_next/static/chunks/a1b2.js from module 42"))).toBe(true);
    expect(isChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js"))).toBe(true);
    expect(isChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkError(new Error("Cannot read properties of undefined (reading 'name')"))).toBe(false);
    expect(isChunkError("Loading chunk 1 failed")).toBe(false);
  });
});

describe("route error boundaries", () => {
  it("(main): inside the shell, a render error offers Try again; the message itself is never shown", () => {
    const html = render(MainError, Object.assign(new Error("secret internals"), { digest: "abc123" }));
    expect(html).toContain("Page unavailable");
    expect(html).toContain("Couldn&#x27;t show this page");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Reload page");
    expect(html).toContain("Reference abc123");
    expect(html).not.toContain("secret internals");
  });
  it("(main): a chunk that failed to load offers Reload page instead (a retry would ask for the same missing file)", () => {
    const html = render(MainError, chunk);
    expect(html).toContain("This page needs a reload");
    expect(html).toContain("Reload page");
    expect(html).not.toContain("Try again");
    expect(html).not.toContain("812.js");
  });
  it("root: the same body in a card outside the shell", () => {
    expect(render(RootError, new Error("x"))).toContain("Couldn&#x27;t show this page");
  });
});
