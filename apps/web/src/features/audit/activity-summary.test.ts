import { expect, it } from "vitest";
import { activitySummary } from "./activity-summary";
it("uses recorded identities, safe unknown types and honest fallback without creating routes", () => {
  expect(activitySummary({ actor: { id: "u1", name: "Ada" }, target: { type: "project", id: "p1", label: "Archive" } })).toBe("By Ada · Project: Archive");
  expect(activitySummary({ actor: { id: "u1", name: "" }, target: { type: "legacy", id: "p1", label: "" } })).toBe("By u1 · legacy: p1");
  expect(activitySummary({ actor: { id: "", name: "" }, target: { type: "", id: "", label: "" } })).toBe("By Unknown user · Unknown target");
  expect(activitySummary({ actor: { id: "u1", name: "<script>" }, target: { type: "__proto__", id: "p1", label: "<b>" } })).toBe("By <script> · __proto__: <b>");
});
