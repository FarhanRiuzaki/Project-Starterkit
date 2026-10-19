import { describe, expect, it, vi } from "vitest";

const merge = vi.hoisted(() => ({ calls: 0 }));
vi.mock("cn", async (load) => {
  const real = await load<typeof import("cn")>();
  return { ...real, twMerge: (s: string) => { merge.calls++; return real.twMerge(s); } };
});

const { cn } = await import("./cn");

describe("cn memo (render hot path)", () => {
  it("merges a class string once; later calls with the same classes are a lookup", () => {
    merge.calls = 0;
    expect(cn("h-7 text-label", "text-fg", false)).toBe("h-7 text-label text-fg");
    expect(cn("h-7 text-label", "text-fg", null)).toBe("h-7 text-label text-fg");
    expect(cn("h-7 text-label text-fg")).toBe("h-7 text-label text-fg");
    expect(merge.calls).toBe(1);
  });
  it("is bounded: past the cap it starts over instead of growing", () => {
    for (let i = 0; i < 5_000; i++) cn(`w-${i}`);
    merge.calls = 0;
    cn("w-1");
    cn("w-4999");
    expect(merge.calls).toBeLessThanOrEqual(2);
  });
});
