import { beforeAll, describe, expect, it } from "bun:test";
import { sql } from "../db/client";
import { resetData, signIn } from "../../test/app";
import { hashToken } from "./crypto";
import { createSession, deviceOf, endSession, endUserSessions, resolveSession } from "./sessions";

beforeAll(resetData);

const rowOf = async (token: string) => (await sql`select * from sessions where token_hash = ${hashToken(token)}`)[0];

describe("sessions", () => {
  it("a new session resolves with the user's current permissions", async () => {
    const token = await signIn("viewer");
    const a = await resolveSession(token);
    expect(a?.user).toMatchObject({ username: "viewer", email: "viewer@example.com", roles: ["Viewer"], isActive: true, connected: [] });
    expect([...a!.perms].sort()).toEqual(["audit.view", "user.view"]);
    const row = await rowOf(token);
    expect(a?.sid).toBe(row.id);
    expect(row).toMatchObject({ device: "Unknown device", ip: "127.0.0.1", method: "password" });
    expect(row.expires_at.getTime() - row.created_at.getTime()).toBe(12 * 3_600_000); // SESSION_TTL_HOURS
    expect(await resolveSession("not-a-token")).toBeNull();
  });

  it("a role change applies on the next resolve", async () => {
    const token = await signIn("viewer");
    const a = (await resolveSession(token))!;
    await sql`insert into user_roles (user_id, role_id) select ${a.user.id}, id from roles where name = 'Admin'`;
    const b = (await resolveSession(token))!;
    expect(b.user.roles).toEqual(["Admin", "Viewer"]);
    expect(b.perms.has("user.edit")).toBe(true);
    await sql`delete from user_roles where user_id = ${a.user.id} and role_id = (select id from roles where name = 'Admin')`;
    expect((await resolveSession(token))!.perms.has("user.edit")).toBe(false);
  });

  it("an inactive user resolves null", async () => {
    const token = await signIn("admin");
    await sql`update users set is_active = false where username = 'admin'`;
    try {
      expect(await resolveSession(token)).toBeNull();
    } finally {
      await sql`update users set is_active = true where username = 'admin'`;
    }
  });

  it("expired and idle sessions resolve null and their rows are gone", async () => {
    const expired = await signIn("viewer");
    await sql`update sessions set expires_at = now() - interval '1 second' where token_hash = ${hashToken(expired)}`;
    const idle = await signIn("viewer");
    await sql`update sessions set last_seen_at = now() - interval '121 minutes' where token_hash = ${hashToken(idle)}`; // SESSION_IDLE_MINUTES 120
    const edge = await signIn("viewer");
    await sql`update sessions set last_seen_at = now() - interval '119 minutes' where token_hash = ${hashToken(edge)}`;
    expect(await resolveSession(expired)).toBeNull();
    expect(await resolveSession(idle)).toBeNull();
    expect(await rowOf(expired)).toBeUndefined();
    expect(await rowOf(idle)).toBeUndefined();
    expect(await resolveSession(edge)).not.toBeNull();
  });

  it("last_seen_at is written at most once per 60 s", async () => {
    const token = await signIn("viewer");
    await sql`update sessions set last_seen_at = now() - interval '30 seconds' where token_hash = ${hashToken(token)}`;
    const before = (await rowOf(token)).last_seen_at.getTime();
    await resolveSession(token);
    expect((await rowOf(token)).last_seen_at.getTime()).toBe(before);
    await sql`update sessions set last_seen_at = now() - interval '61 seconds' where token_hash = ${hashToken(token)}`;
    await resolveSession(token);
    expect(Date.now() - (await rowOf(token)).last_seen_at.getTime()).toBeLessThan(5_000);
  });

  it("endSession and endUserSessions remove sessions (except the one kept)", async () => {
    const a = await signIn("admin"), b = await signIn("admin"), c = await signIn("admin");
    const keep = (await resolveSession(b))!.sid;
    await endSession((await resolveSession(a))!.sid);
    expect(await resolveSession(a)).toBeNull();
    const userId = (await resolveSession(c))!.user.id;
    await sql.begin((tx) => endUserSessions(tx, userId, keep));
    expect(await resolveSession(c)).toBeNull();
    expect(await resolveSession(b)).not.toBeNull();
    await sql.begin((tx) => endUserSessions(tx, userId));
    expect(await resolveSession(b)).toBeNull();
  });

  it("createSession stores the device name of the user agent", async () => {
    const [u] = await sql`select id from users where username = 'viewer'`;
    const s = await sql.begin((tx) => createSession(tx, { userId: u.id, method: "google", client: { ip: "10.0.0.1", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36" } }));
    expect(await rowOf(s.token)).toMatchObject({ id: s.id, device: "Chrome on macOS", method: "google", ip: "10.0.0.1" });
    expect(Date.parse(s.expiresAt)).toBeGreaterThan(Date.now());
    expect(deviceOf("")).toBe("Unknown device");
  });
});
