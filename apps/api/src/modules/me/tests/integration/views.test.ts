// /v1/me/views: the signed-in user's saved list views.
import { beforeEach, describe, expect, it } from "bun:test";
import type { Page } from "@starterkit/shared/contracts/common";
import { MAX_SAVED_VIEWS, type SavedViewDto } from "@starterkit/shared/contracts/me";
import { call, resetData, signIn } from "../../../../../test/helpers/app";
import { eq } from "drizzle-orm";
import { savedViews } from "../../schema";
import { users } from "../../../users";
import { db } from "../../../../kernel/db";
import { activity } from "../../../audit";

const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;
const save = (token: string, body: unknown) => call("POST", "/v1/me/views", { token, body });
const list = async (token: string, path = "/users") => (await (await call("GET", `/v1/me/views?path=${encodeURIComponent(path)}`, { token })).json()) as Page<SavedViewDto>;

beforeEach(resetData);

describe("/v1/me/views", () => {
  it("keeps complete selection views through 4096 characters and refuses 4097 without truncation", async () => {
    const token = await signIn("admin");
    const query = `role=${"a".repeat(4091)}`;
    const response = await save(token, { path: "/users", name: "Long view", query });
    expect(response.status).toBe(200);
    expect(((await response.json()) as SavedViewDto).query).toBe(query);
    expect((await save(token, { path: "/users", name: "Over limit", query: `${query}a` })).status).toBe(400);
  });
  it("saves a view, lists it by name for its page only, and records no activity entry", async () => {
    const t = await signIn("admin");
    const before = await db.$count(activity);
    const r = await save(t, { path: "/users", name: "Inactive admins", query: "role=Admin&status=inactive" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ path: "/users", name: "Inactive admins", query: "role=Admin&status=inactive" });
    await save(t, { path: "/users", name: "a first", query: "" });
    await save(t, { path: "/roles", name: "Other page", query: "" });
    expect((await list(t)).items.map((v) => v.name)).toEqual(["a first", "Inactive admins"]);
    expect(await db.$count(activity)).toBe(before);
  });

  it("another user's views are neither listed nor deletable (404)", async () => {
    const admin = await signIn("admin");
    const v = (await (await save(admin, { path: "/users", name: "Mine", query: "" })).json()) as SavedViewDto;
    const viewer = await signIn("viewer");
    expect((await list(viewer)).items).toEqual([]);
    const r = await call("DELETE", `/v1/me/views/${v.id}`, { token: viewer });
    expect(r.status).toBe(404);
    expect((await list(admin)).items).toHaveLength(1);
    expect((await call("DELETE", `/v1/me/views/${v.id}`, { token: admin })).status).toBe(200);
    expect((await list(admin)).items).toEqual([]);
    expect((await call("DELETE", "/v1/me/views/not-a-uuid", { token: admin })).status).toBe(404);
  });

  it("a name taken on that page (any case) is 409; the limit per page is 400; a bad body or path is 400", async () => {
    const t = await signIn("admin");
    await save(t, { path: "/users", name: "Admins", query: "role=Admin" });
    const dup = await save(t, { path: "/users", name: "admins", query: "" });
    expect(dup.status).toBe(409);
    expect(await code(dup)).toBe("duplicate");
    for (let i = 1; i < MAX_SAVED_VIEWS; i++) await save(t, { path: "/users", name: `View ${i}`, query: "" });
    const full = await save(t, { path: "/users", name: "One too many", query: "" });
    expect(full.status).toBe(400);
    expect((await list(t)).total).toBe(MAX_SAVED_VIEWS);
    expect((await save(t, { path: "users", name: "x", query: "" })).status).toBe(400);
    expect((await save(t, { path: "/users", name: "", query: "" })).status).toBe(400);
    expect((await save(t, { path: "/users", name: "x", query: "a=1#frag" })).status).toBe(400);
    expect((await save(t, { path: "/users", name: "x", query: "", extra: 1 })).status).toBe(400);
    expect((await call("GET", "/v1/me/views", { token: t })).status).toBe(400);
  });

  it("two saves at the limit can't both pass", async () => {
    const t = await signIn("admin");
    for (let i = 0; i < MAX_SAVED_VIEWS - 1; i++) await save(t, { path: "/users", name: `View ${i}`, query: "" });
    const rs = await Promise.all([save(t, { path: "/users", name: "Last A", query: "" }), save(t, { path: "/users", name: "Last B", query: "" })]);
    expect(rs.map((r) => r.status).toSorted()).toEqual([200, 400]);
    expect((await list(t)).total).toBe(MAX_SAVED_VIEWS);
  });

  it("without a session it is 401", async () => {
    expect((await call("GET", "/v1/me/views?path=/users")).status).toBe(401);
  });
});


it("activity named views strip transient entry on save and legacy read, keeping exact filters and other pages unchanged", async () => {
  const token = await signIn("admin"), entry = Bun.randomUUIDv7(), actor = Bun.randomUUIDv7();
  const query = `actorId=${actor}&targetType=user&targetId=Exact%20Id&entry=${entry}&%65ntry=${entry}&sort=-at`;
  const expected = `actorId=${actor}&targetType=user&targetId=Exact%20Id&sort=-at`;
  const response = await save(token, { path: "/audit/activity", name: "Investigation", query });
  expect(response.status).toBe(200);
  const created = await response.json() as SavedViewDto;
  expect(created.query).toBe(expected);
  expect((await db.select().from(savedViews).where(eq(savedViews.id, created.id)))[0]!.query).toBe(expected);
  const owner = (await db.select({ id: users.id }).from(users).where(eq(users.username, "admin")))[0]!.id;
  const legacyId = Bun.randomUUIDv7();
  await db.insert(savedViews).values({ id: legacyId, userId: owner, path: "/audit/activity", name: "Legacy incident", query });
  expect((await list(token, "/audit/activity")).items.find(view => view.id === legacyId)?.query).toBe(expected);
  expect((await db.select().from(savedViews).where(eq(savedViews.id, legacyId)))[0]!.query).toBe(query); // read does not migrate stored data
  const other = await save(token, { path: "/users", name: "Unrelated opaque query", query });
  expect((await other.json() as SavedViewDto).query).toBe(query);
  const oversized = `entry=${"x".repeat(4091)}`;
  expect(oversized.length).toBe(4097);
  expect((await save(token, { path: "/audit/activity", name: "Oversize", query: oversized })).status).toBe(400);
});
