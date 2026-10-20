import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { asc, count, DrizzleQueryError, sql } from "drizzle-orm";
import { runJanitor, startJanitor } from "../../src/db/janitor";
import { config } from "../../src/kernel/config";
import { db } from "../../src/kernel/db";
import { xactLock } from "../../src/kernel/locks";
import { log } from "../../src/kernel/log";
import { activity, authLog } from "../../src/modules/audit";
import { authChallenges, loginBackoff, rateLimits, sessions, userTokens } from "../../src/modules/auth";
import { oauthStates } from "../../src/modules/oauth";
import { users } from "../../src/modules/users";
import { holdTx, lockWaiters, truncateAll } from "../helpers/db";

const ago = (minutes: number) => sql`now() - make_interval(mins => ${minutes})`;
const ahead = (minutes: number) => sql`now() + make_interval(mins => ${minutes})`;
const DAY = 24 * 60;

/** One row that has ended and one that hasn't, in every table the janitor cleans; ids say which. */
async function seedRows() {
  const [u1, u2] = [Bun.randomUUIDv7(), Bun.randomUUIDv7()];
  await db.insert(users).values([u1, u2].map((id, i) => ({ id, name: `U${i}`, username: `u${i}`, email: `u${i}@example.test`, passwordHash: "x" })));
  const s = (id: string, expiresAt = ahead(60), lastSeenAt = ago(0)) => ({ id, tokenHash: Buffer.from(id), userId: u1, method: "password", device: "d", ip: "1.1.1.1", expiresAt, lastSeenAt });
  const live = Bun.randomUUIDv7();
  await db.insert(sessions).values([s(live), s(Bun.randomUUIDv7(), ago(1)), s(Bun.randomUUIDv7(), ahead(60), ago(config().SESSION_IDLE_MINUTES + 1))]);
  await db.insert(authChallenges).values([
    { id: "00000000-0000-7000-8000-000000000001", tokenHash: Buffer.from("c-live"), userId: u1, method: "password", expiresAt: ahead(5) },
    { id: "00000000-0000-7000-8000-000000000002", tokenHash: Buffer.from("c-old"), userId: u1, method: "password", expiresAt: ago(1) },
  ]);
  await db.insert(userTokens).values([
    { tokenHash: Buffer.from("t-live"), userId: u1, kind: "reset", expiresAt: ahead(5) },
    { tokenHash: Buffer.from("t-old"), userId: u2, kind: "invite", expiresAt: ago(1) },
  ]);
  await db.insert(rateLimits).values([
    { key: "live", count: 1, windowStart: ago(10) },
    { key: "old", count: 1, windowStart: ago(61) },
  ]);
  await db.insert(loginBackoff).values([
    { key: "live", failures: 4, blockedUntil: ahead(1), lastFailureAt: ago(5) },
    { key: "old", failures: 4, blockedUntil: ago(15), lastFailureAt: ago(16) },
  ]);
  const st = (key: string, expiresAt: ReturnType<typeof sql>) => ({ stateHash: Buffer.from(key), provider: "google", mode: "login", bindingHash: Buffer.from("b"), codeVerifier: "v", nonce: "n", expiresAt });
  await db.insert(oauthStates).values([st("live", ahead(5)), st("old", ago(1))]);
  const keep = ago((config().AUDIT_RETENTION_DAYS - 1) * DAY);
  const old = ago((config().AUDIT_RETENTION_DAYS + 1) * DAY);
  const a = (targetId: string, at: ReturnType<typeof sql>) => ({ id: Bun.randomUUIDv7(), at, actorName: "x", action: "user.edit", targetType: "user", targetId, targetLabel: "x" });
  await db.insert(activity).values([a("live", keep), a("old", old)]);
  const l = (login: string, at: ReturnType<typeof sql>) => ({ id: Bun.randomUUIDv7(), at, event: "login_failed", login, method: "password", ip: "1.1.1.1", device: "d" });
  await db.insert(authLog).values([l("live", keep), l("old", old)]);
  return { live };
}

/** What is left of every table the janitor cleans. */
const left = async () => ({
  sessions: (await db.select({ id: sessions.id }).from(sessions)).map((r) => r.id),
  challenges: (await db.select({ id: authChallenges.id }).from(authChallenges)).map((r) => r.id),
  tokens: (await db.select({ h: userTokens.tokenHash }).from(userTokens)).map((r) => r.h.toString()),
  limits: (await db.select({ k: rateLimits.key }).from(rateLimits)).map((r) => r.k),
  backoff: (await db.select({ k: loginBackoff.key }).from(loginBackoff)).map((r) => r.k),
  states: (await db.select({ h: oauthStates.stateHash }).from(oauthStates)).map((r) => r.h.toString()),
  activity: (await db.select({ t: activity.targetId }).from(activity).orderBy(asc(activity.targetId))).map((r) => r.t),
  authLog: (await db.select({ l: authLog.login }).from(authLog)).map((r) => r.l),
});

