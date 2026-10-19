import { describe, expect, it } from "vitest";
import { isClipped } from "./overflow";

describe("isClipped", () => {
  it("terpotong bila scrollWidth > clientWidth", () => {
    expect(isClipped({ scrollWidth: 120, clientWidth: 100 })).toBe(true);
    expect(isClipped({ scrollWidth: 100, clientWidth: 100 })).toBe(false);
    expect(isClipped({ scrollWidth: 80, clientWidth: 100 })).toBe(false);
  });
});
