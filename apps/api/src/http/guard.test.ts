import { beforeAll, describe, expect, it } from "bun:test";
import { api, resetData, signIn } from "../../test/app";
import { guard } from "./guard";

beforeAll(resetData);

/** An app with one route guarded by `user.edit`; `ran` tells whether the handler body ran. */
function guarded() {
  const app = api();
  const state = { ran: false, ctx: null as unknown };
  app.get("/v1/guarded", async (c) => {
    const ctx = await guard(c, "user.edit");
    state.ran = true;
    state.ctx = ctx;
    return c.json({ ok: true });
  });
  const get = (headers: Record<string, string> = {}) =>
    app.request("/v1/guarded", { headers: { "X-Internal-Token": process.env.INTERNAL_API_TOKEN!, "X-Client-Ip": "10.0.0.7", ...headers } });
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
