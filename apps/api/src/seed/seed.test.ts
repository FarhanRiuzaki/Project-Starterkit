import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { PERMISSIONS } from "@starterkit/shared/permissions";
import { truncateAll } from "../../test/db";
import { decryptSecret } from "../auth/crypto";
import { verifyPassword } from "../auth/password";
import { sql } from "../db/client";
import { log } from "../log";
import { seedDemo } from "./demo";
import { seedSystem } from "./system";

// Explicit env: never the SEED_SUPERADMIN_* values bun test loads from apps/api/.env.
const OWNER = { SEED_SUPERADMIN_NAME: "Seed Owner", SEED_SUPERADMIN_EMAIL: "Owner@Example.test", SEED_SUPERADMIN_USERNAME: "owner", SEED_SUPERADMIN_PASSWORD: "Owner-Password-1!" };

const snapshot = async () => ({
  permissions: await sql`select * from permissions order by position`,
  roles: await sql`select r.name, r.locked, r.created_at, array(select permission from role_permissions where role_id = r.id order by 1) as perms from roles r order by name`,
  users: await sql`select u.*, array(select r.name from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = u.id) as roles from users u order by email`,
});

beforeEach(truncateAll);

describe("seedSystem", () => {
  it("system seed twice changes nothing", async () => {
    await seedSystem(sql, OWNER);
    const first = await snapshot();
    expect(first.permissions.map((p: { name: string }) => p.name)).toEqual([...PERMISSIONS]);
    expect(first.roles.map((r: { name: string; locked: boolean; perms: string[] }) => [r.name, r.locked, r.perms])).toEqual([
      ["Admin", false, ["audit.view", "user.create", "user.delete", "user.edit", "user.view"]],
      ["Superadmin", true, [...PERMISSIONS].sort()],
      ["Viewer", false, ["audit.view", "user.view"]],
    ]);
    expect(first.users).toHaveLength(1);
    expect(first.users[0]).toMatchObject({ name: "Seed Owner", email: "Owner@Example.test", username: "owner", is_active: true, roles: ["Superadmin"] });
    expect(await verifyPassword("Owner-Password-1!", first.users[0].password_hash)).toBe(true);
    await seedSystem(sql, OWNER);
    expect(await snapshot()).toEqual(first);
  });

  it("an existing user with the superadmin email keeps its password and roles", async () => {
    await seedSystem(sql, {});
    expect(await sql`select 1 from users`).toHaveLength(0);
    await sql`insert into users (id, name, username, email, password_hash) values (${Bun.randomUUIDv7()}, 'Someone', 'someone', 'owner@example.test', 'kept')`;
    await seedSystem(sql, OWNER);
    const [u] = await sql`select u.username, u.password_hash, (select count(*)::int from user_roles where user_id = u.id) as roles from users u`;
    expect(u).toEqual({ username: "someone", password_hash: "kept", roles: 0 });
  });

  it("password policy: production refuses a short password, elsewhere it is one warning", async () => {
    const short = { ...OWNER, SEED_SUPERADMIN_PASSWORD: "Sh0rt-pw!" };
    const err = await seedSystem(sql, { ...short, NODE_ENV: "production" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).not.toContain("Sh0rt-pw!");
    expect(await sql`select 1 from users`).toHaveLength(0);
    const warn = spyOn(log, "warn");
    try {
      await seedSystem(sql, { ...short, NODE_ENV: "development" });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warn.mock.calls)).not.toContain("Sh0rt-pw!");
    } finally {
      warn.mockRestore();
    }
    expect(await sql`select 1 from users`).toHaveLength(1);
  });
});

describe("seedDemo", () => {
  it("demo accounts sign in with Password123!", async () => {
    await seedSystem(sql, {});
    await seedDemo(sql);
    const users = await sql`select u.*, array(select r.name from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = u.id) as roles from users u`;
    const by = (k: string) => users.find((u: { username: string }) => u.username === k);
    for (const [k, role] of [["superadmin", "Superadmin"], ["admin", "Admin"], ["viewer", "Viewer"], ["twofa", "Admin"], ["inactive", "Viewer"], ["google", "Viewer"], ["apple", "Viewer"]]) {
      expect(by(k!)).toMatchObject({ email: `${k}@example.com`, roles: [role] });
      expect(await verifyPassword("Password123!", by(k!).password_hash)).toBe(true);
    }
    expect(by("inactive")).toMatchObject({ is_active: false, last_login_at: null });
    expect(by("ldap")).toMatchObject({ is_ldap: true, password_hash: null, roles: ["Viewer"] });
    expect(decryptSecret(by("twofa").totp_secret)).toBe("JBSWY3DPEHPK3PXP");
    const codes = await sql`select code_hash from recovery_codes where user_id = ${by("twofa").id}`;
    expect(codes).toHaveLength(8);
    for (const code of ["aaaa-1111", "hhhh-8888"]) {
      const hits = await Promise.all(codes.map((c: { code_hash: string }) => verifyPassword(code, c.code_hash)));
      expect(hits.filter(Boolean)).toHaveLength(1);
    }
    expect(await sql`select provider, subject, email from user_identities order by provider`).toEqual([
      { provider: "apple", subject: "mock-apple-demo", email: "apple@example.com" },
      { provider: "google", subject: "mock-google-demo", email: "google@example.com" },
    ]);
    const [n] = await sql`select (select count(*)::int from users) as users, (select count(*)::int from activity) as activity, (select count(*)::int from auth_log) as auth`;
    expect(n).toEqual({ users: 50, activity: 200, auth: 300 });
  });

  it("the generator is deterministic", async () => {
    await seedSystem(sql, {});
    await seedDemo(sql);
    const names = async () => (await sql`select name, username, is_active from users order by username`).map((r: object) => Object.values(r).join("|"));
    const first = await names();
    await truncateAll();
    await seedSystem(sql, {});
    await seedDemo(sql);
    expect(await names()).toEqual(first);
  });

  it("production refuses demo", async () => {
    await seedSystem(sql, {});
    const err = await seedDemo(sql, { NODE_ENV: "production" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(await sql`select 1 from users`).toHaveLength(0);
  });
});
