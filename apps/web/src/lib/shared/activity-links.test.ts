import { expect, it } from "vitest";
import { activityCloseHref, activityEntryHref, activityHistoryHref, activityInvestigationHref, activityOpenHref } from "./activity-links";
it("copy links are canonical entry-only internal paths while open/close retain the exact list context", () => {
  expect(activityEntryHref("ABC")).toBe("/audit/activity?entry=abc");
  expect(activityEntryHref("//evil.example")).toBe("/audit/activity?entry=%2F%2Fevil.example");
  const opened = activityOpenHref("page=4&user=A&action=user.update&action=user.create&refresh=30", "ABC");
  expect(opened).toContain("page=4");
  expect(activityCloseHref(opened.split("?")[1]!)).toBe("/audit/activity?page=4&user=A&action=user.update&action=user.create&refresh=30");
});
it("explicit investigation is one navigation preserving user AND every other filter, resetting only page/entry", () => {
  const href = activityInvestigationHref("entry=id&page=4&user=Other&action=user.update&range=90d&sort=actor&pageSize=25&refresh=30", { actorId: "actor" });
  const query = new URL(href, "http://local").searchParams;
  expect(query.get("user")).toBe("Other");
  expect(query.get("actorId")).toBe("actor");
  expect(query.has("entry")).toBe(false); expect(query.has("page")).toBe(false);
  for (const key of ["action", "range", "sort", "pageSize", "refresh"]) expect(query.has(key)).toBe(true);
  const target = new URL(activityInvestigationHref(query.toString(), { targetType: " Legacy ", targetId: " \nId, A " }), "http://local").searchParams;
  expect(target.get("targetId")).toBe(" \nId, A ");
  expect(target.get("actorId")).toBe("actor");
});
it("history targets the record, uses explicit 90 days, and inherits no source-page filters", () => {
  expect(activityHistoryHref("user", "target", "ABC")).toBe("/audit/activity?range=90d&targetType=user&targetId=target&entry=abc");
  expect(activityHistoryHref("project", "p")).toBe("/audit/activity?range=90d&targetType=project&targetId=p");
});
