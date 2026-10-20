import { describe, expect, it } from "vitest";
import { thumbOf } from "./scroll-area";

describe("ScrollArea thumb", () => {
  it("none when the content fits", () => {
    expect(thumbOf(0, 300, 300)).toBeNull();
    expect(thumbOf(0, 301, 300)).toBeNull(); // a sub-pixel overflow is not a scroll
  });
  it("its height is the visible share, at least 24 px; it travels from top to bottom with the scroll", () => {
    expect(thumbOf(0, 600, 300)).toEqual({ top: 0, height: 150 });
    expect(thumbOf(300, 600, 300)).toEqual({ top: 150, height: 150 });
    expect(thumbOf(0, 30_000, 300)).toEqual({ top: 0, height: 24 });
    expect(thumbOf(29_700, 30_000, 300)).toEqual({ top: 276, height: 24 });
  });
});
