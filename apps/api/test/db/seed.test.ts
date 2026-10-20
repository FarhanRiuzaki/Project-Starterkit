import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import path from "node:path";
import { PERMISSIONS } from "@starterkit/shared/permissions";
import { seedDemo } from "../../src/db/seed/demo";
import { seedSystem } from "../../src/db/seed/system";
import { decryptSecret } from "../../src/kernel/crypto";
import { and, asc, count, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../../src/kernel/db";
import { log } from "../../src/kernel/log";
import { activity, authLog } from "../../src/modules/audit";
import { rolesOf, verifyPassword } from "../../src/modules/auth";
import { userIdentities } from "../../src/modules/oauth";
import { permissions, rolePermissions, roles, userRoles } from "../../src/modules/rbac";
import { recoveryCodes, users } from "../../src/modules/users";
import { truncateAll } from "../helpers/db";

// Explicit env: never the SEED_SUPERADMIN_* values bun test loads from apps/api/.env.
const OWNER = { SEED_SUPERADMIN_NAME: "Seed Owner", SEED_SUPERADMIN_EMAIL: "Owner@Example.test", SEED_SUPERADMIN_USERNAME: "owner", SEED_SUPERADMIN_PASSWORD: "Owner-Password-1!" };

/** Every user with its role names. */
const usersWithRoles = () => db.select({ u: users, roles: rolesOf(users.id) }).from(users).orderBy(users.email).then((rs) => rs.map((r) => ({ ...r.u, roles: r.roles })));
const userCount = async () => (await db.select({ n: count() }).from(users))[0]!.n;

const snapshot = async () => ({
  permissions: await db.select().from(permissions).orderBy(permissions.position),
  roles: await db.select({
    name: roles.name, locked: roles.locked, createdAt: roles.createdAt,
    perms: sql<string[]>`array(${db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, roles.id)).orderBy(rolePermissions.permission)})`,
  }).from(roles).orderBy(roles.name),
  users: await usersWithRoles(),
});

beforeEach(truncateAll);

describe("seedSystem", () => {
  it("system seed twice changes nothing", async () => {
    await seedSystem(db, OWNER);
    const first = await snapshot();
    expect(first.permissions.map((p: { name: string }) => p.name)).toEqual([...PERMISSIONS]);
    expect(first.roles.map((r: { name: string; locked: boolean; perms: string[] }) => [r.name, r.locked, r.perms])).toEqual([
      ["Admin", false, ["audit.view", "user.create", "user.delete", "user.edit", "user.view"]],
      ["Superadmin", true, [...PERMISSIONS].sort()],
      ["Viewer", false, ["audit.view", "user.view"]],
    ]);
    expect(first.users).toHaveLength(1);
    expect(first.users[0]).toMatchObject({ name: "Seed Owner", email: "Owner@Example.test", username: "owner", isActive: true, roles: ["Superadmin"] });
    expect(await verifyPassword("Owner-Password-1!", first.users[0]!.passwordHash)).toBe(true);
    await seedSystem(db, OWNER);
    expect(await snapshot()).toEqual(first);
  });

  it("an existing user with the superadmin email keeps its password and roles", async () => {
    await seedSystem(db, {});
    expect(await userCount()).toBe(0);
    await db.insert(users).values({ id: Bun.randomUUIDv7(), name: "Someone", username: "someone", email: "owner@example.test", passwordHash: "kept" });
    await seedSystem(db, OWNER);
    const u = await db.select({ username: users.username, passwordHash: users.passwordHash }).from(users);
    expect(u).toEqual([{ username: "someone", passwordHash: "kept" }]);
    expect(await db.select().from(userRoles)).toEqual([]);
  });

  it("an unknown email whose username is taken fails naming the key", async () => {
    await db.insert(users).values({ id: Bun.randomUUIDv7(), name: "Someone", username: "OWNER", email: "someone@example.test" });
    const err = await seedSystem(db, OWNER).catch((e: unknown) => e);
    expect(String(err)).toContain("SEED_SUPERADMIN_USERNAME");
    expect(await userCount()).toBe(1);
  });

  it("password policy: production refuses a short password, elsewhere it is one warning", async () => {
    const short = { ...OWNER, SEED_SUPERADMIN_PASSWORD: "Sh0rt-pw!" };
    const err = await seedSystem(db, { ...short, NODE_ENV: "production" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).not.toContain("Sh0rt-pw!");
    expect(await userCount()).toBe(0);
    const warn = spyOn(log, "warn");
    try {
      await seedSystem(db, { ...short, NODE_ENV: "development" });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warn.mock.calls)).not.toContain("Sh0rt-pw!");
    } finally {
      warn.mockRestore();
    }
    expect(await userCount()).toBe(1);
  });

  it("db:seed runs in production with only the database URL and SEED_SUPERADMIN_*, without the server's secrets", async () => {
    // --no-env-file: nothing from apps/api/.env; the env below is all the process gets (compose's migrate service).
    const r = Bun.spawnSync(["bun", "--no-env-file", "src/db/seed/cli.ts", "system"], {
      cwd: path.join(import.meta.dir, "../.."),
      env: { PATH: process.env.PATH!, NODE_ENV: "production", DATABASE_URL: process.env.DATABASE_URL!, LOG_LEVEL: "silent", ...OWNER },
      stderr: "pipe",
    });
    expect(r.stderr.toString()).toBe("");
    expect(r.exitCode).toBe(0);
    expect((await usersWithRoles()).map((u) => [u.username, u.roles])).toEqual([["owner", ["Superadmin"]]]);
  });
});

