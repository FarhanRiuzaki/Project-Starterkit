import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { Hono } from "hono";
import { type AppEnv, onError } from "./middleware";
import { body, idParam, query } from "./parse";

const TOKEN = { "X-Internal-Token": process.env.INTERNAL_API_TOKEN! };
const Body = z.object({ name: z.string().min(1) });
const Query = z.object({ page: z.coerce.number().int().min(1).default(1), q: z.string().optional() });

function app() {
  const a = new Hono<AppEnv>().onError(onError);
  a.get("/v1/things/:id", (c) => c.json({ id: idParam(c, "id", "thing") }));
  a.get("/v1/things", (c) => c.json(query(c, Query)));
  a.post("/v1/things", async (c) => c.json(await body(c, Body)));
  return a;
}
const res = async (r: Response) => ({ status: r.status, body: (await r.json()) as unknown });

describe("parse", () => {
  it("idParam rejects abc, 1, and a uuid with trailing text as 404", async () => {
    const a = app();
    const id = Bun.randomUUIDv7();
    for (const bad of ["abc", "1", `${id}x`, `${id}%20`]) {
      expect(await res(await a.request(`/v1/things/${bad}`, { headers: TOKEN }))).toEqual({
        status: 404, body: { error: { code: "not_found", message: "This thing doesn't exist or was deleted." } },
      });
    }
    expect(await res(await a.request(`/v1/things/${id.toUpperCase()}`, { headers: TOKEN }))).toEqual({ status: 200, body: { id: id.toUpperCase() } });
  });

  it("query takes the first value per key and validates", async () => {
    const a = app();
    expect(await res(await a.request("/v1/things?page=2&page=3&q=x", { headers: TOKEN }))).toEqual({ status: 200, body: { page: 2, q: "x" } });
    expect((await a.request("/v1/things?page=0", { headers: TOKEN })).status).toBe(400);
  });

  it("body: malformed JSON, a non-JSON content type and a schema miss are 400 bad_request", async () => {
    const a = app();
    const post = (b: string, type = "application/json") => a.request("/v1/things", { method: "POST", headers: { ...TOKEN, "Content-Type": type }, body: b });
    for (const r of [await post("{oops"), await post('{"name":"a"}', "text/plain"), await post("name=a", "application/x-www-form-urlencoded"), await post('{"name":""}'), await post("")]) {
      expect(r.status).toBe(400);
      expect(((await r.json()) as { error: { code: string } }).error.code).toBe("bad_request");
    }
    expect(await res(await post('{"name":"a"}', "application/json; charset=utf-8"))).toEqual({ status: 200, body: { name: "a" } });
  });
});
