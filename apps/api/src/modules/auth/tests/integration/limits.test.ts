// Port of apps/web/src/lib/server/ratelimit.test.ts. Time moves by editing rows (the database clock decides), so each
// limiter gets a fresh name and shares no row with another test.
import { describe, expect, it } from "bun:test";
import { like, sql } from "drizzle-orm";
import { db } from "../../../../kernel/db";
import { Backoff, loginGate, RateLimiter, retryText } from "../../limits";
import { loginBackoff, rateLimits } from "../../schema";

const fresh = () => `t${Bun.randomUUIDv7()}`;
const msAgo = (col: typeof rateLimits.windowStart | typeof loginBackoff.lastFailureAt, ms: number) => sql`${col} - ${ms}::float8 * interval '1 millisecond'`;
/** Moves a limiter's window `ms` into the past. */
const ageWindow = (name: string, ms: number) =>
  db.update(rateLimits).set({ windowStart: msAgo(rateLimits.windowStart, ms) }).where(like(rateLimits.key, `${name}:%`));
/** The current wait of a backoff has passed. */
const waitOver = (name: string) =>
  db.update(loginBackoff).set({ blockedUntil: sql`now() - interval '1 millisecond'` }).where(like(loginBackoff.key, `${name}:%`));
/** Nothing failed for `ms`. */
const quiet = (name: string, ms: number) =>
  db.update(loginBackoff).set({ lastFailureAt: msAgo(loginBackoff.lastFailureAt, ms) }).where(like(loginBackoff.key, `${name}:%`));

describe("RateLimiter", () => {
  it("allows up to the limit within the window", async () => {
    const r = new RateLimiter(fresh(), 2, 1000);
    expect(await r.hit("ip:1")).toBeNull();
    expect(await r.hit("ip:1")).toBeNull();
    expect(await r.hit("ip:1")).toBe(1); // seconds until the window ends
    expect(await r.hit("ip:2")).toBeNull();
    await ageWindow(r.name, 1001);
    expect(await r.hit("ip:1")).toBeNull();
  });

  it("limiters with different names never share a count for the same key", async () => {
    const a = new RateLimiter(fresh(), 1, 60_000), b = new RateLimiter(fresh(), 1, 60_000);
    expect(await a.hit("10.0.0.1")).toBeNull();
    expect(await b.hit("10.0.0.1")).toBeNull();
    expect(await a.hit("10.0.0.1")).toBe(60);
  });

  it("20 concurrent hits on a limit of 10 allow exactly 10", async () => {
    const r = new RateLimiter(fresh(), 10, 60_000);
    const waits = await Promise.all(Array.from({ length: 20 }, () => r.hit("burst")));
    expect(waits.filter((w) => w === null)).toHaveLength(10);
    // Seconds left in the window: 60, or 59 when a hit lands after the window's first second under load.
    expect(waits.filter((w) => w !== null && w >= 59 && w <= 60)).toHaveLength(10);
  });
});

describe("Backoff (soft per-username)", () => {
  it("first 3 failures are free, then 1 s, 2 s, 4 s … capped; success clears", async () => {
    const b = new Backoff(fresh(), 3, 8_000);
    for (let i = 0; i < 3; i++) {
      expect(await b.retryAfterMs("rina")).toBe(0);
      await b.fail("rina");
    }
    expect(await b.retryAfterMs("rina")).toBeWithin(900, 1001);
    await waitOver(b.name);
    expect(await b.retryAfterMs("rina")).toBe(0);
    await b.fail("rina");
    expect(await b.retryAfterMs("rina")).toBeWithin(1900, 2001);
    for (let i = 0; i < 10; i++) await b.fail("rina");
    expect(await b.retryAfterMs("rina")).toBeWithin(7900, 8001); // capped, never a lockout
    await b.succeed("rina");
    expect(await b.retryAfterMs("rina")).toBe(0);
  });

  it("decays after a quiet period", async () => {
    const b = new Backoff(fresh(), 1, 60_000, 1000);
    await b.fail("x");
    expect(await b.retryAfterMs("x")).toBeGreaterThan(0);
    await quiet(b.name, 2000);
    expect(await b.retryAfterMs("x")).toBe(0);
    await b.fail("x"); // counting starts over: 1 failure, 1 s
    expect(await b.retryAfterMs("x")).toBeWithin(900, 1001);
  });
});

