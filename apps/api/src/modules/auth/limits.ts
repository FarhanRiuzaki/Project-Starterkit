// Rate limits and backoff in PostgreSQL, shared by every API process. Every time comes from the database clock (now()).
// Old rows are removed by the janitor, not here.
import { eq, or, isNull, lte, type SQL, sql } from "drizzle-orm";
import { db } from "../../kernel/db";
import { loginBackoff as b, rateLimits as r } from "./schema";

const ms = (n: number) => sql`(${n}::float8 * interval '1 millisecond')`;

/**
 * One attempt against `key`: at most `limit` per window of `windowMs` (the window starts at the first attempt).
 * Null = allowed, else seconds until the window ends. One atomic upsert, so concurrent attempts are counted one by one.
 */
// ponytail: fixed window (up to 2× limit across a window edge), not the mock's sliding log; fine for abuse limits.
export async function hit(key: string, limit: number, windowMs: number): Promise<number | null> {
  const over = sql`${r.windowStart} <= now() - ${ms(windowMs)}`;
  const [row] = await db.insert(r).values({ key, count: 1, windowStart: sql`now()` }).onConflictDoUpdate({
    target: r.key,
    set: {
      count: sql`case when ${over} then 1 else least(${r.count} + 1, ${limit}::int + 1) end`,
      windowStart: sql`case when ${over} then now() else ${r.windowStart} end`,
    },
  }).returning({ count: r.count, left: sql<number>`extract(epoch from ${r.windowStart} + ${ms(windowMs)} - now())::float8` });
  return row!.count > limit ? Math.max(1, Math.ceil(row!.left)) : null;
}

/** `hit` under a name of its own, so two limiters never share a key. */
export class RateLimiter {
  constructor(readonly name: string, private limit = 5, private windowMs = 60_000) {}
  hit(key: string): Promise<number | null> {
    return hit(`${this.name}:${key}`, this.limit, this.windowMs);
  }
}

/**
 * A hit on a per-client-IP limiter, under `key` (default: the IP). None when the IP is "unknown" (the web runs without
 * TRUSTED_PROXY, so no request carries one): every caller would share that one bucket and the per-IP limit would act
 * site-wide. The fleet-wide breakers and the per-account limits still apply.
 */
export const hitIp = (l: RateLimiter, ip: string, key = ip): Promise<number | null> => (ip === "unknown" ? Promise.resolve(null) : l.hit(key));

/**
 * Soft per-key backoff for failed attempts (instead of a hard lockout an attacker could trigger for a known username):
 * the first `free` failures cost nothing, then each further attempt waits 1 s, 2 s, 4 s … (max `maxMs`) after the
 * previous failure. A success, or `decayMs` without failures, clears it. `blocked_until` holds the end of the wait.
 */
export class Backoff {
  constructor(readonly name: string, private free = 3, private maxMs = 60_000, private decayMs = 15 * 60_000) {}

  private key = (k: string) => `${this.name}:${k}`;
  private decayed = () => sql`${b.lastFailureAt} < now() - ${ms(this.decayMs)}`;
  /** End of the wait after `n` failures, the last at `at` (null while failures are free). */
  private until = (n: SQL, at: SQL) => sql`case when ${n} >= ${this.free}::int
    then ${at} + least(1000 * 2 ^ least(${n} - ${this.free}::int, 20), ${this.maxMs}::float8) * interval '1 millisecond' end`;

  /** One more failure, now (a decayed record starts over); with `onlyWhenAllowed`, none while a wait runs. */
  private upsert(key: string, onlyWhenAllowed: boolean) {
    const next = sql`case when ${this.decayed()} then 1 else ${b.failures} + 1 end`;
    return db.insert(b).values({ key: this.key(key), failures: 1, blockedUntil: this.until(sql`1`, sql`now()`), lastFailureAt: sql`now()` })
      .onConflictDoUpdate({
        target: b.key,
        set: { failures: next, blockedUntil: this.until(next, sql`now()`), lastFailureAt: sql`now()` },
        setWhere: onlyWhenAllowed ? or(this.decayed(), isNull(b.blockedUntil), lte(b.blockedUntil, sql`now()`)) : undefined,
      })
      .returning({ one: sql`1` });
  }

