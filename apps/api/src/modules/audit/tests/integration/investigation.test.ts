import { beforeEach, describe, expect, it } from "bun:test";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { ActivityDto } from "@starterkit/shared/contracts/audit";
import type { Page } from "@starterkit/shared/contracts/common";
import { call, resetData, signIn } from "../../../../../test/helpers/app";
import { holdTx } from "../../../../../test/helpers/db";
import { db } from "../../../../kernel/db";
import { rolePermissions, roles } from "../../../rbac";
import { users } from "../../../users";
import { activity } from "../../schema";
import { snapshot } from "../../rules";

beforeEach(resetData);
const get = (id: string, token?: string) => call("GET", `/v1/audit/activity/${id}`, { token });
const list = (query: string, token?: string) => call("GET", `/v1/audit/activity?${query}`, { token });
const userId = async (name: string) => (await db.select({ id: users.id }).from(users).where(eq(users.username, name)))[0]!.id;
const revokeAudit = () => db.delete(rolePermissions).where(and(eq(rolePermissions.permission, "audit.view"), inArray(rolePermissions.roleId, db.select({ id: roles.id }).from(roles).where(eq(roles.name, "Viewer")))));
async function fixture(overrides: Partial<typeof activity.$inferInsert> = {}) {
  const row = { id: Bun.randomUUIDv7(), at: new Date("2020-01-01T00:00:00Z"), actorId: Bun.randomUUIDv7(), actorName: "Recorded deleted actor", action: "user.update", targetType: "user", targetId: Bun.randomUUIDv7(), targetLabel: "Recorded deleted target", before: { name: "Before", nested: { token: "test-only-canary" } }, after: { name: "After" }, ...overrides };
  await db.insert(activity).values({ ...row, before: snapshot(row.before), after: snapshot(row.after) });
  return row;
}
const data = async (response: Response) => { expect(response.status).toBe(200); return await response.json() as Page<ActivityDto>; };

describe("activity entry lookup", () => {
  it("loads immutable recorded identities and masked snapshots by ID outside the list range without requiring a live actor or target", async () => {
    const row = await fixture();
    const token = await signIn("viewer");
    const filtered = await data(await list("from=2026-11-01&to=2026-11-02&action=project.delete", token));
    expect(filtered.items.some(entry => entry.id === row.id)).toBe(false);
    const response = await get(row.id, token);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const entry = await response.json() as ActivityDto;
    expect(entry).toEqual({ id: row.id, at: row.at.toISOString(), actor: { id: row.actorId ?? "", name: row.actorName }, action: row.action, target: { type: row.targetType, id: row.targetId, label: row.targetLabel }, before: { name: "Before", nested: { token: "••••" } }, after: { name: "After" } });
    expect(JSON.stringify(entry)).not.toContain("test-only-canary");
    expect((await get(row.id.toUpperCase(), token)).status).toBe(200);
    const nullActor = await fixture({ actorId: null, before: null, after: null });
    expect(await (await get(nullActor.id, token)).json()).toMatchObject({ actor: { id: "", name: nullActor.actorName }, before: null, after: null });
  });

  it("requires audit.view before ID validation or any activity read, including a different actor's entry", async () => {
    const row = await fixture();
    expect((await get(row.id)).status).toBe(401);
    const token = await signIn("viewer");
    expect((await get(row.id, token)).status).toBe(200); // audit.view is global, not an ownership shortcut
    await revokeAudit();
    const lock = await holdTx(tx => tx.execute(sql`lock table ${activity} in access exclusive mode`));
    try {
      for (const id of [row.id, "not-a-uuid"]) {
        const response = await Promise.race([get(id, token), Bun.sleep(1000).then(() => null)]);
        expect(response?.status).toBe(403); // would block behind the table lock if the handler read activity
      }
      expect((await get("not-a-uuid")).status).toBe(401);
    } finally { await lock.rollback(); }
  });

  it("rejects malformed IDs without querying activity; missing and purged entries are the same 404", async () => {
    const token = await signIn("viewer");
    const lock = await holdTx(tx => tx.execute(sql`lock table ${activity} in access exclusive mode`));
    try {
      for (const id of ["invalid", `${Bun.randomUUIDv7()}suffix`, "%2F", "constructor"]) {
        const response = await Promise.race([get(id, token), Bun.sleep(1000).then(() => null)]);
        expect(response?.status).toBe(404);
      }
    } finally { await lock.rollback(); }
    const row = await fixture();
    const missing = await get(Bun.randomUUIDv7(), token);
    await db.delete(activity).where(eq(activity.id, row.id)); // simulate retention purge only in the isolated fixture
    const purged = await get(row.id, token);
    expect(missing.status).toBe(404);
    expect(purged.status).toBe(404);
    expect(await missing.json()).toEqual(await purged.json());
  });

  it("a permission removed from a live session applies on the next lookup", async () => {
    const row = await fixture(), token = await signIn("viewer");
    expect((await get(row.id, token)).status).toBe(200);
    await revokeAudit();
    const response = await get(row.id, token);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "forbidden" } });
  });
});

