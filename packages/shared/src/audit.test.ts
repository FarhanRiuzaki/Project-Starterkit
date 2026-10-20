import { describe, expect, it } from "vitest";
import { MASK, actionLabel, changeText, diffFields, presetRange, rangeProblem } from "./audit";

describe("diffFields", () => {
  it("lists only the fields whose value changed, before-keys first", () => {
    expect(diffFields({ name: "A", email: "a@x", roles: ["Admin"] }, { name: "B", email: "a@x", roles: ["Admin", "Viewer"] })).toEqual([
      { field: "name", before: "A", after: "B" },
      { field: "roles", before: "Admin", after: "Admin, Viewer" },
    ]);
  });

  it("a create (no before) or delete (no after) shows every field against a dash", () => {
    expect(diffFields(null, { name: "A", isActive: true })).toEqual([
      { field: "name", before: "–", after: "A" }, { field: "isActive", before: "–", after: "Yes" },
    ]);
    expect(diffFields({ isActive: false }, null)).toEqual([{ field: "isActive", before: "No", after: "–" }]);
    expect(diffFields(null, null)).toEqual([]);
    expect(diffFields("x", 3)).toEqual([]);
  });

  it("masks any field named like a credential, at any depth, even when unchanged values differ", () => {
    const rows = diffFields(
      { password: "old-pass", apiToken: "t1", nested: { recoveryCode: "aaaa-1111", label: "x" } },
      { password: "new-pass", apiToken: "t2", nested: { recoveryCode: "bbbb-2222", label: "y" }, clientSecret: "s" },
    );
    expect(rows.map((r) => r.field)).toEqual(["password", "apiToken", "nested", "clientSecret"]);
    expect(rows.find((r) => r.field === "password")).toEqual({ field: "password", before: MASK, after: MASK });
    expect(rows.find((r) => r.field === "clientSecret")).toEqual({ field: "clientSecret", before: "–", after: MASK });
    expect(JSON.stringify(rows)).not.toMatch(/old-pass|new-pass|t1|t2|aaaa-1111|bbbb-2222|"s"/);
    expect(rows.find((r) => r.field === "nested")!.after).toContain('"label":"y"');
  });

  it("changeText is one line per change, for the CSV", () => {
    expect(changeText({ name: "A" }, { name: "B", token: "x" })).toBe(`name: A → B; token: – → ${MASK}`);
    expect(changeText(null, null)).toBe("");
  });
});

describe("rangeProblem", () => {
  it("both dates or neither; real calendar dates; to on or after from; 92 days inclusive at most", () => {
    expect(rangeProblem(undefined, undefined)).toBeNull();
    expect(rangeProblem("2026-01-01", undefined)).toBe("pair");
    expect(rangeProblem(undefined, "2026-01-01")).toBe("pair");
    expect(rangeProblem("2026-10-10", "2026-10-09")).toBe("order");
    expect(rangeProblem("2026-10-10", "2026-10-10")).toBeNull();
    expect(rangeProblem("2026-01-01", "2026-04-02")).toBeNull(); // 92 days
    expect(rangeProblem("2026-01-01", "2026-04-03")).toBe("span"); // 93 days
  });
});

describe("presetRange", () => {
  it("the last N calendar days in the app time zone, ending today", () => {
    // 2026-10-19 17:30 UTC is already 20 Oct in UTC+7.
    const now = Date.UTC(2026, 9, 19, 17, 30);
    expect(presetRange("7d", now)).toEqual({ from: "2026-10-14", to: "2026-10-20" });
    expect(presetRange("30d", now)).toEqual({ from: "2026-09-21", to: "2026-10-20" });
    expect(presetRange("90d", now)).toEqual({ from: "2026-07-23", to: "2026-10-20" });
  });
});

describe("actionLabel", () => {
  it("names known actions and shows unknown ones as recorded", () => {
    expect(actionLabel("user.create")).toBe("User created");
    expect(actionLabel("thing.happened")).toBe("thing.happened");
  });
});
