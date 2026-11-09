import { expect, it } from "vitest";
import { ActivityQuery } from "./audit";

const actorId = "01234567-89ab-4000-8000-0123456789ab";
it("preserves exact actor and target filters without changing opaque identities", () => {
  const query = ActivityQuery.parse({ actorId, targetType: "legacy.type", targetId: "A, b/路?=12" });
  expect(query).toMatchObject({ actorId, targetType: "legacy.type", targetId: "A, b/路?=12" });
});
it("rejects malformed exact filters before a route can read a session", () => {
  for (const query of [{ actorId: "not-a-uuid" }, { actorId: "" }, { targetType: "user" }, { targetId: actorId }, { targetType: "", targetId: "a" }, { targetType: "user", targetId: "" }]) expect(ActivityQuery.safeParse(query).success).toBe(false);
  expect(ActivityQuery.safeParse({ actorId }).success).toBe(true);
  expect(ActivityQuery.safeParse({}).success).toBe(true);
});

it("bounds opaque IDs without trimming controls or accepting PostgreSQL NUL", () => {
  expect(ActivityQuery.safeParse({ actorId: actorId.toUpperCase(), targetType: "t".repeat(64), targetId: "x".repeat(512) }).success).toBe(true);
  for (const query of [{ targetType: "t".repeat(65), targetId: "x" }, { targetType: "user", targetId: "x".repeat(513) }, { targetType: "u\0ser", targetId: "x" }, { targetType: "user", targetId: "x\0y" }]) expect(ActivityQuery.safeParse(query).success).toBe(false);
  expect(ActivityQuery.parse({ targetType: " user ", targetId: " \nopaque\t " })).toMatchObject({ targetType: " user ", targetId: " \nopaque\t " });
});
