import "server-only";

/** Sliding window per key. The Map holds at most `maxKeys`; on overflow the oldest key is evicted (never cleared). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit = 5, private windowMs = 60_000, private maxKeys = 10_000) {}

  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    this.hits.delete(key); // move to the newest position (Map insertion order = LRU)
    while (this.hits.size >= this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  size(): number {
    return this.hits.size;
  }
}

/**
 * Soft per-username backoff for failed sign-ins (instead of a hard lockout an attacker could trigger for a known
 * username): the first `free` failures cost nothing, then each further attempt waits 1 s, 2 s, 4 s … (max `maxMs`)
 * after the previous failure. A success, or `decayMs` without failures, clears it.
 * The gate counts an attempt as a failure when it starts (`fail`, synchronous) so concurrent requests can't all pass;
 * the route then `succeed`s it, or `release`s it when the attempt never reached a verdict (the credential check failed to run).
 */
export class Backoff {
  private fails = new Map<string, { n: number; at: number }>();
  constructor(private free = 3, private maxMs = 60_000, private decayMs = 15 * 60_000, private maxKeys = 10_000) {}

  private entry(key: string, now: number) {
    const e = this.fails.get(key);
    if (e && now - e.at > this.decayMs) { this.fails.delete(key); return undefined; }
    return e;
  }

  /** 0 = may try now; otherwise milliseconds to wait. */
  retryAfterMs(key: string, now = Date.now()): number {
    const e = this.entry(key, now);
    if (!e || e.n < this.free) return 0;
    const wait = Math.min(1000 * 2 ** (e.n - this.free), this.maxMs);
    return Math.max(0, e.at + wait - now);
  }

  fail(key: string, now = Date.now()): void {
    const e = this.entry(key, now);
    this.fails.delete(key);
    while (this.fails.size >= this.maxKeys) {
      const oldest = this.fails.keys().next().value;
      if (oldest === undefined) break;
      this.fails.delete(oldest);
    }
    this.fails.set(key, { n: (e?.n ?? 0) + 1, at: now });
  }

  /** Undo one reserved failure (the attempt got no verdict). */
  release(key: string): void {
    const e = this.fails.get(key);
    if (!e) return;
    if (e.n <= 1) this.fails.delete(key);
    else this.fails.set(key, { n: e.n - 1, at: e.at });
  }

  succeed(key: string): void {
    this.fails.delete(key);
  }
}

/** ip: per client IP; breaker: fleet-wide; userCap: hard per-username cap; user: soft per-username backoff. */
export type LoginLimits = { ip: RateLimiter; breaker: RateLimiter; userCap: RateLimiter; user: Backoff };

/**
 * Gate for a sign-in step, fully synchronous so concurrent requests are counted before any await:
 * per client IP (10/min; clientIp ignores X-Forwarded-For unless TRUSTED_PROXY), a fleet-wide breaker (300/min),
 * a hard per-username cap (5/min), and the soft per-username backoff — whose attempt is reserved here as a failure.
 * Returns null when allowed (caller must then `succeed` or `release` the username), else seconds to wait.
 */
export function loginGate(l: LoginLimits, o: { step: "login" | "otp"; ip: string; username: string | null }, now = Date.now()): number | null {
  const user = o.username?.toLowerCase() ?? null;
  if (user) {
    const wait = l.user.retryAfterMs(user, now);
    if (wait > 0) return Math.ceil(wait / 1000);
  }
  if (!l.ip.allow(`${o.step}:${o.ip}`, now)) return 60;
  if (!l.breaker.allow(o.step, now)) return 60;
  if (user) {
    if (!l.userCap.allow(`${o.step}:${user}`, now)) return 60;
    l.user.fail(user, now); // reserved: converted to success / released by the route
  }
  return null;
}

const g = globalThis as unknown as { __skLoginLimits?: LoginLimits };
export const loginLimits = (g.__skLoginLimits ??= {
  ip: new RateLimiter(10, 60_000),
  breaker: new RateLimiter(300, 60_000),
  userCap: new RateLimiter(5, 60_000),
  user: new Backoff(),
});

/**
 * Forgot-password requests: per client IP (10 per minute) and per email (3 per 15 minutes). A throttled request still
 * answers 200 and simply sends nothing, so the limit doesn't reveal which emails exist.
 */
export type ForgotLimits = { ip: RateLimiter; email: RateLimiter };
const fg = globalThis as unknown as { __skForgotLimits?: ForgotLimits };
export const forgotLimits = (fg.__skForgotLimits ??= { ip: new RateLimiter(10, 60_000), email: new RateLimiter(3, 15 * 60_000) });

/**
 * Failed current-password checks of the signed-in user (change password, turn off 2FA share one budget): 5 free
 * failures, then soft backoff. Only failures count; a success clears it.
 */
const pw = globalThis as unknown as { __skPasswordFails?: Backoff };
export const passwordFails = (pw.__skPasswordFails ??= new Backoff(5));
export const passwordKey = (userId: string) => `me-pw:${userId}`;

/** "Try again in 1 minute." / "in 8 seconds." */
export function retryText(sec: number): string {
  if (sec >= 60) return `Too many attempts. Try again in ${Math.ceil(sec / 60)} ${Math.ceil(sec / 60) === 1 ? "minute" : "minutes"}.`;
  return `Too many attempts. Try again in ${sec} ${sec === 1 ? "second" : "seconds"}.`;
}
