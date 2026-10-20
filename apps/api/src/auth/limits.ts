// PostgreSQL port of apps/web/src/lib/server/ratelimit.ts: same numbers and semantics, shared by every API process.
// Every time comes from the database clock (now()). Old rows are removed by the janitor, not here.
import { sql } from "../db/client";
import type { Fragment } from "../db/page";

const ms = (n: number) => sql`(${n}::float8 * interval '1 millisecond')`;

/**
 * One attempt against `key`: at most `limit` per window of `windowMs` (the window starts at the first attempt).
 * Null = allowed, else seconds until the window ends. One atomic upsert, so concurrent attempts are counted one by one.
 */
// ponytail: fixed window (up to 2× limit across a window edge), not the mock's sliding log; fine for abuse limits.
export async function hit(key: string, limit: number, windowMs: number): Promise<number | null> {
  const [r] = await sql`
    insert into rate_limits as r (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when r.window_start <= now() - ${ms(windowMs)} then 1 else least(r.count + 1, ${limit}::int + 1) end,
      window_start = case when r.window_start <= now() - ${ms(windowMs)} then now() else r.window_start end
    returning count, extract(epoch from window_start + ${ms(windowMs)} - now())::float8 as left`;
  return r.count > limit ? Math.max(1, Math.ceil(r.left)) : null;
}

/** `hit` under a name of its own, so two limiters never share a key. */
export class RateLimiter {
  constructor(readonly name: string, private limit = 5, private windowMs = 60_000) {}
  hit(key: string): Promise<number | null> {
    return hit(`${this.name}:${key}`, this.limit, this.windowMs);
  }
}

/**
 * Soft per-key backoff for failed attempts (instead of a hard lockout an attacker could trigger for a known username):
 * the first `free` failures cost nothing, then each further attempt waits 1 s, 2 s, 4 s … (max `maxMs`) after the
 * previous failure. A success, or `decayMs` without failures, clears it. `blocked_until` holds the end of the wait.
 */
export class Backoff {
  constructor(readonly name: string, private free = 3, private maxMs = 60_000, private decayMs = 15 * 60_000) {}

  private key = (k: string) => `${this.name}:${k}`;
  private decayed = () => sql`b.last_failure_at < now() - ${ms(this.decayMs)}`;
  /** End of the wait after `n` failures, the last at `at` (null while failures are free). */
  private until = (n: Fragment, at: Fragment) => sql`case when ${n} >= ${this.free}::int
    then ${at} + least(1000 * 2 ^ least(${n} - ${this.free}::int, 20), ${this.maxMs}::float8) * interval '1 millisecond' end`;

  /** One more failure, now (a decayed record starts over); with `onlyWhenAllowed`, none while a wait runs. */
  private upsert(key: string, onlyWhenAllowed: boolean) {
    const next = sql`case when ${this.decayed()} then 1 else b.failures + 1 end`;
    return sql`
      insert into login_backoff as b (key, failures, blocked_until, last_failure_at)
      values (${this.key(key)}, 1, ${this.until(sql`1`, sql`now()`)}, now())
      on conflict (key) do update set failures = ${next}, blocked_until = ${this.until(next, sql`now()`)}, last_failure_at = now()
      ${onlyWhenAllowed ? sql`where ${this.decayed()} or b.blocked_until is null or b.blocked_until <= now()` : sql``}
      returning 1`;
  }

  /** 0 = may try now; otherwise milliseconds to wait. */
  async retryAfterMs(key: string): Promise<number> {
    const [r] = await sql`select ceil(extract(epoch from b.blocked_until - now()) * 1000)::float8 as wait, ${this.decayed()} as decayed
      from login_backoff b where key = ${this.key(key)}`;
    return !r || r.decayed || r.wait === null ? 0 : Math.max(0, r.wait);
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
    await sql`update login_backoff b set failures = greatest(b.failures - 1, 0),
      blocked_until = ${this.until(sql`(b.failures - 1)`, sql`b.last_failure_at`)} where key = ${this.key(key)}`;
  }

  async succeed(key: string): Promise<void> {
    await sql`delete from login_backoff where key = ${this.key(key)}`;
  }
}

/** ip: per client IP; breaker: fleet-wide; userCap: hard per-username cap; user: soft per-username backoff. */
export type LoginLimits = { ip: RateLimiter; breaker: RateLimiter; userCap: RateLimiter; user: Backoff };

/**
 * Gate for a sign-in step: the soft per-username backoff, then per client IP (10/min), a fleet-wide breaker
 * (300/min), a hard per-username cap (5/min), and last the backoff's attempt reserved as a failure. Returns null when
 * allowed (the caller must then `succeed` or `release` the username), else seconds to wait.
 */
export async function loginGate(l: LoginLimits, o: { step: "login" | "otp"; ip: string; username: string | null }): Promise<number | null> {
  const user = o.username?.toLowerCase() ?? null;
  if (user) {
    const wait = await l.user.retryAfterMs(user);
    if (wait > 0) return Math.ceil(wait / 1000);
  }
  const limited = (await l.ip.hit(`${o.step}:${o.ip}`)) ?? (await l.breaker.hit(o.step)) ?? (user ? await l.userCap.hit(`${o.step}:${user}`) : null);
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

/**
 * Forgot-password requests: per client IP (10 per minute) and per email (3 per 15 minutes). A throttled request still
 * answers 200 and simply sends nothing, so the limit doesn't reveal which emails exist.
 */
/** OAuth starts (each stores a state row, no account needed): per client IP and fleet-wide, per minute. */
export const oauthStartLimits = { ip: new RateLimiter("oauth-start-ip", 20, 60_000), breaker: new RateLimiter("oauth-start-breaker", 300, 60_000) };
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
