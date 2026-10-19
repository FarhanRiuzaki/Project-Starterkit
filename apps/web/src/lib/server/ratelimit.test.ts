import { describe, expect, it } from "vitest";
import { Backoff, loginGate, RateLimiter, retryText } from "./ratelimit";

describe("RateLimiter", () => {
  it("allows up to the limit within the window", () => {
    const r = new RateLimiter(2, 1000);
    expect(r.allow("ip:1", 0)).toBe(true);
    expect(r.allow("ip:1", 10)).toBe(true);
    expect(r.allow("ip:1", 20)).toBe(false);
    expect(r.allow("ip:2", 20)).toBe(true);
    expect(r.allow("ip:1", 1011)).toBe(true);
  });
  it("evicts oldest keys on overflow instead of clearing all counters", () => {
    const r = new RateLimiter(1, 60_000, 3);
    expect(r.allow("user:admin", 0)).toBe(true);
    for (const k of ["a", "b", "c", "d"]) r.allow(`ip:${k}`, 1);
    // user:admin is evicted as the oldest key, but recently used keys are never evicted en masse
    expect(r.allow("ip:d", 2)).toBe(false);
    expect(r.size()).toBeLessThanOrEqual(3);
  });
});

describe("Backoff (soft per-username)", () => {
  it("first 3 failures are free, then 1 s, 2 s, 4 s … capped; success clears", () => {
    const b = new Backoff(3, 8_000);
    for (let i = 0; i < 3; i++) { expect(b.retryAfterMs("rina", i)).toBe(0); b.fail("rina", i); }
    expect(b.retryAfterMs("rina", 2)).toBe(1000);
    expect(b.retryAfterMs("rina", 1002)).toBe(0);
    b.fail("rina", 1002);
    expect(b.retryAfterMs("rina", 1002)).toBe(2000);
    for (let i = 0; i < 10; i++) b.fail("rina", 5000);
    expect(b.retryAfterMs("rina", 5000)).toBe(8000); // capped, never a lockout
    b.succeed("rina");
    expect(b.retryAfterMs("rina", 5000)).toBe(0);
  });
  it("decays after a quiet period", () => {
    const b = new Backoff(1, 60_000, 1000);
    b.fail("x", 0);
    expect(b.retryAfterMs("x", 10)).toBeGreaterThan(0);
    expect(b.retryAfterMs("x", 2000)).toBe(0);
  });
});

describe("loginGate", () => {
  const limits = () => ({ ip: new RateLimiter(2, 60_000), breaker: new RateLimiter(5, 60_000), userCap: new RateLimiter(5, 60_000), user: new Backoff(1, 60_000) });
  it("buckets per IP: one noisy client doesn't block another", () => {
    const l = limits();
    expect(loginGate(l, { step: "login", ip: "10.0.0.9", username: "a" }, 0)).toBeNull();
    expect(loginGate(l, { step: "login", ip: "10.0.0.9", username: "b" }, 1)).toBeNull();
    expect(loginGate(l, { step: "login", ip: "10.0.0.9", username: "c" }, 2)).toBe(60);
    expect(loginGate(l, { step: "login", ip: "10.0.0.2", username: "admin" }, 3)).toBeNull();
  });
  it("a fleet-wide breaker stops an IP-rotating flood", () => {
    const l = limits();
    for (let i = 0; i < 5; i++) expect(loginGate(l, { step: "login", ip: `10.1.0.${i}`, username: null }, i)).toBeNull();
    expect(loginGate(l, { step: "login", ip: "10.1.0.99", username: null }, 9)).toBe(60);
  });
  it("concurrent attempts for one username are capped: the gate reserves each attempt synchronously", () => {
    const l = { ip: new RateLimiter(1000, 60_000), breaker: new RateLimiter(1000, 60_000), userCap: new RateLimiter(5, 60_000), user: new Backoff(3, 60_000) };
    // 20 requests arrive together (no await between them, as with parallel requests before the credential check answers).
    const passed = Array.from({ length: 20 }, (_, i) => loginGate(l, { step: "login", ip: `10.9.0.${i}`, username: "rina" }, 1000)).filter((w) => w == null);
    expect(passed).toHaveLength(3); // the soft backoff's free attempts; the 4th must wait
  });
  it("hard per-username cap (5/min) even when every attempt succeeds", () => {
    const l = { ip: new RateLimiter(1000, 60_000), breaker: new RateLimiter(1000, 60_000), userCap: new RateLimiter(5, 60_000), user: new Backoff(3, 60_000) };
    const results = Array.from({ length: 7 }, (_, i) => {
      const w = loginGate(l, { step: "login", ip: "10.0.0.1", username: "rina" }, i);
      if (w == null) l.user.succeed("rina");
      return w;
    });
    expect(results.filter((w) => w == null)).toHaveLength(5);
    expect(results.at(-1)).toBe(60);
  });
  it("release undoes a reservation that got no verdict (credential check failed to run)", () => {
    const b = new Backoff(1, 60_000);
    b.fail("x", 0);
    b.release("x");
    expect(b.retryAfterMs("x", 1)).toBe(0);
  });
  it("username backoff returns seconds to wait (case-insensitive)", () => {
    const l = limits();
    l.user.fail("rina", 0);
    expect(loginGate(l, { step: "login", ip: "10.0.0.1", username: "Rina" }, 100)).toBe(1);
  });
  it("retry text", () => {
    expect(retryText(60)).toBe("Too many attempts. Try again in 1 minute.");
    expect(retryText(8)).toBe("Too many attempts. Try again in 8 seconds.");
    expect(retryText(1)).toBe("Too many attempts. Try again in 1 second.");
  });
});