beforeEach(truncateAll);

describe("runJanitor", () => {
  it("deletes only the rows that ended and returns how many per table", async () => {
    const { live } = await seedRows();
    expect(await runJanitor()).toEqual({
      sessions: 2, auth_challenges: 1, user_tokens: 1, rate_limits: 1, login_backoff: 1, oauth_states: 1, activity: 1, auth_log: 1,
    });
    expect(await left()).toEqual({
      sessions: [live], challenges: ["00000000-0000-7000-8000-000000000001"], tokens: ["t-live"], limits: ["live"], backoff: ["live"],
      states: ["live"], activity: ["live"], authLog: ["live"],
    });
    // Nothing left to clean: every count is 0.
    expect(Object.values((await runJanitor())!)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("skips while another instance holds the janitor lock, and runs once it is free", async () => {
    await seedRows();
    const before = await left();
    const holder = await holdTx((tx) => xactLock(tx, "janitor"));
    try {
      expect(await runJanitor()).toBeNull();
      expect(await left()).toEqual(before);
    } finally {
      await holder.rollback();
    }
    expect((await runJanitor())?.sessions).toBe(2);
  });

  it("a retention backlog bigger than one batch (10,000 rows per table) drains over the next runs", async () => {
    const old = ago((config().AUDIT_RETENTION_DAYS + 1) * DAY);
    await db.insert(activity).select(db.select({
      id: sql`gen_random_uuid()`.as("id"), at: sql`${old} - g * interval '1 second'`.as("at"), actorId: sql`null`.as("actorId"), actorName: sql`'x'`.as("actorName"),
      action: sql`'user.edit'`.as("action"), targetType: sql`'user'`.as("targetType"), targetId: sql`'old'`.as("targetId"), targetLabel: sql`'x'`.as("targetLabel"),
      before: sql`null`.as("before"), after: sql`null`.as("after"),
    }).from(sql`generate_series(1, 10003) g`));
    await db.insert(authLog).select(db.select({
      id: sql`gen_random_uuid()`.as("id"), at: sql`${old} - g * interval '1 second'`.as("at"), event: sql`'login_failed'`.as("event"), login: sql`'old'`.as("login"),
      userId: sql`null`.as("userId"), method: sql`'password'`.as("method"), ip: sql`'1.1.1.1'`.as("ip"), device: sql`'d'`.as("device"), location: sql`null`.as("location"),
    }).from(sql`generate_series(1, 10001) g`));
    const audit = async () => { const r = await runJanitor(); return [r?.activity, r?.auth_log]; };
    expect(await audit()).toEqual([10_000, 10_000]);
    expect(await audit()).toEqual([3, 1]);
    expect(await audit()).toEqual([0, 0]);
    expect((await db.select({ n: count() }).from(activity))[0]!.n + (await db.select({ n: count() }).from(authLog))[0]!.n).toBe(0);
  });
});

describe("startJanitor", () => {
  it("runs at once; its stop function stops the timer and resolves only when the run in flight has finished", async () => {
    await seedRows();
    // An uncommitted change to the expired session: the janitor's DELETE of sessions waits for it.
    const holder = await holdTx((tx) => tx.select({ one: sql`1` }).from(sessions).where(sql`${sessions.expiresAt} < now()`).for("update"));
    let stopped = false;
    try {
      const stop = startJanitor();
      expect(await lockWaiters(1, "%delete from \"sessions\"%")).toBe(true);
      const done = stop().then(() => (stopped = true));
      await Bun.sleep(100);
      expect(stopped).toBe(false); // still waiting on the row lock
      await holder.rollback();
      await done;
    } finally {
      await holder.rollback();
    }
    expect(stopped).toBe(true);
    expect((await left()).sessions).toHaveLength(1); // the run finished: both ended sessions are gone
  });

  it("a failed run logs the driver's error (name, SQLSTATE, constraint, table), never the SQL, its parameters or detail", async () => {
    const cause = Object.assign(new Error("canceling statement due to statement timeout"), {
      name: "PostgresError", errno: "57014", table: "sessions", detail: "Key (email)=(leaked@example.com)",
    });
    const err = new DrizzleQueryError('delete from "sessions" where "user_id" = $1', ["secret-param@example.com"], cause);
    const spy = spyOn(log, "error");
    try {
      await startJanitor(() => Promise.reject(err))();
      expect(spy.mock.calls[0]![0]).toMatchObject({ err: { name: "PostgresError", code: "57014", table: "sessions" } });
      const logged = JSON.stringify(spy.mock.calls);
      for (const leak of ["secret-param", "delete from", "leaked"]) expect(logged).not.toContain(leak);
    } finally {
      spy.mockRestore();
    }
  });
});
