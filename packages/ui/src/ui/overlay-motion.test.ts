import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OVERLAY_MOTION } from "../motion/tokens";

const src = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf8");
/** Duration tokens in `s` set for the open state and the closed state, in source order. */
const tokens = (s: string, state: "open" | "closed") => [...s.matchAll(new RegExp(`data-\\[state=${state}\\]:duration-\\(--dur-([a-z]+)\\)`, "g"))].map((m) => m[1]);

describe("overlays use the duration tokens OVERLAY_MOTION names (and the /ds inventory prints)", () => {
  it("menus and popovers", () => {
    for (const f of ["dropdown-menu-impl.tsx", "popover-impl.tsx"]) {
      const open = tokens(src(f), "open"), closed = tokens(src(f), "closed");
      expect(open.length, f).toBeGreaterThan(0);
      expect(new Set(open), f).toEqual(new Set([OVERLAY_MOTION.menu.open]));
      expect(new Set(closed), f).toEqual(new Set([OVERLAY_MOTION.menu.close]));
    }
  });
  it("dialog: scrim, then panel", () => {
    const s = src("dialog.tsx");
    expect(tokens(s, "open")).toEqual([OVERLAY_MOTION.scrim.open, OVERLAY_MOTION.dialog.open]);
    expect(tokens(s, "closed")).toEqual([OVERLAY_MOTION.scrim.close, OVERLAY_MOTION.dialog.close]);
  });
  it("drawer: scrim, then panel", () => {
    const s = src("drawer-impl.tsx");
    expect(tokens(s, "open")).toEqual([OVERLAY_MOTION.scrim.open, OVERLAY_MOTION.drawer.open]);
    expect(tokens(s, "closed")).toEqual([OVERLAY_MOTION.scrim.close, OVERLAY_MOTION.drawer.close]);
  });
  it("tooltip", () => {
    const s = src("tooltip.tsx");
    expect(s).toContain(`animate-in fade-in-0 duration-(--dur-${OVERLAY_MOTION.tooltip.open})`);
    expect(tokens(s, "closed")).toEqual([OVERLAY_MOTION.tooltip.close]);
  });
});