describe("loginGate", () => {
  const limits = () => ({
    ip: new RateLimiter(fresh(), 2, 60_000), breaker: new RateLimiter(fresh(), 5, 60_000),
    userCap: new RateLimiter(fresh(), 5, 60_000), user: new Backoff(fresh(), 1, 60_000),
  });

  it("buckets per IP: one noisy client doesn't block another", async () => {
    const l = limits();
    expect(await loginGate(l, { step: "login", ip: "10.0.0.9", username: "a" })).toBeNull();
    expect(await loginGate(l, { step: "login", ip: "10.0.0.9", username: "b" })).toBeNull();
    expect(await loginGate(l, { step: "login", ip: "10.0.0.9", username: "c" })).toBe(60);
    expect(await loginGate(l, { step: "login", ip: "10.0.0.2", username: "admin" })).toBeNull();
  });

  it("an unknown client IP (no TRUSTED_PROXY) has no per-IP bucket: callers don't share one; the breaker still trips", async () => {
    const l = limits(); // per IP 2, breaker 5
    for (const u of ["a", "b", "c", "d", "e"]) expect(await loginGate(l, { step: "login", ip: "unknown", username: u })).toBeNull();
    expect(await loginGate(l, { step: "login", ip: "unknown", username: "f" })).toBe(60);
  });

  it("a fleet-wide breaker stops an IP-rotating flood", async () => {
    const l = limits();
    for (let i = 0; i < 5; i++) expect(await loginGate(l, { step: "login", ip: `10.1.0.${i}`, username: null })).toBeNull();
    expect(await loginGate(l, { step: "login", ip: "10.1.0.99", username: null })).toBe(60);
  });

  it("concurrent attempts for one username are capped: the gate reserves each attempt atomically", async () => {
    const l = { ip: new RateLimiter(fresh(), 1000, 60_000), breaker: new RateLimiter(fresh(), 1000, 60_000), userCap: new RateLimiter(fresh(), 5, 60_000), user: new Backoff(fresh(), 3, 60_000) };
    // 20 requests arrive together, before any credential check answers.
    const waits = await Promise.all(Array.from({ length: 20 }, (_, i) => loginGate(l, { step: "login", ip: `10.9.0.${i}`, username: "rina" })));
    expect(waits.filter((w) => w == null)).toHaveLength(3); // the soft backoff's free attempts; the 4th must wait
  });

  it("hard per-username cap (5/min) even when every attempt succeeds", async () => {
    const l = { ip: new RateLimiter(fresh(), 1000, 60_000), breaker: new RateLimiter(fresh(), 1000, 60_000), userCap: new RateLimiter(fresh(), 5, 60_000), user: new Backoff(fresh(), 3, 60_000) };
    const results: (number | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const w = await loginGate(l, { step: "login", ip: "10.0.0.1", username: "rina" });
      if (w == null) await l.user.succeed("rina");
      results.push(w);
    }
    expect(results.filter((w) => w == null)).toHaveLength(5);
    expect(results.at(-1)).toBe(60);
  });

  it("release undoes a reservation that got no verdict (credential check failed to run)", async () => {
    const b = new Backoff(fresh(), 1, 60_000);
    await b.fail("x");
    await b.release("x");
    expect(await b.retryAfterMs("x")).toBe(0);
  });

  it("release takes back one failure of several; the earlier ones still count", async () => {
    const b = new Backoff(fresh(), 1, 60_000);
    await b.fail("x");
    await b.fail("x"); // 2 failures: 2 s
    expect(await b.retryAfterMs("x")).toBeWithin(1900, 2001);
    await b.release("x"); // back to 1 failure: 1 s after the last failure
    expect(await b.retryAfterMs("x")).toBeWithin(900, 1001);
    await b.release("x");
    expect(await b.retryAfterMs("x")).toBe(0);
    expect(await b.reserve("x")).toBe(0); // counting starts at 1 again
    expect(await b.retryAfterMs("x")).toBeWithin(900, 1001);
  });

  it("username backoff returns seconds to wait (case-insensitive)", async () => {
    const l = limits();
    await l.user.fail("rina");
    expect(await loginGate(l, { step: "login", ip: "10.0.0.1", username: "Rina" })).toBe(1);
  });

  it("retry text", () => {
    expect(retryText(60)).toBe("Too many attempts. Try again in 1 minute.");
    expect(retryText(8)).toBe("Too many attempts. Try again in 8 seconds.");
    expect(retryText(1)).toBe("Too many attempts. Try again in 1 second.");
  });
});
