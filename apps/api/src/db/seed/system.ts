import { eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { Password } from "@starterkit/shared/contracts/auth";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import type { Tx } from "../../kernel/db";
import { log } from "../../kernel/log";
import { hashPassword } from "../../modules/auth";
import { permissions, rolePermissions, roles, userRoles } from "../../modules/rbac";
import { users } from "../../modules/users";

/** The built-in roles, as the web mock's seed made them. */
const ROLES: { name: string; locked: boolean; perms: readonly PermissionName[] }[] = [
  { name: "Superadmin", locked: true, perms: PERMISSIONS },
  { name: "Admin", locked: false, perms: PERMISSIONS.filter((p) => !p.startsWith("role.") && !p.startsWith("permission.")) },
  { name: "Viewer", locked: false, perms: ["user.view", "audit.view"] },
];
const OWNER_KEYS = ["SEED_SUPERADMIN_NAME", "SEED_SUPERADMIN_EMAIL", "SEED_SUPERADMIN_USERNAME", "SEED_SUPERADMIN_PASSWORD"] as const;

/** The superadmin to create from env: null when no key is set; every key set or an error naming the missing ones. */
function ownerOf(env: Record<string, string | undefined>) {
  const [name, email, username, password] = OWNER_KEYS.map((k) => env[k] || "");
  if (!name && !email && !username && !password) return null;
  const missing = OWNER_KEYS.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Set every SEED_SUPERADMIN_* key or none; missing: ${missing.join(", ")}.`);
  if (!Password.safeParse(password).success) {
    if (env.NODE_ENV === "production") throw new Error("SEED_SUPERADMIN_PASSWORD must be 12 to 128 characters in production.");
    log.warn("SEED_SUPERADMIN_PASSWORD is outside 12 to 128 characters; accepted because NODE_ENV is not production.");
  }
  return { name: name!, email: email!, username: username!, password: password! };
}

/**
 * The data every install needs, idempotent: the permission catalog in order, the roles Superadmin (locked, every
 * permission), Admin and Viewer (their permissions only when the role is created, so later edits stay), then the
 * superadmin from SEED_SUPERADMIN_* when set. A user with that email already there is left as it is; another user
 * holding that username is an error.
 */
export async function seedSystem(db: Tx, env: Record<string, string | undefined>): Promise<void> {
  const owner = ownerOf(env);
  await db.transaction(async (tx) => {
    await tx.insert(permissions).values(PERMISSIONS.map((name, position) => ({ name, position }))).onConflictDoNothing({ target: permissions.name });
    for (const r of ROLES) {
      // The only possible conflict is the name (lower(name) index): the id is new.
      const [made] = await tx.insert(roles).values({ id: Bun.randomUUIDv7(), name: r.name, locked: r.locked }).onConflictDoNothing().returning({ id: roles.id });
      if (made) await tx.insert(rolePermissions).values(r.perms.map((permission) => ({ roleId: made.id, permission })));
    }
    await tx.insert(rolePermissions)
      .select(tx.select({ roleId: roles.id, permission: permissions.name }).from(roles).crossJoin(permissions).where(eq(roles.name, "Superadmin")))
      .onConflictDoNothing();
    const taken = (column: AnyPgColumn, value: string) =>
      tx.select({ id: users.id }).from(users).where(eq(sql`lower(${column})`, sql`lower(${value})`)).limit(1);
    if (!owner || (await taken(users.email, owner.email)).length) return;
    if ((await taken(users.username, owner.username)).length) {
      throw new Error("SEED_SUPERADMIN_USERNAME is already the username of another user (with another email). Choose another username.");
    }
    const id = Bun.randomUUIDv7();
    await tx.insert(users).values({ id, name: owner.name, username: owner.username, email: owner.email, passwordHash: await hashPassword(owner.password) });
    const [superadmin] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, "Superadmin"));
    await tx.insert(userRoles).values({ userId: id, roleId: superadmin!.id });
  });
}
