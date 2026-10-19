import { randomUUID } from "node:crypto";
import { sealData } from "iron-session";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ERROR_CODES } from "@/lib/shared/contracts/common";

const SECRET = vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));
/** The cookie jar behind the mocked `cookies()`: iron-session reads and writes `sk_session` here. */
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void (value ? jar.set(name, value) : jar.delete(name)),
  }),
}));

import { db, resetDb } from "./mock/db";
import { apiError, clientIp, handleError, json, tooManyAttempts, withPermission } from "./api";
import { SESSION_COOKIE, sessionOptions } from "./session";

const CSRF = "c".repeat(43);

/** A signed-in browser: a store session for `username` plus the sealed cookie that points at it. */
async function signIn(username: string, cookie: Record<string, unknown> = {}) {
  const user = [...db().users.values()].find((u) => u.username === username)!;
  const sid = randomUUID();
  const now = new Date().toISOString();
  db().sessions.set(sid, { id: sid, userId: user.id, device: "test", ip: "test", createdAt: now, lastSeenAt: now });
  jar.set(SESSION_COOKIE, await sealData({ sid, csrf: CSRF, ...cookie }, { password: SECRET, ttl: 3600 }));
  return { user, sid };
}

const req = (method = "GET", headers: Record<string, string> = {}) => new Request("http://c/api/x", { method, headers });
const ok = vi.fn(async () => json({ ok: true }));
const body = async (r: Response) => (await r.json()) as { error: { code: string; message: string } };

beforeEach(() => {
  resetDb();
  jar.clear();
  ok.mockClear();
});

