import { describe, expect, it } from "vitest";
import { parsePalette, paletteCookie } from "./palette";

describe("palette preference", () => {
  it("accepts only approved palettes and falls back to current", () => {
    expect(parsePalette("mocha")).toBe("mocha");
    expect(parsePalette("espresso")).toBe("espresso");
    expect(parsePalette("dark")).toBe("current");
    expect(parsePalette(undefined)).toBe("current");
  });
  it("persists independently from density and light/dark", () => {
    expect(paletteCookie("onyx", true)).toBe("sk_palette=onyx; Path=/; Max-Age=31536000; SameSite=Strict; Secure");
  });
});
