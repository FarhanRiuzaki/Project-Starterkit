// Port of apps/web/src/app/api/auth/auth-routes.test.ts against /v1/auth/*. The cookie becomes `token` (full session)
// or `challenge` (pending 2FA) in the answer body; same origin and CSRF are the web's checks (Task 9). Time moves by
// editing rows, since the database clock decides.
import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { PERMISSIONS } from "@starterkit/shared/permissions";
import { call, resetData, signIn } from "../../test/app";
import { config } from "../config";
import { log } from "../log";
import { sql } from "../db/client";
import { clearMail, sentMail } from "../mail/mailer";
import { LDAP_PASSWORD, SEED_PASSWORD, TOTP_SECRET } from "../seed/demo";
import { hashToken } from "./crypto";
import * as ldap from "./ldap";
import { retryText } from "./limits";
import { verifyPassword } from "./password";
import { resolveSession } from "./sessions";
import { findUser, reauth } from "./sign-in";
import { totpCode } from "./totp";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/** Answer bodies of these routes, loosely typed for assertions. */
type Answer = { next: string; token: string; challenge: string; ok: true; error: { code: string; message: string }; user: Record<string, unknown>; permissions: string[] };
type Res = Omit<Response, "json"> & { json(): Promise<Answer> };

const post = (path: string, body: unknown, o: { token?: string; challenge?: string; headers?: Record<string, string> } = {}) =>
  call("POST", `/v1/auth/${path}`, { body, token: o.token, headers: { "X-Client-Ua": UA, ...(o.challenge && { "X-Auth-Challenge": o.challenge }), ...o.headers } }) as Promise<Res>;
const signInWith = (login: string, password = SEED_PASSWORD, extra: Record<string, unknown> = {}) =>
  post("login", { method: "password", login, password, ...extra });
/** Step 1 of the 2FA account: the challenge. */
const challengeOf = async (login = "twofa@example.com") => (await (await signInWith(login)).json()).challenge;
const context = (token?: string) => call("GET", "/v1/auth/context", { token }) as Promise<Res>;
const idOf = async (username: string): Promise<string> => (await sql`select id from users where username = ${username}`)[0].id;
const sessionOf = async (token: string) => (await sql`select * from sessions where token_hash = ${hashToken(token)}`)[0];
const count = async (table: "sessions" | "auth_log" | "auth_challenges" | "user_tokens") => (await sql`select count(*)::int as n from ${sql(table)}`)[0].n as number;
const lastAuth = async () =>
  (await sql`select event, method, login, user_id as "userId", ip, device, at from auth_log order by at desc, id desc limit 1`)[0];
/** The reset token in the last mail sent. */
const mailedToken = () => {
  const link = sentMail().at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
  return link ? new URL(link).searchParams.get("token") : null;
};
/** Every soft-backoff wait has passed. */
const waitOver = () => sql`update login_backoff set blocked_until = now() - interval '1 millisecond'`;
const freshLimits = () => sql`truncate rate_limits, login_backoff`;

beforeEach(async () => {
  await resetData();
  clearMail();
});

