import { describe, expect, it } from "vitest";
import { nextIndex } from "./roving";

describe("nextIndex", () => {
  it("panah maju/mundur dengan wrap", () => {
    expect(nextIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextIndex(2, "ArrowRight", 3)).toBe(0);
    expect(nextIndex(2, "ArrowDown", 3)).toBe(0);
    expect(nextIndex(1, "ArrowLeft", 3)).toBe(0);
    expect(nextIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(nextIndex(0, "ArrowUp", 3)).toBe(2);
  });
  it("Home/End", () => {
    expect(nextIndex(1, "Home", 3)).toBe(0);
    expect(nextIndex(1, "End", 3)).toBe(2);
  });
  it("tombol lain dan count 0 menghasilkan null", () => {
    expect(nextIndex(0, "a", 3)).toBeNull();
    expect(nextIndex(0, "ArrowRight", 0)).toBeNull();
  });
});
