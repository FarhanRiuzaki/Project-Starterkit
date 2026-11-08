// /v1/projects*: guard, check order, paging, uniqueness, activity entries.
import { beforeEach, describe, expect, it } from "bun:test";
import type { Page } from "@starterkit/shared/contracts/common";
import type { ProjectDto } from "@starterkit/shared/contracts/projects";
import { asc, eq } from "drizzle-orm";
import { call, resetData, signIn } from "../../../../../test/helpers/app";
import { db } from "../../../../kernel/db";
import { activity } from "../../../audit";
import { rolePermissions, roles } from "../../../rbac";
import { projects } from "../../schema";

const code = async (r: Response) => ((await r.json()) as { error: { code: string } }).error.code;
const acts = () => db.select({ action: activity.action, targetType: activity.targetType, targetId: activity.targetId, targetLabel: activity.targetLabel, before: activity.before, after: activity.after })
  .from(activity).orderBy(asc(activity.at), asc(activity.id));

let sa: string;
beforeEach(async () => {
  await resetData();
  await db.delete(activity);
  await db.delete(projects); // the demo seed's; each case makes its own
  sa = await signIn("superadmin");
});

const get = (path: string, token?: string) => call("GET", path, { token });
const create = (body: unknown, token = sa) => call("POST", "/v1/projects", { token, body });
const patch = (id: string, body: unknown, token = sa) => call("PATCH", `/v1/projects/${id}`, { token, body });
const del = (id: string, token = sa) => call("DELETE", `/v1/projects/${id}`, { token });
const page = async (qs = "") => (await (await get(`/v1/projects?${qs}`, sa)).json()) as Page<ProjectDto>;
const names = async (qs = "") => (await page(qs)).items.map((p) => p.name);
const make = async (name: string, more: Record<string, unknown> = {}) => (await (await create({ name, ...more })).json()) as ProjectDto;

describe("guard and check order", () => {
  it("needs a session and project.view; Viewer doesn't have it, Admin does", async () => {
    expect((await get("/v1/projects")).status).toBe(401);
    expect((await get("/v1/projects", await signIn("viewer"))).status).toBe(403);
    expect((await get("/v1/projects", await signIn("admin"))).status).toBe(200);
  });

  it.each([["pageSize=10"], ["page=1001"], ["sort=status"], ["status=deleted"]])("rejects %s with 400 before the guard", async (qs) => {
    expect((await get(`/v1/projects?${qs}`)).status).toBe(400);
  });

  it("a body's 400 comes after the guard and before the 404", async () => {
    const viewer = await signIn("viewer");
    expect((await create({ name: "" }, viewer)).status).toBe(403);
    expect((await create({ name: "" })).status).toBe(400);
    expect((await patch(Bun.randomUUIDv7(), { name: "" })).status).toBe(400);
    expect((await patch(Bun.randomUUIDv7(), { name: "X" })).status).toBe(404);
    expect((await patch(Bun.randomUUIDv7(), { color: "red" })).status).toBe(400);
  });

  it("a missing permission is 403 before anything changes", async () => {
    const p = await make("Apollo");
    const viewer = await signIn("viewer");
    expect((await create({ name: "Gemini" }, viewer)).status).toBe(403);
    expect((await patch(p.id, { name: "Gemini" }, viewer)).status).toBe(403);
    expect((await del(p.id, viewer)).status).toBe(403);
    expect(await db.$count(projects)).toBe(1);
  });

  it("an unknown or non-UUID id is 404 not_found", async () => {
    for (const id of [Bun.randomUUIDv7(), "nope", "1"]) {
      for (const r of [await get(`/v1/projects/${id}`, sa), await del(id)]) {
        expect(r.status).toBe(404);
        expect(await code(r)).toBe("not_found");
      }
    }
  });

  it("a permission removed mid-session applies on the next request", async () => {
    const admin = await signIn("admin");
    expect((await get("/v1/projects", admin)).status).toBe(200);
    const [r] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, "Admin"));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, r!.id));
    expect((await get("/v1/projects", admin)).status).toBe(403);
  });
});

describe("GET /v1/projects", () => {
  it("pages, name A–Z by default, searches the name literally, filters by status, sorts by createdAt", async () => {
    await make("beta");
    await make("Alpha", { status: "archived" });
    await make("50% off_x");
    await make("50 offsx");
    expect(await page()).toMatchObject({ total: 4, page: 1, pageSize: 15 });
    expect(await names()).toEqual(["50 offsx", "50% off_x", "Alpha", "beta"]);
    expect(await names("sort=-name")).toEqual(["beta", "Alpha", "50% off_x", "50 offsx"]);
    expect(await names("sort=createdAt")).toEqual(["beta", "Alpha", "50% off_x", "50 offsx"]);
    expect(await names("q=ALP")).toEqual(["Alpha"]);
    expect(await names("q=50%25")).toEqual(["50% off_x"]);
    expect(await names("q=_x")).toEqual(["50% off_x"]);
    expect(await names("status=archived")).toEqual(["Alpha"]);
    expect(await page("page=2")).toMatchObject({ items: [], total: 4, page: 2 });
  });
});

describe("POST, GET one, PATCH, DELETE", () => {
  it("creates (201), trims, stores an empty description as none, records project.create", async () => {
    const r = await create({ name: "  Apollo  ", description: "  " });
    expect(r.status).toBe(201);
    const p = (await r.json()) as ProjectDto;
    expect(p).toMatchObject({ name: "Apollo", description: null, status: "active" });
    expect(await (await get(`/v1/projects/${p.id}`, sa)).json()).toEqual(p);
    expect(await acts()).toEqual([{ action: "project.create", targetType: "project", targetId: p.id, targetLabel: "Apollo", before: null, after: p }]);
  });

  it("names are unique ignoring letter case: 409 duplicate on create and rename, nothing recorded", async () => {
    const a = await make("Apollo");
    await db.delete(activity);
    const r = await create({ name: "APOLLO" });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe("duplicate");
    const b = await make("Gemini");
    await db.delete(activity);
    expect(await code(await patch(b.id, { name: "apollo" }))).toBe("duplicate");
    expect(await acts()).toEqual([]);
    expect((await patch(a.id, { name: "APOLLO" })).status).toBe(200);
  });

  it("two creates of one name at once: exactly one wins", async () => {
    const rs = await Promise.all([create({ name: "Apollo" }), create({ name: "apollo" })]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it("PATCH records only the changed fields; nothing to change is 200 with no entry", async () => {
    const p = await make("Apollo", { description: "Moon" });
    await db.delete(activity);
    const r = await patch(p.id, { name: "Apollo", status: "archived", description: "" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ name: "Apollo", status: "archived", description: null });
    expect(await acts()).toEqual([{ action: "project.update", targetType: "project", targetId: p.id, targetLabel: "Apollo",
      before: { status: "active", description: "Moon" }, after: { status: "archived", description: null } }]);
    await db.delete(activity);
    expect((await patch(p.id, { status: "archived" })).status).toBe(200);
    expect(await acts()).toEqual([]);
  });

  it("DELETE removes it, records what it was, then answers 404", async () => {
    const p = await make("Apollo");
    await db.delete(activity);
    expect(await (await del(p.id)).json()).toEqual({ ok: true });
    expect(await acts()).toEqual([{ action: "project.delete", targetType: "project", targetId: p.id, targetLabel: "Apollo", before: p, after: null }]);
    expect((await get(`/v1/projects/${p.id}`, sa)).status).toBe(404);
    expect((await del(p.id)).status).toBe(404);
  });
});