describe("seedDemo", () => {
  it("demo accounts sign in with Password123!", async () => {
    await seedSystem(db, {});
    await seedDemo(db);
    const all = await usersWithRoles();
    const by = (k: string) => all.find((u) => u.username === k)!;
    for (const [k, role] of [["superadmin", "Superadmin"], ["admin", "Admin"], ["viewer", "Viewer"], ["twofa", "Admin"], ["inactive", "Viewer"], ["google", "Viewer"], ["apple", "Viewer"]]) {
      expect(by(k!)).toMatchObject({ email: `${k}@example.com`, roles: [role] });
      expect(await verifyPassword("Password123!", by(k!).passwordHash)).toBe(true);
    }
    expect(by("inactive")).toMatchObject({ isActive: false, lastLoginAt: null });
    expect(by("ldap")).toMatchObject({ isLdap: true, passwordHash: null, roles: ["Viewer"] });
    expect(decryptSecret(by("twofa").totpSecret!)).toBe("JBSWY3DPEHPK3PXP");
    const codes = await db.select({ codeHash: recoveryCodes.codeHash }).from(recoveryCodes).where(eq(recoveryCodes.userId, by("twofa").id));
    expect(codes).toHaveLength(8);
    for (const code of ["aaaa-1111", "hhhh-8888"]) {
      const hits = await Promise.all(codes.map((c) => verifyPassword(code, c.codeHash)));
      expect(hits.filter(Boolean)).toHaveLength(1);
    }
    const identities = db.select({ provider: userIdentities.provider, subject: userIdentities.subject, email: userIdentities.email }).from(userIdentities);
    expect(await identities.orderBy(asc(userIdentities.provider))).toEqual([
      { provider: "apple", subject: "mock-apple-demo", email: "apple@example.com" },
      { provider: "google", subject: "mock-google-demo", email: "google@example.com" },
    ]);
    const n = {
      users: await userCount(), activity: (await db.select({ n: count() }).from(activity))[0]!.n, auth: (await db.select({ n: count() }).from(authLog))[0]!.n,
    };
    expect(n).toEqual({ users: 50, activity: 200, auth: 300 });
    const [nulls] = await db.select({ n: count() }).from(activity).where(or(
      and(isNull(activity.before), eq(activity.action, "user.update")), and(isNotNull(activity.before), ne(activity.action, "user.update")),
      sql`jsonb_typeof(${activity.before}) = 'null'`,
    ));
    expect(nulls!.n).toBe(0); // only user.update entries have a before; the others are SQL NULL
  });

  it("the generator is deterministic", async () => {
    await seedSystem(db, {});
    await seedDemo(db);
    const names = async () =>
      (await db.select({ name: users.name, username: users.username, isActive: users.isActive }).from(users).orderBy(users.username)).map((r) => Object.values(r).join("|"));
    const first = await names();
    await truncateAll();
    await seedSystem(db, {});
    await seedDemo(db);
    expect(await names()).toEqual(first);
  });

  it("production refuses demo", async () => {
    await seedSystem(db, {});
    const err = await seedDemo(db, { NODE_ENV: "production" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(await userCount()).toBe(0);
  });
});
