import { beforeAll, describe, expect, it } from "bun:test";
import { and, eq, sql } from "drizzle-orm";
import { resetData, signIn } from "../../../../../test/helpers/app";
import { hashToken } from "../../../../kernel/crypto";
import { db } from "../../../../kernel/db";
import { roles, userRoles } from "../../../rbac";
import { users } from "../../../users";
import { sessions } from "../../schema";
import { createSession, deviceOf, endSession, endUserSessions, resolveSession } from "../../sessions";

beforeAll(resetData);

const rowOf = async (token: string) => (await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(token))))[0]!;
const byToken = (token: string) => eq(sessions.tokenHash, hashToken(token));
const ago = (interval: string) => sql`now() - ${interval}::interval`;
const roleId = async (name: string) => (await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)))[0]!.id;

describe("sessions", () => {
  it("a new session resolves with the user's current permissions", async () => {
    const token = await signIn("viewer");
    const a = await resolveSession(token);
    expect(a?.user).toMatchObject({ username: "viewer", email: "viewer@example.com", roles: ["Viewer"], isActive: true, connected: [] });
    expect([...a!.perms].sort()).toEqual(["audit.view", "user.view"]);
    const row = await rowOf(token);
    expect(a?.sid).toBe(row.id);
    expect(row).toMatchObject({ device: "Unknown device", ip: "127.0.0.1", method: "password" });
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(12 * 3_600_000); // SESSION_TTL_HOURS
    expect(await resolveSession("not-a-token")).toBeNull();
  });

  it("a role change applies on the next resolve", async () => {
    const token = await signIn("viewer");
    const a = (await resolveSession(token))!;
    await db.insert(userRoles).values({ userId: a.user.id, roleId: await roleId("Admin") });
    const b = (await resolveSession(token))!;
    expect(b.user.roles).toEqual(["Admin", "Viewer"]);
    expect(b.perms.has("user.edit")).toBe(true);
    await db.delete(userRoles).where(and(eq(userRoles.userId, a.user.id), eq(userRoles.roleId, await roleId("Admin"))));
    expect((await resolveSession(token))!.perms.has("user.edit")).toBe(false);
  });

  it("an inactive user resolves null", async () => {
    const token = await signIn("admin");
    await db.update(users).set({ isActive: false }).where(eq(users.username, "admin"));
    try {
      expect(await resolveSession(token)).toBeNull();
    } finally {
      await db.update(users).set({ isActive: true }).where(eq(users.username, "admin"));
    }
  });

  it("expired and idle sessions resolve null and their rows are gone", async () => {
    const expired = await signIn("viewer");
    await db.update(sessions).set({ expiresAt: ago("1 second") }).where(byToken(expired));
    const idle = await signIn("viewer");
    await db.update(sessions).set({ lastSeenAt: ago("121 minutes") }).where(byToken(idle)); // SESSION_IDLE_MINUTES 120
    const edge = await signIn("viewer");
    await db.update(sessions).set({ lastSeenAt: ago("119 minutes") }).where(byToken(edge));
    expect(await resolveSession(expired)).toBeNull();
    expect(await resolveSession(idle)).toBeNull();
    expect(await rowOf(expired)).toBeUndefined();
    expect(await rowOf(idle)).toBeUndefined();
    expect(await resolveSession(edge)).not.toBeNull();
  });

  it("last_seen_at is written at most once per 60 s", async () => {
    const token = await signIn("viewer");
    await db.update(sessions).set({ lastSeenAt: ago("30 seconds") }).where(byToken(token));
    const before = (await rowOf(token)).lastSeenAt.getTime();
    await resolveSession(token);
    expect((await rowOf(token)).lastSeenAt.getTime()).toBe(before);
    await db.update(sessions).set({ lastSeenAt: ago("61 seconds") }).where(byToken(token));
    await resolveSession(token);
    expect(Date.now() - (await rowOf(token)).lastSeenAt.getTime()).toBeLessThan(5_000);
  });

  it("endSession and endUserSessions remove sessions (except the one kept)", async () => {
    const a = await signIn("admin"), b = await signIn("admin"), c = await signIn("admin");
    const keep = (await resolveSession(b))!.sid;
    await endSession((await resolveSession(a))!.sid);
    expect(await resolveSession(a)).toBeNull();
    const userId = (await resolveSession(c))!.user.id;
    await db.transaction((tx) => endUserSessions(tx, userId, keep));
    expect(await resolveSession(c)).toBeNull();
    expect(await resolveSession(b)).not.toBeNull();
    await db.transaction((tx) => endUserSessions(tx, userId));
    expect(await resolveSession(b)).toBeNull();
  });

  it("createSession stores the device name of the user agent", async () => {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.username, "viewer"));
    const s = await db.transaction((tx) => createSession(tx, { userId: u!.id, method: "google", client: { ip: "10.0.0.1", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36" } }));
    expect(await rowOf(s.token)).toMatchObject({ id: s.id, device: "Chrome on macOS", method: "google", ip: "10.0.0.1" });
    expect(Date.parse(s.expiresAt)).toBeGreaterThan(Date.now());
    expect(deviceOf("")).toBe("Unknown device");
  });
});
