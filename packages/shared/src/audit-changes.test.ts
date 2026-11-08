import { describe, expect, it } from "vitest";
import { activityChangeText, presentActivityChanges as present } from "./audit-changes";
import { MASK } from "./audit";

const value = (key: string, label: string, text: string) => ({ key, label, kind: "value", value: text });
describe("activity presentation from recorded evidence", () => {
  it("create and delete show only their recorded side, with precise deletion labels", () => {
    expect(present("user.create", null, { name: "Ada", roles: ["Viewer"], invited: true })).toEqual({ heading: "Initial values", rows: [value("name", "Name", "Ada"), value("roles", "Roles", "Viewer"), value("invited", "Invitation requested", "Yes")] });
    expect(present("role.delete", { name: "Reviewers", permissions: ["user.view"] }, null)).toEqual({ heading: "Values before deletion", rows: [value("name", "Name", "Reviewers"), value("permissions", "Permissions before deletion", "user.view")] });
  });
  it("distinguishes absent, null, empty text, empty arrays, false and empty objects", () => {
    expect(present("user.update", { description: null, name: "", roles: [], isActive: false, nested: {} }, { description: "", name: null, isActive: true, nested: {} }).rows).toEqual([
      { key: "description", label: "Description", kind: "change", before: "Not set", after: "Empty text" },
      { key: "name", label: "Name", kind: "change", before: "Empty text", after: "Not set" },
      { key: "roles", label: "Roles", kind: "change", before: "None", after: "Not recorded" },
      { key: "isActive", label: "Status", kind: "change", before: "Inactive", after: "Active" },
    ]);
    expect(present("user.create", null, { nested: {}, isLdap: false }).rows).toEqual([value("nested", "nested", "{}"), value("isLdap", "Directory sign-in", "No")]);
  });
  it("ignores reorder and duplicates in known full sets; computes exact ordinal added/removed only with both valid sides", () => {
    expect(present("user.assign_role", { roles: ["b", "a", "a"] }, { roles: ["a", "b"] }).rows).toEqual([]);
    expect(present("user.assign_role", { roles: ["b", "a"] }, { roles: ["C", "c", "C"] }).rows).toEqual([value("roles:added", "Roles added", "C, c"), value("roles:removed", "Roles removed", "a, b")]);
    expect(present("role.update", { permissions: ["b"] }, { permissions: ["a"] }).rows).toEqual([value("permissions:added", "Permissions added", "a"), value("permissions:removed", "Permissions removed", "b")]);
    expect(present("user.assign_role", {}, { roles: ["a"] }).rows).toEqual([{ key: "roles", label: "Roles", kind: "change", before: "Not recorded", after: "a" }]);
    expect(present("user.assign_role", { roles: ["a"] }, { roles: [1] }).rows[0]).toMatchObject({ kind: "change", after: "[1]" });
  });
  it("interprets only valid known explicit deltas, preserving name changes and empty delta evidence", () => {
    expect(present("role.update", { name: "Old" }, { name: "New", added: ["b", "a", "a"], removed: ["c"] }).rows).toEqual([
      { key: "name", label: "Name", kind: "change", before: "Old", after: "New" }, value("permissions:added", "Permissions added", "a, b"), value("permissions:removed", "Permissions removed", "c"),
    ]);
    expect(present("role.create", null, { name: "Role", added: [], removed: [] }).rows).toContainEqual(value("permissions:added", "Permissions added", "None"));
    expect(present("permission.create", null, { created: ["b", "a"] }).rows).toEqual([value("permissions:added", "Permissions added", "a, b")]);
    for (const payload of [{ added: ["a"] }, { added: ["a"], removed: ["a"] }, { added: [1], removed: [] }]) {
      const result = present("role.update", {}, payload);
      expect(result.rows.some(row => row.label === "Permissions added")).toBe(false);
      expect(result.rows.some(row => row.label === "added")).toBe(true);
    }
  });
  it("unknown actions/arrays and scalar snapshots retain safe recorded values", () => {
    expect(present("legacy.event", { roles: ["a", "b"] }, { roles: ["b", "a"] }).rows).toEqual([{ key: "roles", label: "Roles", kind: "change", before: '["a","b"]', after: '["b","a"]' }]);
    expect(present("legacy.event", 12, ["b", "a"]).rows).toEqual([{ key: "snapshot", label: "Recorded values", kind: "change", before: "12", after: '["b","a"]' }]);
    expect(present("legacy.event", null, { added: ["b", "a"], token: "hidden", nested: { recoveryCodes: ["hidden"] } }).rows).toContainEqual({ key: "nested", label: "nested", kind: "change", before: "Not recorded", after: `{"recoveryCodes":"${MASK}"}` });
  });
  it("compares masked evidence, never claims changed secret content or mutates source", () => {
    const before = { password: "first", nested: { token: "first" } }, after = { password: "second", nested: { token: "second" } };
    expect(present("me.password", before, after).rows).toEqual([]);
    expect(after.password).toBe("second");
    expect(activityChangeText("legacy.event", null, after)).not.toContain("second");
    expect(activityChangeText("legacy.event", null, after)).toContain(MASK);
  });
  it("keeps array item boundaries and rejects empty members as known deltas", () => {
    const result = present("legacy.event", { values: ["a, b"] }, { values: ["a", "b"] });
    expect(result.rows).toEqual([{ key: "values", label: "values", kind: "change", before: '["a, b"]', after: '["a","b"]' }]);
    expect(present("role.create", null, { added: [""], removed: [] }).rows.some(row => row.label === "Permissions added")).toBe(false);
    expect(present("permission.create", null, { created: [" "] }).rows.some(row => row.label === "Permissions added")).toBe(false);
    expect(present("user.create", null, { roles: ["Reviewers, editors"] }).rows).toContainEqual(value("roles", "Roles", '["Reviewers, editors"]'));
  });
  it("retains nested null versus masked credential evidence, without inventing content changes", () => {
    expect(present("user.update", { nested: { token: null } }, { nested: { token: MASK } }).rows).toEqual([
      { key: "nested", label: "nested", kind: "change", before: '{"token":null}', after: `{"token":"${MASK}"}` },
    ]);
    expect(present("user.update", { nested: { token: MASK } }, { nested: { token: null } }).rows).toEqual([
      { key: "nested", label: "nested", kind: "change", before: `{"token":"${MASK}"}`, after: '{"token":null}' },
    ]);
    expect(present("user.update", { nested: { token: MASK } }, { nested: { token: MASK } }).rows).toEqual([]);
  });
  it("formats valid recorded timestamps and leaves invalid dates as recorded text", () => {
    const result = present("project.create", null, { createdAt: "2026-11-08T00:00:00Z", updatedAt: "2026-02-30T00:00:00Z" });
    expect(result.rows[0]).toMatchObject({ label: "Created", value: "8 Nov 2026, 07:00 WIB" });
    expect(result.rows[1]).toMatchObject({ label: "Updated", value: "2026-02-30T00:00:00Z" });
  });
  it("separates unavailable snapshots from recorded unchanged values, consistently in CSV", () => {
    expect(present("me.password", null, null).message).toBe("Field values were not recorded for this event.");
    expect(present("user.update", {}, {}).message).toBe("No field changes are shown for the recorded values.");
    expect(activityChangeText("user.update", { name: "A" }, { name: "B" })).toBe("Name: A → B");
    expect(activityChangeText("permission.create", null, { created: ["user.new"] })).toBe("Permissions added: user.new");
  });
});
