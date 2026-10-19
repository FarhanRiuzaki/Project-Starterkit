import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn with the console type scale", () => {
  it("keeps a type-scale size next to a text colour (plain tailwind-merge drops the size)", () => {
    expect(cn("text-label text-fg-3")).toBe("text-label text-fg-3");
    expect(cn("h-7 text-label whitespace-nowrap", "text-fg")).toBe("h-7 text-label whitespace-nowrap text-fg");
    expect(cn("text-body-sm", "text-down-ink")).toBe("text-body-sm text-down-ink");
  });
  it("two sizes still merge: the later one wins; two colours too", () => {
    expect(cn("text-body text-fg", "text-body-sm")).toBe("text-fg text-body-sm");
    expect(cn("text-fg-2", "text-fg")).toBe("text-fg");
    expect(cn("text-title-1", "text-display")).toBe("text-display");
  });
  it("variants are kept per variant", () => {
    expect(cn("text-body group-data-[variant=line]/tabs-list:text-body", "md:text-label text-fg-2")).toBe("text-body group-data-[variant=line]/tabs-list:text-body md:text-label text-fg-2");
    expect(cn("md:text-label", "md:text-caption")).toBe("md:text-caption");
  });
  it("leading-*: a later type-scale size resets an earlier leading (TW4 text-* sets line-height); a later leading wins", () => {
    expect(cn("leading-6 text-label")).toBe("text-label");
    expect(cn("leading-tight", "text-body-sm")).toBe("text-body-sm");
    expect(cn("text-label leading-6")).toBe("text-label leading-6");
    expect(cn("text-body-sm", "leading-tight text-fg-3")).toBe("text-body-sm leading-tight text-fg-3");
  });
  it("clsx inputs and ordinary merges behave as before", () => {
    expect(cn("px-2", false, null, undefined, { "px-4": true }, ["rounded-md"])).toBe("px-4 rounded-md");
    expect(cn("text-mono font-mono text-fg")).toBe("text-mono font-mono text-fg");
  });
  it("memoised per class string: repeats return the same result, and a full cache never changes an answer", () => {
    const first = cn("h-7 text-label", "text-fg");
    expect(cn("h-7 text-label", "text-fg")).toBe(first);
    for (let i = 0; i < 2_000; i++) expect(cn(`px-${i % 7}`, `px-${i}`)).toBe(`px-${i}`);
    expect(cn("h-7 text-label", "text-fg")).toBe("h-7 text-label text-fg");
    expect(cn("text-body text-fg", "text-body-sm")).toBe("text-fg text-body-sm");
  });
});