describe("exact activity investigation filters", () => {
  it("combines exact actor/type/opaque ID with action, user and time using the same list/count/CSV predicate beyond page one", async () => {
    await db.delete(activity);
    const actorId = Bun.randomUUIDv7(), otherActor = Bun.randomUUIDv7(), targetId = "Literal, /路径?x=1%_";
    const now = Date.now();
    const matching = [];
    for (let index = 0; index < 32; index++) matching.push(await fixture({ actorId, actorName: "Investigation actor", targetType: "legacy.type", targetId, targetLabel: `Matched ${index}`, action: index % 2 ? "user.create" : "user.update", at: new Date(now - index * 1000) }));
    const base = { actorId, actorName: "Investigation actor", targetType: "legacy.type", targetId, at: new Date(now - 1000) };
    await fixture({ ...base, actorId: otherActor, targetLabel: "Wrong actor same name" });
    await fixture({ ...base, targetType: "Legacy.type", targetLabel: "Wrong type same ID" });
    await fixture({ ...base, targetId: `${targetId} `, targetLabel: "Wrong ID trailing space" });
    await fixture({ ...base, action: "role.update", targetLabel: "Wrong action" });
    await fixture({ ...base, at: new Date("2020-01-01T00:00:00Z"), targetLabel: "Wrong time" });
    const token = await signIn("viewer");
    const query = new URLSearchParams({ actorId: actorId.toUpperCase(), targetType: "legacy.type", targetId, user: "Investigation actor", start: "now-1h", end: "now" });
    query.append("action", "user.update"); query.append("action", "user.create");
    const first = await data(await list(query.toString(), token));
    expect(first.total).toBe(32);
    expect(first.items).toHaveLength(15);
    expect(first.items.map(entry => entry.id)).toEqual(matching.slice(0, 15).map(row => row.id));
    expect((await data(await list(`${query}&page=2`, token))).items.map(entry => entry.id)).toEqual(matching.slice(15, 30).map(row => row.id));
    const csv = await list(`${query}&format=csv`, token);
    expect(csv.status).toBe(200);
    const text = await csv.text();
    expect(text.trim().split("\r\n")).toHaveLength(33);
    for (let index = 0; index < 32; index++) expect(text).toContain(`Matched ${index}`);
    for (const wrong of ["Wrong actor", "Wrong type", "Wrong ID", "Wrong action", "Wrong time"]) expect(text).not.toContain(wrong);
    const other = await data(await list(new URLSearchParams({ actorId: otherActor }).toString(), token));
    expect(other.total).toBe(1);
  });

  it("preserves exact boundaries and first repeated scalar values; unknown target types and 512-character IDs remain queryable", async () => {
    await db.delete(activity);
    const actorId = Bun.randomUUIDv7(), targetId = ` \n${"x".repeat(508)} /`;
    expect(targetId.length).toBe(512);
    const row = await fixture({ actorId, targetType: "constructor", targetId });
    const token = await signIn("viewer");
    const query = new URLSearchParams({ actorId, targetType: "constructor", targetId });
    query.append("actorId", "invalid"); query.append("targetType", "other"); query.append("targetId", "other");
    expect((await data(await list(query.toString(), token))).items.map(entry => entry.id)).toEqual([row.id]);
    const trimmed = await data(await list(new URLSearchParams({ targetType: "constructor", targetId: targetId.trim() }).toString(), token));
    expect(trimmed.total).toBe(0);
    const long = await fixture({ targetId: "y".repeat(513) });
    expect((await get(long.id, token)).status).toBe(200); // URL filter cap never changes historical detail availability
  });

  for (const query of ["actorId=invalid", "actorId=", "actorId=invalid&actorId=00000000-0000-4000-8000-000000000000", "targetType=user", "targetId=one", "targetType=&targetId=one", "targetType=user&targetId=", "targetType=u%00ser&targetId=x", "targetType=user&targetId=x%00y", `targetType=${"t".repeat(65)}&targetId=x`, `targetType=user&targetId=${"i".repeat(513)}`]) it(`${query.slice(0, 80)} is 400 before the session is read`, async () => {
    const response = await list(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "bad_request" } });
  });
});

