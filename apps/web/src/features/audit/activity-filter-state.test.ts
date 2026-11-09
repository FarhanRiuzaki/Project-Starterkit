import { expect, it } from "vitest";
import { EXACT_FILTER_FIELDS, exactFilterClearPatch, exactFilterSummary } from "./activity-filter-state";
it("one actor and one target summary preserve absent/empty/opaque values and clear only deliberately changed identities", () => {
  const values = exactFilterSummary(new URLSearchParams("actorId=&targetType=user"));
  expect(EXACT_FILTER_FIELDS[0]!.format!(values.exactActor!)).toBe("Empty value");
  expect(EXACT_FILTER_FIELDS[1]!.format!(values.exactTarget!)).toBe("user · Missing ID");
  expect(exactFilterClearPatch(values, values)).toEqual({});
  expect(exactFilterClearPatch({ ...values, exactTarget: "" }, values)).toEqual({ targetType: "", targetId: "" });
  expect(exactFilterClearPatch({ ...values, exactActor: "" }, values)).toEqual({ actorId: "" });
  const opaque = exactFilterSummary(new URLSearchParams({ targetType: " Legacy ", targetId: "\nA " }));
  expect(EXACT_FILTER_FIELDS[1]!.format!(opaque.exactTarget!)).toBe('" Legacy " · "\\nA "');
});