  /** 0 = may try now; otherwise milliseconds to wait. */
  async retryAfterMs(key: string): Promise<number> {
    const [row] = await db.select({
      wait: sql<number | null>`ceil(extract(epoch from ${b.blockedUntil} - now()) * 1000)::float8`,
      decayed: sql<boolean>`${this.decayed()}`,
    }).from(b).where(eq(b.key, this.key(key)));
    return !row || row.decayed || row.wait === null ? 0 : Math.max(0, row.wait);
  }

  async fail(key: string): Promise<void> {
    await this.upsert(key, false);
  }

  /**
   * `fail` only when an attempt is allowed now, in one statement (the mock's synchronous reservation): 0 = reserved
   * (the caller then `succeed`s or `release`s it), else milliseconds to wait. Concurrent attempts queue on the row.
   */
  async reserve(key: string): Promise<number> {
    if ((await this.upsert(key, true)).length) return 0;
    return Math.max(1, await this.retryAfterMs(key));
  }

  /**
   * Undo one reserved failure (the attempt got no verdict). One UPDATE on the row's latest version, so a concurrent
   * reservation is never erased; a count of 0 is a row that blocks nothing (the janitor removes it).
   */
  async release(key: string): Promise<void> {
    await db.update(b).set({
      failures: sql`greatest(${b.failures} - 1, 0)`,
      blockedUntil: this.until(sql`(${b.failures} - 1)`, sql`${b.lastFailureAt}`),
    }).where(eq(b.key, this.key(key)));
  }

  async succeed(key: string): Promise<void> {
    await db.delete(b).where(eq(b.key, this.key(key)));
  }
}

/** ip: per client IP; breaker: fleet-wide; userCap: hard per-username cap; user: soft per-username backoff. */
export type LoginLimits = { ip: RateLimiter; breaker: RateLimiter; userCap: RateLimiter; user: Backoff };

/**
 * Gate for a sign-in step: the soft per-username backoff, then per client IP (10/min; none for an unknown IP, `hitIp`),
 * a fleet-wide breaker (300/min), a hard per-username cap (5/min), and last the backoff's attempt reserved as a failure.
 * Returns null when allowed (the caller must then `succeed` or `release` the username), else seconds to wait.
 */
export async function loginGate(l: LoginLimits, o: { step: "login" | "otp"; ip: string; username: string | null }): Promise<number | null> {
  const user = o.username?.toLowerCase() ?? null;
  if (user) {
    const wait = await l.user.retryAfterMs(user);
    if (wait > 0) return Math.ceil(wait / 1000);
  }
  const limited = (await hitIp(l.ip, o.ip, `${o.step}:${o.ip}`)) ?? (await l.breaker.hit(o.step)) ?? (user ? await l.userCap.hit(`${o.step}:${user}`) : null);
  if (limited !== null) return limited;
  if (user) {
    const wait = await l.user.reserve(user); // a concurrent attempt may have used the last free one
    if (wait > 0) return Math.ceil(wait / 1000);
  }
  return null;
}

export const loginLimits: LoginLimits = {
  ip: new RateLimiter("login-ip", 10, 60_000),
  breaker: new RateLimiter("login-breaker", 300, 60_000),
  userCap: new RateLimiter("login-user", 5, 60_000),
  user: new Backoff("login-backoff"),
};

/** OAuth starts (each stores a state row, no account needed): per client IP and fleet-wide, per minute. */
export const oauthStartLimits = { ip: new RateLimiter("oauth-start-ip", 20, 60_000), breaker: new RateLimiter("oauth-start-breaker", 300, 60_000) };

/**
 * Forgot-password requests: per client IP (10 per minute) and per email (3 per 15 minutes). A throttled request still
 * answers 200 and simply sends nothing, so the limit doesn't reveal which emails exist.
 */
export const forgotLimits = { ip: new RateLimiter("forgot-ip", 10, 60_000), email: new RateLimiter("forgot-email", 3, 15 * 60_000) };

/**
 * Failed current-password checks of the signed-in user, keyed by user id (change password, turn off 2FA and email
 * change share one budget): 5 free failures, then soft backoff. Only failures count; a success clears it.
 */
export const passwordFails = new Backoff("me-pw", 5);

/** "Try again in 1 minute." / "in 8 seconds." */
export function retryText(sec: number): string {
  if (sec >= 60) return `Too many attempts. Try again in ${Math.ceil(sec / 60)} ${Math.ceil(sec / 60) === 1 ? "minute" : "minutes"}.`;
  return `Too many attempts. Try again in ${sec} ${sec === 1 ? "second" : "seconds"}.`;
}