describe("POST /v1/auth/login", () => {
  it("unknown user, wrong password, and LDAP user via password method give identical 401 bodies", async () => {
    const answers = [
      await signInWith("nobody@example.com", "Whatever-123"),
      await signInWith("admin@example.com", "Wrong-password-1"),
      await signInWith("ldap@example.com", LDAP_PASSWORD),
      await post("login", { method: "ldap", login: "admin@example.com", password: SEED_PASSWORD }),
    ];
    const bodies = await Promise.all(answers.map((r) => r.text()));
    expect(answers.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!).error.code).toBe("invalid_credentials");
    expect(await count("sessions")).toBe(0);
    expect(await count("auth_challenges")).toBe(0);
  });

  it("password and LDAP users get a full session with a store record, device and lastLoginAt", async () => {
    const [before] = await sql`select last_login_at from users where username = 'admin'`;
    const r = await signInWith("ADMIN@example.com");
    expect(r.status).toBe(200);
    const { next, token } = await r.json();
    expect(next).toBe("/");
    expect(await sessionOf(token)).toMatchObject({ user_id: await idOf("admin"), device: "Chrome on macOS", ip: "unknown", method: "password" });
    const [after] = await sql`select last_login_at from users where username = 'admin'`;
    expect(after.last_login_at.getTime()).toBeGreaterThan(before.last_login_at.getTime());
    expect((await context(token)).status).toBe(200);

    const l = await post("login", { method: "ldap", login: "ldap", password: LDAP_PASSWORD });
    expect(l.status).toBe(200);
    expect(await sessionOf((await l.json()).token)).toMatchObject({ user_id: await idOf("ldap"), method: "ldap" });
    // The mock also ended the browser's previous session here: the cookie is the web's (Task 9).
  });

  it("inactive user with correct password gets 403 account_inactive", async () => {
    const r = await signInWith("inactive@example.com");
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("account_inactive");
    expect(await count("sessions")).toBe(0);
    const wrong = await signInWith("inactive@example.com", "Wrong-password-1");
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error.code).toBe("invalid_credentials");
  });

  it("malformed body is 400 bad_request", async () => {
    const r = await post("login", { method: "kerberos", login: "admin", password: "x" });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("bad_request");
  });

  it("unknown login and wrong password both run one argon2 verify", async () => {
    const spy = spyOn(Bun.password, "verify");
    try {
      expect((await signInWith("nobody@example.com", "Whatever-123")).status).toBe(401);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockClear();
      expect((await signInWith("admin@example.com", "Wrong-password-1")).status).toBe(401);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("fix round 1 (review)", () => {
  it("method ldap costs one directory check for an unknown login, a password user and an LDAP user", async () => {
    const spy = spyOn(ldap.directory()!, "verify"); // LDAP_MOCK=true: one shared mock directory
    try {
      const statuses = [];
      for (const login of [" nobody ", "admin@example.com", "LDAP"]) statuses.push((await post("login", { method: "ldap", login, password: LDAP_PASSWORD })).status);
      expect(statuses).toEqual([401, 401, 200]);
      expect(spy.mock.calls.map((c) => c[0])).toEqual(["nobody", "admin@example.com", "ldap"]);
    } finally {
      spy.mockRestore();
    }
  });

  it("method ldap without a directory runs one dummy argon2 verify", async () => {
    const dir = spyOn(ldap, "directory").mockReturnValue(null);
    const verify = spyOn(Bun.password, "verify");
    try {
      expect((await post("login", { method: "ldap", login: "ldap", password: LDAP_PASSWORD })).status).toBe(401);
      expect(verify).toHaveBeenCalledTimes(1);
    } finally {
      dir.mockRestore();
      verify.mockRestore();
    }
  });

  it("a wrong 6-digit code runs no recovery-code verify", async () => {
    const challenge = await challengeOf();
    const now = Date.now();
    const valid = new Set([-30_000, 0, 30_000].map((d) => totpCode(TOTP_SECRET, now + d)));
    const wrong = ["000000", "111111", "222222", "333333"].find((c) => !valid.has(c))!;
    const spy = spyOn(Bun.password, "verify");
    try {
      const r = await post("2fa", { code: wrong }, { challenge });
      expect(r.status).toBe(400);
      expect(spy).toHaveBeenCalledTimes(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("one recovery code on two challenges in parallel: one 200, one 400", async () => {
    const [a, b] = [await challengeOf(), await challengeOf()];
    const answers = await Promise.all([a, b].map((challenge) => post("2fa", { code: "cccc-3333" }, { challenge })));
    expect(answers.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(await count("sessions")).toBe(1);
  });

  it("two parallel finishes of one challenge give one session", async () => {
    const challenge = await challengeOf();
    const answers = await Promise.all(["dddd-4444", "eeee-5555"].map((code) => post("2fa", { code }, { challenge })));
    expect(answers.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(await count("sessions")).toBe(1);
  });
});

describe("two-factor sign-in", () => {
  it("2FA user gets next=/login/2fa and the pending cookie cannot call GET /api/users (401)", async () => {
    const r = await signInWith("twofa@example.com");
    expect(r.status).toBe(200);
    const body = await r.json();
    expect<unknown>(body).toEqual({ next: "/login/2fa", challenge: expect.any(String) });
    const [row] = await sql`select user_id, method, expires_at - created_at as ttl from auth_challenges where token_hash = ${hashToken(body.challenge)}`;
    expect(row).toMatchObject({ user_id: await idOf("twofa"), method: "password" });
    expect(row.ttl).toBe("00:10:00");
    expect(await count("sessions")).toBe(0);
    expect((await context(body.challenge)).status).toBe(401); // a challenge is no session

    const deep = await signInWith("twofa@example.com", SEED_PASSWORD, { next: "/users?page=2" });
    expect((await deep.json()).next).toBe("/login/2fa?next=%2Fusers%3Fpage%3D2");
  });

  it("valid TOTP completes sign-in; reused recovery code is rejected", async () => {
    const challenge = await challengeOf();
    const r = await post("2fa", { code: totpCode(TOTP_SECRET), next: "/users" }, { challenge });
    expect(r.status).toBe(200);
    const { next, token } = await r.json();
    expect(next).toBe("/users");
    expect((await sessionOf(token)).user_id).toBe(await idOf("twofa"));
    expect(await count("auth_challenges")).toBe(0); // deleted on success
    expect((await context(token)).status).toBe(200);

    const unused = async () => (await sql`select count(*)::int as n from recovery_codes where used_at is null`)[0].n as number;
    const codesBefore = await unused();
    expect((await post("2fa", { code: "AAAA-1111" }, { challenge: await challengeOf() })).status).toBe(200);
    expect(await unused()).toBe(codesBefore - 1);
    const sessions = await count("sessions");
    const again = await post("2fa", { code: "aaaa-1111" }, { challenge: await challengeOf() });
    expect(again.status).toBe(400);
    expect((await again.json()).error.code).toBe("invalid_code");
    expect(await count("sessions")).toBe(sessions);
  });

  it("2FA without a pending sign-in is 401", async () => {
    for (const challenge of [undefined, "not-a-challenge"]) {
      const r = await post("2fa", { code: totpCode(TOTP_SECRET) }, { challenge });
      expect(r.status).toBe(401);
      expect((await r.json()).error.code).toBe("unauthenticated");
    }
  });
});

describe("logout", () => {
  // The CSRF check and the cookie are the web's (Task 9); the API ends the session the bearer names.
  it("needs the CSRF token, ends the store session and clears the cookie", async () => {
    const { token } = await (await signInWith("admin@example.com")).json();
    expect(await sessionOf(token)).toBeDefined();
    const r = await post("logout", undefined, { token });
    expect(r.status).toBe(200);
    expect<unknown>(await r.json()).toEqual({ ok: true });
    expect(await sessionOf(token)).toBeUndefined();
    expect((await context(token)).status).toBe(401);
    expect<unknown>(await (await post("logout", undefined)).json()).toEqual({ ok: true }); // nothing to end
  });

  it("a pending 2FA sign-in can cancel without a token", async () => {
    const challenge = await challengeOf();
    expect((await post("logout", undefined, { challenge })).status).toBe(200);
    expect(await count("auth_challenges")).toBe(0);
    expect((await post("2fa", { code: totpCode(TOTP_SECRET) }, { challenge })).status).toBe(401);
  });
});

describe("password reset", () => {
  it("forgot-password answers the same for unknown and known emails", async () => {
    const spy = spyOn(log, "info");
    const known = await post("forgot", { email: "admin@example.com" });
    const lines = JSON.stringify(spy.mock.calls);
    spy.mockRestore();
    expect(mailedToken()).toBeTruthy();
    expect(lines).toContain('"mail"');
    expect(lines).not.toContain(mailedToken()!); // the log line never holds the token
    expect(sentMail()[0]!.text).toContain(`${config().APP_URL}/reset-password?token=`);
    clearMail();
    const unknown = await post("forgot", { email: "nobody@example.com" });
    const ldap = await post("forgot", { email: "ldap@example.com" });
    expect(sentMail()).toEqual([]);
    expect([known.status, unknown.status, ldap.status]).toEqual([200, 200, 200]);
    const bodies = await Promise.all([known.text(), unknown.text(), ldap.text()]);
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!)).toEqual({ ok: true });
    expect(bodies[0]).not.toContain("token");
  });

  it("reset token works once and expires after 30 minutes", async () => {
    await post("forgot", { email: "admin@example.com" });
    const token = mailedToken()!;
    const [row] = await sql`select token_hash, kind, extract(epoch from expires_at - now())::float8 as left from user_tokens`;
    expect(row.token_hash).toEqual(hashToken(token)); // stored hashed
    expect(row.kind).toBe("reset");
    expect(row.left).toBeWithin(30 * 60 - 5, 30 * 60 + 1);

    expect((await post("reset", { token, password: "short-pass1" })).status).toBe(400); // 11 chars: bad_request, token kept
    const r = await post("reset", { token, password: "New-password-2026" });
    expect(r.status).toBe(200);
    const reuse = await post("reset", { token, password: "New-password-2026" });
    expect(reuse.status).toBe(400);
    expect((await reuse.json()).error.code).toBe("invalid_code");
    expect((await signInWith("admin@example.com", "New-password-2026")).status).toBe(200);

    await post("forgot", { email: "viewer@example.com" });
    const late = mailedToken()!;
    await sql`update user_tokens set expires_at = now() - interval '1 millisecond'`;
    const expired = await post("reset", { token: late, password: "New-password-2026" });
    expect(expired.status).toBe(400);
    expect((await expired.json()).error.code).toBe("invalid_code");
    expect(await count("user_tokens")).toBe(0); // spent even when expired
  });

  it("reset ends the user's sessions", async () => {
    const token = await signIn("viewer@example.com");
    await post("forgot", { email: "viewer@example.com" });
    expect((await post("reset", { token: mailedToken()!, password: "New-password-2026" })).status).toBe(200);
    expect(await resolveSession(token)).toBeNull();
    expect(await sessionOf(token)).toBeUndefined();
  });

  it("forgot for an unknown, an LDAP and a throttled email sends no mail and answers the same body", async () => {
    await sql`update users set password_hash = null where username = 'google'`; // Google-only: no password to reset
    const ask = (email: string, ip = "10.0.0.1") => post("forgot", { email }, { headers: { "X-Client-Ip": ip } });
    for (let i = 0; i < 3; i++) await ask("admin@example.com", `10.0.1.${i}`);
    expect(sentMail()).toHaveLength(3);
    clearMail();
    const answers = [
      await ask("nobody@example.com"), await ask("ldap@example.com"), await ask("google@example.com"),
      await ask("inactive@example.com"), await ask("ADMIN@example.com"), // the 4th for admin in 15 minutes
    ];
    expect(answers.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(await Promise.all(answers.map((r) => r.text())))).toEqual(new Set(['{"ok":true}']));
    expect(sentMail()).toEqual([]);
    expect(await count("user_tokens")).toBe(1); // admin's third link only
  });

  it("a reset token works once", async () => {
    await post("forgot", { email: "viewer@example.com" });
    const token = mailedToken()!;
    const answers = await Promise.all([1, 2, 3].map(() => post("reset", { token, password: "New-password-2026" })));
    expect(answers.map((r) => r.status).sort()).toEqual([200, 400, 400]);
  });

  it("an invitation token (72 h) sets the password and nothing else; a directory user's token is invalid_code", async () => {
    const invited = await idOf("viewer");
    await sql`update users set password_hash = null where id = ${invited}`;
    const [before] = await sql`select is_active, updated_at from users where id = ${invited}`;
    await sql`insert into user_tokens (token_hash, user_id, kind, expires_at) values (${hashToken("invite-1")}, ${invited}, 'invite', now() + interval '72 hours')`;
    expect((await post("reset", { token: "invite-1", password: "New-password-2026" })).status).toBe(200);
    const [after] = await sql`select is_active, updated_at, password_hash from users where id = ${invited}`;
    expect(await verifyPassword("New-password-2026", after.password_hash)).toBe(true);
    expect({ is_active: after.is_active, updated_at: after.updated_at }).toEqual(before);

    await sql`insert into user_tokens (token_hash, user_id, kind, expires_at) values (${hashToken("ldap-1")}, ${await idOf("ldap")}, 'reset', now() + interval '30 minutes')`;
    const r = await post("reset", { token: "ldap-1", password: "New-password-2026" });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("invalid_code");
    expect(await count("user_tokens")).toBe(0);
  });
});

describe("redirects", () => {
  // OAuth sign-in comes with Task 10; its half of the mock's "login and OAuth honour next" test moves there.
  it("login honours next only for internal paths", async () => {
    const cases: [string, string][] = [
      ["//evil.com", "/"], ["/\\evil", "/"], ["https://x", "/"], ["%2F%2Fevil", "/"], ["/a/..//evil", "/"], ["/login", "/"],
      ["/users?page=2", "/users?page=2"],
    ];
    for (const [next, want] of cases) {
      await freshLimits();
      expect((await (await signInWith("admin@example.com", SEED_PASSWORD, { next })).json()).next).toBe(want);
    }
  });
});

describe("rate limit and sign-in log", () => {
  it("6th failed attempt for one username within a minute is 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      await waitOver(); // past the soft backoff (1 s, 2 s, 4 s), inside the 1-minute cap
      statuses.push((await signInWith("admin@example.com", `Wrong-password-${i}`)).status);
    }
    await waitOver();
    const sixth = await signInWith("admin@example.com", SEED_PASSWORD);
    expect(statuses).toEqual([401, 401, 401, 401, 401]);
    expect(sixth.status).toBe(429);
    // Retry-After = the seconds left in the 1-minute window (Task 3 ruling; the mock sent a fixed 60).
    const sec = Number(sixth.headers.get("retry-after"));
    expect(sec).toBeWithin(50, 61);
    expect<unknown>(await sixth.json()).toEqual({ error: { code: "rate_limited", message: retryText(sec) } });
  });

  it("every attempt writes one auth log entry with method and event", async () => {
    let challenge = "";
    let token = "";
    const steps: [() => Promise<unknown>, string, string][] = [
      [() => signInWith("nobody@example.com", "Whatever-123"), "login_failed", "password"],
      [() => signInWith("inactive@example.com"), "login_failed", "password"],
      [() => post("login", { method: "ldap", login: "ldap@example.com", password: LDAP_PASSWORD }), "login_success", "ldap"],
      [async () => (challenge = await challengeOf()), "password_ok", "password"],
      [() => post("2fa", { code: "zzzz-0000" }, { challenge }), "2fa_failed", "password"],
      [async () => (token = (await (await post("2fa", { code: totpCode(TOTP_SECRET) }, { challenge })).json()).token), "2fa_success", "password"],
    ];
    for (const [run, event, method] of steps) {
      const n = await count("auth_log");
      await run();
      expect(await count("auth_log")).toBe(n + 1);
      expect(await lastAuth()).toMatchObject({ event, method, device: "Chrome on macOS", ip: "unknown" });
    }
    const twofa = await idOf("twofa");
    expect((await lastAuth()).userId).toBe(twofa);
    const n = await count("auth_log");
    await post("logout", undefined, { token });
    expect(await count("auth_log")).toBe(n + 1);
    expect(await lastAuth()).toMatchObject({ event: "logout", method: "password", userId: twofa });
  });
});

describe("fix round 1", () => {
  it("a correct step 1 does not clear OTP failures: the next OTP attempt is still delayed", async () => {
    const first = await challengeOf();
    for (let i = 0; i < 3; i++) expect((await post("2fa", { code: `zzzz-000${i}` }, { challenge: first })).status).toBe(400);
    await waitOver(); // past the 1 s backoff, so step 1 itself may run
    const challenge = await challengeOf();
    const r = await post("2fa", { code: totpCode(TOTP_SECRET) }, { challenge });
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("a TOTP code that completed a sign-in cannot be used again", async () => {
    const code = totpCode(TOTP_SECRET);
    expect((await post("2fa", { code }, { challenge: await challengeOf() })).status).toBe(200);
    const again = await post("2fa", { code }, { challenge: await challengeOf() });
    expect(again.status).toBe(400);
    expect((await again.json()).error.code).toBe("invalid_code");
  });

  it("a pending 2FA sign-in older than 10 minutes is 401 and cleared", async () => {
    const challenge = await challengeOf();
    await sql`update auth_challenges set expires_at = now() - interval '1 millisecond'`;
    const r = await post("2fa", { code: totpCode(TOTP_SECRET) }, { challenge });
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe("unauthenticated");
    expect(await count("auth_challenges")).toBe(0);
  });
});

describe("sign-in log events and login field", () => {
  it("the password step of a 2FA account logs password_ok (not a sign-in yet); the code step logs 2fa_success", async () => {
    const twofa = await idOf("twofa");
    const challenge = await challengeOf("twofa"); // typed as the username
    expect(await lastAuth()).toMatchObject({ event: "password_ok", method: "password", login: "twofa@example.com", userId: twofa });
    expect(await sql`select 1 from auth_log where user_id = ${twofa} and event = 'login_success' and at > now() - interval '1 minute'`).toEqual([]);
    await post("2fa", { code: totpCode(TOTP_SECRET) }, { challenge });
    expect(await lastAuth()).toMatchObject({ event: "2fa_success", login: "twofa@example.com" });
  });

  it("login is the account email when the user is known, else what was typed", async () => {
    await signInWith("ADMIN", "Wrong-password-1");
    expect(await lastAuth()).toMatchObject({ event: "login_failed", login: "admin@example.com", userId: await idOf("admin") });
    await signInWith("admin");
    expect(await lastAuth()).toMatchObject({ event: "login_success", login: "admin@example.com" });
    await signInWith("Nobody-Here", "Whatever-123");
    expect(await lastAuth()).toMatchObject({ event: "login_failed", login: "Nobody-Here", userId: null });
  });

  it("a reset by link logs password_reset with the account email and user id", async () => {
    await post("forgot", { email: "VIEWER@example.com" });
    const n = await count("auth_log");
    expect((await post("reset", { token: mailedToken()!, password: "New-password-2026" })).status).toBe(200);
    expect(await count("auth_log")).toBe(n + 1);
    expect(await lastAuth()).toMatchObject({ event: "password_reset", method: "password", login: "viewer@example.com", userId: await idOf("viewer") });
  });
});

describe("forgot-password throttle", () => {
  it("per email: after 3 requests in 15 minutes the answer stays 200 but no link is sent", async () => {
    const bodies: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await post("forgot", { email: i % 2 ? "ADMIN@example.com" : "admin@example.com" }, { headers: { "X-Client-Ip": `10.0.0.${i}` } });
      expect(r.status).toBe(200);
      bodies.push(await r.text());
    }
    expect(new Set(bodies).size).toBe(1);
    expect(sentMail()).toHaveLength(3);
    await sql`update rate_limits set window_start = window_start - interval '15 minutes 1 millisecond' where key like 'forgot-email:%'`;
    await post("forgot", { email: "admin@example.com" });
    expect(sentMail()).toHaveLength(4);
  });

  it("per client IP: the 11th request in a minute sends nothing, still 200", async () => {
    for (const u of ["admin", "viewer", "twofa", "google", "apple", "admin", "viewer", "twofa", "google", "apple"]) {
      expect((await post("forgot", { email: `${u}@example.com` })).status).toBe(200);
    }
    expect(sentMail()).toHaveLength(10);
    const r = await post("forgot", { email: "superadmin@example.com" });
    expect(r.status).toBe(200);
    expect(sentMail()).toHaveLength(10);
  });
});

describe("GET /v1/auth/context", () => {
  it("context returns permissions in catalog order", async () => {
    const r = await context(await signIn("superadmin"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.permissions).toEqual([...PERMISSIONS]);
    expect(body.user).toMatchObject({ username: "superadmin", roles: ["Superadmin"], twoFactorEnabled: false });
    expect(Object.keys(body.user)).not.toContain("passwordHash");
    expect((await (await context(await signIn("viewer"))).json()).permissions).toEqual(["user.view", "audit.view"]);
    expect((await context()).status).toBe(401);
  });
});

describe("reauth", () => {
  it("a wrong password is 400 invalid_credentials, then backs off after 5; a recovery code works once; LDAP asks the directory", async () => {
    const admin = (await findUser("admin"))!;
    const err = (p: Promise<unknown>) => p.then(() => null, (e: { code: string; status: number }) => `${e.status} ${e.code}`);
    expect(await err(reauth(admin, { password: SEED_PASSWORD }))).toBeNull();
    for (let i = 0; i < 5; i++) expect(await err(reauth(admin, { password: "Wrong-password-1" }))).toBe("400 invalid_credentials");
    expect(await err(reauth(admin, { password: SEED_PASSWORD }))).toBe("429 rate_limited");

    const twofa = (await findUser("twofa@example.com"))!;
    expect(await err(reauth(twofa, { recoveryCode: "bbbb-2222" }))).toBeNull();
    expect(await err(reauth(twofa, { recoveryCode: "bbbb-2222" }))).toBe("400 invalid_code");

    const ldap = (await findUser("LDAP"))!;
    expect(await err(reauth(ldap, { password: LDAP_PASSWORD }))).toBeNull();
    expect(await err(reauth(ldap, { password: SEED_PASSWORD }))).toBe("400 invalid_credentials");
  });
});
