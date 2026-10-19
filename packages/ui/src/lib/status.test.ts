import { describe, expect, it } from "vitest";
import { HEALTH, worstHealth } from "./status";

describe("status", () => {
  it("worstHealth picks the highest severity; empty is unknown", () => {
    expect(worstHealth(["healthy", "degraded", "stopped"])).toBe("degraded");
    expect(worstHealth(["healthy", "down", "degraded"])).toBe("down");
    expect(worstHealth(["stopped", "unknown"])).toBe("unknown");
    expect(worstHealth([])).toBe("unknown");
  });
  it("every state has a one-sentence label and description", () => {
    for (const h of Object.values(HEALTH)) expect(h.description).toMatch(/^[A-Z].*\.$/);
  });
});
