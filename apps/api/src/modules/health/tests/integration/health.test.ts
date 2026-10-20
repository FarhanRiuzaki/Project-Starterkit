import { describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { request } from "../../../../../test/helpers/app";
import { createApp } from "../../../../app";
import type { Pingable } from "../../controller";

describe("app", () => {
  it("healthz needs no token", async () => {
    const res = await request(createApp(), "/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("readyz answers ok when the database does", async () => {
    const res = await request(createApp(), "/readyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it("db down: readyz 503", async () => {
    const down = new SQL("postgresql://nobody:nothing@127.0.0.1:1/none", { max: 1, connectionTimeout: 1 });
    const res = await request(createApp({ db: drizzle({ client: down }) }), "/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    await down.close();
  });
  it("db that never answers: readyz 503 after 2 s", async () => {
    const hung: Pingable = { execute: () => new Promise(() => {}) };
    const start = performance.now();
    const res = await request(createApp({ db: hung }), "/readyz");
    expect(res.status).toBe(503);
    expect(performance.now() - start).toBeGreaterThanOrEqual(1900);
  });
});
