import type { SQL } from "bun";
import { Password } from "@starterkit/shared/contracts/auth";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import { hashPassword } from "../auth/password";
import { log } from "../log";

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
export async function seedSystem(db: SQL, env: Record<string, string | undefined>): Promise<void> {
  const owner = ownerOf(env);
  await db.begin(async (tx) => {
    await tx`insert into permissions ${tx(PERMISSIONS.map((name, position) => ({ name, position })))} on conflict (name) do nothing`;
    for (const r of ROLES) {
      const [made] = await tx`insert into roles (id, name, locked) values (${Bun.randomUUIDv7()}, ${r.name}, ${r.locked})
        on conflict ((lower(name))) do nothing returning id`;
      if (made) await tx`insert into role_permissions ${tx(r.perms.map((permission) => ({ role_id: made.id, permission })))}`;
    }
    await tx`insert into role_permissions (role_id, permission)
      select r.id, p.name from roles r cross join permissions p where r.name = 'Superadmin' on conflict do nothing`;
    if (!owner || (await tx`select 1 from users where lower(email) = lower(${owner.email})`).length) return;
    if ((await tx`select 1 from users where lower(username) = lower(${owner.username})`).length) {
      throw new Error("SEED_SUPERADMIN_USERNAME is already the username of another user (with another email). Choose another username.");
    }
    const id = Bun.randomUUIDv7();
    await tx`insert into users (id, name, username, email, password_hash)
      values (${id}, ${owner.name}, ${owner.username}, ${owner.email}, ${await hashPassword(owner.password)})`;
    await tx`insert into user_roles (user_id, role_id) select ${id}, id from roles where name = 'Superadmin'`;
  });
}