it("a user's brief history excludes records of another target type with the same text ID", async () => {
  await db.delete(activity);
  const id = await userId("viewer"), token = await signIn("admin");
  const right = await fixture({ targetType: "user", targetId: id });
  await fixture({ targetType: "project", targetId: id });
  const response = await call("GET", `/v1/users/${id}`, { token });
  expect(response.status).toBe(200);
  expect((await response.json() as { recentActivity: { id: string }[] }).recentActivity.map(row => row.id)).toEqual([right.id]);
});

it("exact investigation stays within the statement budget on 200k events using existing indexes", async () => {
  await db.delete(activity);
  const actorId = Bun.randomUUIDv7(), other = Bun.randomUUIDv7(), targetId = "shared historical target";
  await db.insert(activity).select(db.select({
    id: sql`gen_random_uuid()`.as("id"), at: sql`now() - g * interval '1 second'`.as("at"),
    actorId: sql`case when g % 100 = 0 then ${actorId}::uuid else ${other}::uuid end`.as("actorId"), actorName: sql`'Indexed actor'`.as("actorName"),
    action: sql`'user.update'`.as("action"), targetType: sql`case when g % 400 = 0 then 'project' else 'user' end`.as("targetType"),
    targetId: sql`case when g % 200 = 0 then ${targetId} else 'other target' end`.as("targetId"), targetLabel: sql`'Indexed target'`.as("targetLabel"),
    before: sql`null`.as("before"), after: sql`null`.as("after"),
  }).from(sql`generate_series(1, 200000) g`));
  await db.execute(sql`analyze ${activity}`);
  const token = await signIn("viewer");
  const query = new URLSearchParams({ actorId, targetType: "user", targetId, page: "1000", pageSize: "100" });
  const start = performance.now();
  const result = await data(await list(query.toString(), token));
  const ms = performance.now() - start;
  expect(result).toMatchObject({ total: 500, page: 1000, pageSize: 100, items: [] });
  expect(ms).toBeLessThan(2000);
  const read = db.select().from(activity).where(and(eq(activity.actorId, actorId), eq(activity.targetType, "user"), eq(activity.targetId, targetId))).orderBy(activity.at).limit(100);
  const explain = await db.execute(sql`explain (format json) ${read}`);
  const plan = JSON.stringify(explain);
  expect(plan).toMatch(/activity_(actor_at|target)/);
  console.log(`exact actor/target on 200k rows: ${Math.round(ms)} ms; existing actor/target index selected`);
});
