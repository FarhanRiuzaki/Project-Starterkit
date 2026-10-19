import { describe, expect, it } from "vitest";
import { nextRole } from "./role-search";

const NAMES = ["Admin", "Administrators", "Viewer"];

describe("RoleSearch: what the typed text commits", () => {
  it("typing alone never applies a role, even one that matches a prefix of a longer name", () => {
    expect(nextRole("Admin", "", NAMES, false)).toBeNull();
    expect(nextRole("Administrators", "", NAMES, false)).toBeNull();
  });
  it("Enter or a pick from the list applies the role (case-insensitive, stored as the role's own name)", () => {
    expect(nextRole("admin", "", NAMES, true)).toBe("Admin");
    expect(nextRole("Viewer", "Viewer", NAMES, true)).toBeNull(); // already applied
    expect(nextRole("Nope", "", NAMES, true)).toBeNull();
  });
  it("clearing the text or typing away from the applied role removes the filter", () => {
    expect(nextRole("", "Admin", NAMES, false)).toBe("");
    expect(nextRole("Admi", "Admin", NAMES, false)).toBe("");
    expect(nextRole("Nope", "Admin", NAMES, true)).toBe("");
    expect(nextRole("Admin", "Admin", NAMES, false)).toBeNull();
  });
});
