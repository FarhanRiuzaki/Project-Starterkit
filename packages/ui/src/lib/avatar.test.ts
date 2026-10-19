import { describe, expect, it } from "vitest";
import { avatarSlot, initials } from "./avatar";

describe("avatar", () => {
  it("initials: first letters of the first two words, upper case", () => {
    expect(initials("Rina Wulandari")).toBe("RW");
    expect(initials("  sari  handayani kusuma ")).toBe("SH");
    expect(initials("Admin")).toBe("A");
    expect(initials("")).toBe("?");
  });
  it("slot: deterministic 1–6 from the name", () => {
    expect(avatarSlot("Rina Wulandari")).toBe(avatarSlot("Rina Wulandari"));
    const slots = new Set(["Rina", "Dimas", "Sari", "Bagus", "Andi", "Wulan", "Hendra", "Putri", "Yoga", "Maya"].map(avatarSlot));
    for (const s of slots) expect(s >= 1 && s <= 6).toBe(true);
    expect(slots.size).toBeGreaterThan(3);
  });
});
