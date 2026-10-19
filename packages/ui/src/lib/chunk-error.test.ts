import { describe, expect, it } from "vitest";
import { isChunkError } from "./chunk-error";

describe("isChunkError", () => {
  it("webpack, Turbopack and browser import() failures; not other errors", () => {
    expect(isChunkError(Object.assign(new Error("Loading chunk 812 failed."), { name: "ChunkLoadError" }))).toBe(true);
    expect(isChunkError(new Error("Failed to load chunk /_next/static/chunks/a1b2.js from module 42"))).toBe(true);
    expect(isChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js"))).toBe(true);
    expect(isChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkError(new Error("Cannot read properties of undefined (reading 'name')"))).toBe(false);
    expect(isChunkError("Loading chunk 1 failed")).toBe(false);
  });
});