describe("withPermission", () => {
  it("401 without session", async () => {
    const r = await withPermission(req(), "user.view", ok);
    expect(r.status).toBe(401);
    expect((await body(r)).error.code).toBe("unauthenticated");
    expect(ok).not.toHaveBeenCalled();
  });

  it("401 when sid was terminated in the store, and the cookie is cleared", async () => {
    const { sid } = await signIn("admin");
    db().sessions.delete(sid);
    const r = await withPermission(req(), "user.view", ok);
    expect(r.status).toBe(401);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(ok).not.toHaveBeenCalled();
  });

  it("401 when the user was deactivated mid-session", async () => {
    const { user } = await signIn("admin");
    expect((await withPermission(req(), "user.view", ok)).status).toBe(200);
    user.isActive = false;
    const r = await withPermission(req(), "user.view", ok);
    expect(r.status).toBe(401);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it("401 for a session still waiting for its second factor", async () => {
    await signIn("twofa", { pending2fa: { userId: "u-004", method: "password" } });
    expect((await withPermission(req(), null, ok)).status).toBe(401);
    jar.set(SESSION_COOKIE, await sealData({ pending2fa: { userId: "u-004", method: "password" } }, { password: SECRET, ttl: 3600 }));
    expect((await withPermission(req(), null, ok)).status).toBe(401);
    expect(ok).not.toHaveBeenCalled();
  });

  it("401 for a cookie sealed with another secret", async () => {
    const { sid } = await signIn("admin");
    jar.set(SESSION_COOKIE, await sealData({ sid, csrf: CSRF }, { password: "x".repeat(40), ttl: 3600 }));
    expect((await withPermission(req(), "user.view", ok)).status).toBe(401);
  });

  it("403 csrf on POST without or with wrong x-csrf-token", async () => {
    await signIn("admin");
    for (const h of [{}, { "x-csrf-token": "wrong" }, { "x-csrf-token": CSRF.slice(1) + "d" }] as Record<string, string>[]) {
      for (const m of ["POST", "PATCH", "PUT", "DELETE"]) {
        const r = await withPermission(req(m, h), "user.edit", ok);
        expect(r.status, `${m} ${JSON.stringify(h)}`).toBe(403);
        expect((await body(r)).error.code).toBe("csrf");
      }
    }
    expect(ok).not.toHaveBeenCalled();
    expect((await withPermission(req("POST", { "x-csrf-token": CSRF }), "user.edit", ok)).status).toBe(200);
  });

  it("401 comes before csrf: no session and no token is unauthenticated", async () => {
    expect((await body(await withPermission(req("POST"), "user.edit", ok))).error.code).toBe("unauthenticated");
  });

  it("403 forbidden when permission missing, handler not called", async () => {
    await signIn("viewer");
    const r = await withPermission(req("POST", { "x-csrf-token": CSRF }), "user.create", ok);
    expect(r.status).toBe(403);
    expect((await body(r)).error.code).toBe("forbidden");
    expect(ok).not.toHaveBeenCalled();
  });

  it("csrf is checked before the permission (a viewer's tokenless POST is csrf, not forbidden)", async () => {
    await signIn("viewer");
    expect((await body(await withPermission(req("POST"), "user.create", ok))).error.code).toBe("csrf");
  });

  it("permission removed from role takes effect on next request", async () => {
    await signIn("admin");
    expect((await withPermission(req(), "user.view", ok)).status).toBe(200);
    const role = db().roles.get("role-admin")!;
    role.permissions = role.permissions.filter((p) => p !== "user.view");
    expect((await withPermission(req(), "user.view", ok)).status).toBe(403);
  });

  it("null permission = signed in is enough; the handler gets the user, sid and permissions", async () => {
    const { user, sid } = await signIn("viewer");
    let seen: unknown;
    const r = await withPermission(req(), null, async (ctx) => {
      seen = { id: ctx.user.id, sid: ctx.sid, edit: ctx.perms.has("user.edit"), view: ctx.perms.has("user.view") };
      return json({});
    });
    expect(r.status).toBe(200);
    expect(seen).toEqual({ id: user.id, sid, edit: false, view: true });
  });

  it("handler errors do not leak messages", async () => {
    await signIn("admin");
    const r = await withPermission(req(), "user.view", async () => { throw new Error("db secret"); });
    expect(r.status).toBe(500);
    const b = await body(r);
    expect(JSON.stringify(b)).not.toContain("db secret");
    expect(ERROR_CODES).toContain(b.error.code);
  });

  it("each authenticated request stamps the store session's lastSeenAt; a 401 touches no session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-19T10:00:00.000Z"));
      const { sid } = await signIn("viewer");
      await withPermission(req(), null, ok);
      expect(db().sessions.get(sid)!.lastSeenAt).toBe("2026-10-19T10:00:00.000Z");
      vi.setSystemTime(new Date("2026-10-19T10:05:00.000Z"));
      await withPermission(req(), "role.create", ok); // 403 forbidden still passed the session check
      expect(db().sessions.get(sid)!.lastSeenAt).toBe("2026-10-19T10:05:00.000Z");
      const before = JSON.stringify([...db().sessions.values()]);
      jar.clear();
      vi.setSystemTime(new Date("2026-10-19T10:10:00.000Z"));
      expect((await withPermission(req(), null, ok)).status).toBe(401);
      expect(JSON.stringify([...db().sessions.values()])).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("session cookie", () => {
  it("httpOnly, sameSite strict, secure follows COOKIE_SECURE, ttl = hours × 3600", () => {
    for (const secure of [true, false]) {
      const o = sessionOptions({ SESSION_SECRET: SECRET, SESSION_TTL_HOURS: 5, COOKIE_SECURE: secure });
      expect(o).toMatchObject({ cookieName: "sk_session", ttl: 5 * 3600, cookieOptions: { httpOnly: true, sameSite: "strict", secure, path: "/" } });
    }
  });
});

describe("responses", () => {
  it("json and apiError send no-store and the error shape", async () => {
    const r = apiError(404, "not_found", "No such user.");
    expect(r.status).toBe(404);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: { code: "not_found", message: "No such user." } });
    expect(json({}).headers.get("Cache-Control")).toBe("no-store");
  });

  it("handleError: zod error → 400 bad_request, anything else → generic 500", async () => {
    const e = z.string().safeParse(1).error!;
    const bad = handleError(e);
    expect(bad.status).toBe(400);
    expect((await body(bad)).error.code).toBe("bad_request");
    const r = handleError(new Error("detail internal"));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("detail internal");
  });
});

describe("clientIp (rate-limit key)", () => {
  const r = (h: Record<string, string>) => new Request("http://c/api/auth/login", { headers: h });
  it("X-Forwarded-For is client-controlled and ignored without TRUSTED_PROXY: one shared bucket", () => {
    expect(clientIp(r({ "x-forwarded-for": "9.9.9.9" }), false)).toBe("unknown");
    expect(clientIp(r({}), false)).toBe("unknown");
  });
  it("TRUSTED_PROXY: the right-most XFF hop (what the trusted proxy saw), not a client-chosen first value", () => {
    expect(clientIp(r({ "x-forwarded-for": "6.6.6.6, 10.190.7.31" }), true)).toBe("10.190.7.31");
  });
  it("429 carries Retry-After", () => {
    const res = tooManyAttempts(8, "Too many attempts. Try again in 8 seconds.");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("8");
  });
});
