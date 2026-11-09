import { expect, it } from "vitest";
import { withoutActivityEntry } from "./views";
it("removes repeated encoded entry keys only for Activity, preserving exact query bytes elsewhere", () => {
  const query = "targetType=Legacy&targetId=A%20b%2fC&entry=id&%65ntry=other&actorId=actor";
  expect(withoutActivityEntry("/audit/activity", query)).toBe("targetType=Legacy&targetId=A%20b%2fC&actorId=actor");
  for (const path of ["/users", "/audit/auth", "/projects"]) expect(withoutActivityEntry(path, query)).toBe(query);
  expect(withoutActivityEntry("/audit/activity", "entry")).toBe("");
  expect(withoutActivityEntry("/audit/activity", "targetId=entry%3Did&entryish=x")).toBe("targetId=entry%3Did&entryish=x");
});
