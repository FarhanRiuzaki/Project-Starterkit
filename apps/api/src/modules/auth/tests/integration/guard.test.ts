import { beforeAll, describe, expect, it } from "bun:test";
import { z } from "zod";
import { api, request, resetData, signIn } from "../../../../../test/helpers/app";
import { notFound } from "../../../../kernel/errors";
import { body, idParam } from "../../../../kernel/parse";
import { guard } from "../../guard";

beforeAll(resetData);

/** An app with one route guarded by `user.edit`; `ran` tells whether the handler body ran. */
function guarded() {
  const state = { ran: false, ctx: null as unknown };
  const app = api().use(guard).get("/v1/guarded", ({ ctx }) => {
    state.ran = true;
    state.ctx = ctx;
    return { ok: true };
  }, { guard: "user.edit" });
  const get = (headers: Record<string, string> = {}) =>
    request(app, "/v1/guarded", { headers: { "X-Internal-Token": process.env.INTERNAL_API_TOKEN!, "X-Client-Ip": "10.0.0.7", ...headers } });
  return { state, get };
}
const code = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

describe("guard", () => {
  it("no bearer 401", async () => {
    const g = guarded();
    const res = await g.get();
    expect(res.status).toBe(401);
    expect(await code(res)).toBe("unauthenticated");
    expect((await g.get({ Authorization: "Basic abc" })).status).toBe(401);
    expect(g.state.ran).toBe(false);
  });

  it("unknown token 401", async () => {
    const g = guarded();
    const res = await g.get({ Authorization: "Bearer nope" });
    expect(res.status).toBe(401);
    expect(await code(res)).toBe("unauthenticated");
    expect(g.state.ran).toBe(false);
  });

  it("missing permission 403 forbidden before the handler runs", async () => {
    const g = guarded();
    const res = await g.get({ Authorization: `Bearer ${await signIn("viewer")}` });
    expect(res.status).toBe(403);
    expect(await code(res)).toBe("forbidden");
    expect(g.state.ran).toBe(false);
  });

  it("a held permission passes with the user, client and request id", async () => {
    const g = guarded();
    const res = await g.get({ Authorization: `Bearer ${await signIn("admin")}`, "X-Request-Id": "req-1" });
    expect(res.status).toBe(200);
    expect(g.state.ctx).toMatchObject({ user: { username: "admin" }, client: { ip: "10.0.0.7" }, requestId: "req-1" });
  });
});

describe("guard in the contract's check order", () => {
  // query 400 → guard 401/403 → body 400 → 404, on one Elysia route with every check.
  const Query = z.object({ dryRun: z.enum(["true", "false"]).optional() });
  const Body = z.object({ name: z.string().min(1) });
  const app = api().use(guard).post("/v1/ordered/:id", async (c) => {
    const b = await body(c, Body);
    const id = idParam(c.params.id, "thing");
    if (id !== KNOWN) throw notFound("thing");
    return { id, name: b.name, dryRun: c.query.dryRun ?? null };
  }, { query: Query, guard: "user.edit" });
  const KNOWN = Bun.randomUUIDv7();
  const post = (path: string, o: { token?: string; body?: string | ReadableStream } = {}) =>
    request(app, path, {
      method: "POST",
      headers: { "X-Internal-Token": process.env.INTERNAL_API_TOKEN!, "Content-Type": "application/json", ...(o.token && { Authorization: `Bearer ${o.token}` }) },
      body: o.body ?? '{"name":"a"}',
    });
  const status = async (r: Response) => [r.status, await code(r)];

  it("a bad query is 400 before the session is read; no session is 401 and a missing permission 403 before the body", async () => {
    expect(await status(await post(`/v1/ordered/${KNOWN}?dryRun=maybe`))).toEqual([400, "bad_request"]);
    expect(await status(await post(`/v1/ordered/${KNOWN}`, { body: "{oops" }))).toEqual([401, "unauthenticated"]);
    expect(await status(await post(`/v1/ordered/${KNOWN}`, { token: await signIn("viewer"), body: "{oops" }))).toEqual([403, "forbidden"]);
  });

  it("a bad body is 400 before the record is looked up; then 404; then the answer", async () => {
    const admin = await signIn("admin");
    expect(await status(await post("/v1/ordered/abc", { token: admin, body: "{oops" }))).toEqual([400, "bad_request"]);
    expect(await status(await post(`/v1/ordered/${Bun.randomUUIDv7()}`, { token: admin, body: '{"name":""}' }))).toEqual([400, "bad_request"]);
    expect(await status(await post("/v1/ordered/abc", { token: admin }))).toEqual([404, "not_found"]);
    expect(await status(await post(`/v1/ordered/${Bun.randomUUIDv7()}`, { token: admin }))).toEqual([404, "not_found"]);
    const ok = await post(`/v1/ordered/${KNOWN}?dryRun=true&dryRun=false`, { token: admin });
    expect(await ok.json()).toEqual({ id: KNOWN, name: "a", dryRun: "true" });
  });

  it("a body over 64 KB without Content-Length is counted after the guard: 401 without a session, 400 with one", async () => {
    const big = () => new ReadableStream({ start(s) { s.enqueue(new TextEncoder().encode(JSON.stringify({ name: "y".repeat(70 * 1024) }))); s.close(); } });
    expect(await status(await post(`/v1/ordered/${KNOWN}`, { body: big() }))).toEqual([401, "unauthenticated"]);
    expect(await status(await post(`/v1/ordered/${KNOWN}`, { token: await signIn("viewer"), body: big() }))).toEqual([403, "forbidden"]);
    expect(await status(await post(`/v1/ordered/${KNOWN}`, { token: await signIn("admin"), body: big() }))).toEqual([400, "bad_request"]);
  });
});
