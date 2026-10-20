import type { SQL } from "bun";
import type { ActivityAction } from "@starterkit/shared/audit";
import type { AuthLogDto } from "@starterkit/shared/contracts/audit";
import { encryptSecret } from "../auth/crypto";
import { hashPassword } from "../auth/password";
import { log } from "../log";

// Port of the web mock's seed (deleted in Task 9): same generator, seed and call order, so the same names and flags.
export const SEED_PASSWORD = "Password123!";
/** Directory password of the demo LDAP account (username `ldap`); the mock directory (auth/ldap.ts) holds it. */
export const LDAP_PASSWORD = "LdapPass123!";
/** Fixed base32 TOTP secret of twofa@example.com. */
export const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
export const RECOVERY_CODES = ["aaaa-1111", "bbbb-2222", "cccc-3333", "dddd-4444", "eeee-5555", "ffff-6666", "gggg-7777", "hhhh-8888"];
const DAY = 86_400_000;
const USER_COUNT = 50;

/** mulberry32: small seeded PRNG. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Alya", "Bima", "Citra", "Dewa", "Eka", "Farah", "Gilang", "Hana", "Indra", "Juli", "Kirana", "Laksmi", "Mira", "Nanda", "Oka", "Putri", "Raka", "Sinta", "Tegar", "Wulan"];
const LAST = ["Pratama", "Wijaya", "Santoso", "Lestari", "Hidayat", "Kusuma", "Nugroho", "Saputra", "Rahma", "Utama"];
const DEVICES = ["Chrome on macOS", "Firefox on Windows", "Safari on iOS", "Edge on Windows", "Chrome on Android"];
const PLACES = ["Jakarta, ID", "Bandung, ID", "Surabaya, ID", "Singapore, SG", null];

type Over = { isActive?: boolean; isLdap?: boolean; twoFactor?: boolean; connected?: "google" | "apple" };
const FIXED: { key: string; name: string; role: string; over?: Over }[] = [
  { key: "superadmin", name: "Super Admin", role: "Superadmin" },
  { key: "admin", name: "Admin User", role: "Admin" },
  { key: "viewer", name: "Viewer User", role: "Viewer" },
  { key: "twofa", name: "Two Factor", role: "Admin", over: { twoFactor: true } },
  { key: "inactive", name: "Inactive User", role: "Viewer", over: { isActive: false } },
  { key: "ldap", name: "Directory User", role: "Viewer", over: { isLdap: true } },
  { key: "google", name: "Google User", role: "Viewer", over: { connected: "google" } },
  { key: "apple", name: "Apple User", role: "Viewer", over: { connected: "apple" } },
];

// ponytail: hashes cached per process (argon2 is slow on purpose); tests reseed often.
let hashes: Promise<{ password: string; codes: string[] }> | undefined;

/**
 * Demo data on top of seedSystem: the 8 sign-in accounts of the mock (password Password123!, `ldap` signs in through
 * the directory, `twofa` has TOTP and recovery codes, `google`/`apple` are linked), 42 generated users, 200 activity
 * and 300 sign-in log entries. Refused in production; skipped when the demo accounts exist.
 */
export async function seedDemo(db: SQL, env: Record<string, string | undefined> = process.env): Promise<void> {
  if (env.NODE_ENV === "production") throw new Error("Demo data is refused when NODE_ENV=production.");
  if ((await db`select 1 from users where lower(email) = 'admin@example.com'`).length) {
    log.info("demo data exists: skipped");
    return;
  }
  const roleIds = new Map<string, string>((await db`select name, id from roles`).map((r: { name: string; id: string }) => [r.name, r.id]));
  if (!["Superadmin", "Admin", "Viewer"].every((r) => roleIds.has(r))) throw new Error("Run the system seed first (bun run db:seed).");
  const { password, codes } = await (hashes ??= Promise.all([hashPassword(SEED_PASSWORD), Promise.all(RECOVERY_CODES.map(hashPassword))])
    .then(([password, codes]) => ({ password, codes })));

  const now = Date.now();
  const rnd = prng(20261019);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const at = (ms: number) => new Date(ms);

  type U = { id: string; name: string; username: string; email: string; isActive: boolean; isLdap: boolean; twoFactor: boolean;
    connected: "google" | "apple" | null; role: string; lastLoginAt: Date | null; createdAt: Date };
  const users: U[] = [];
  const add = (key: string, name: string, role: string, over: Over = {}) => {
    const isActive = over.isActive ?? true;
    const lastLoginAt = over.isActive === false ? null : at(now - Math.floor(rnd() * 14 * DAY));
    const createdAt = at(now - (30 + Math.floor(rnd() * 60)) * DAY);
    users.push({ id: Bun.randomUUIDv7(), name, username: key, email: `${key}@example.com`, isActive, isLdap: over.isLdap ?? false,
      twoFactor: over.twoFactor ?? false, connected: over.connected ?? null, role, lastLoginAt, createdAt });
  };
  for (const f of FIXED) add(f.key, f.name, f.role, f.over);
  for (let i = FIXED.length; i < USER_COUNT; i++) {
    const first = pick(FIRST);
    const name = `${first} ${pick(LAST)}`;
    const roll = rnd();
    add(`${first.toLowerCase()}.${i + 1}`, name, roll < 0.2 ? "Admin" : "Viewer", { isActive: rnd() > 0.1 });
  }

  const actors = users.filter((u) => u.isActive && u.role !== "Viewer");
  const actions: ActivityAction[] = ["user.create", "user.update", "user.deactivate", "user.delete", "role.update", "role.create", "user.reset_password"];
  const activity = Array.from({ length: 200 }, () => {
    const actor = pick(actors);
    const target = pick(users);
    const action = pick(actions);
    const when = at(now - Math.floor(rnd() * 30 * DAY));
    const role = action.startsWith("role");
    return {
      id: Bun.randomUUIDv7(), at: when, actor_id: actor.id, actor_name: actor.name, action,
      target_type: role ? "role" : "user", target_id: role ? roleIds.get("Viewer")! : target.id, target_label: role ? "Viewer" : target.name,
      before: action === "user.update" ? { name: target.name } : null,
      after: action === "user.update" ? { name: `${target.name} (edited)` } : null,
    };
  });

  const events: AuthLogDto["event"][] = ["login_success", "login_success", "login_success", "login_failed", "logout", "password_ok", "2fa_success", "2fa_failed", "password_reset"];
  const authLog = Array.from({ length: 300 }, () => {
    const u = pick(users);
    const event = pick(events);
    const when = at(now - Math.floor(rnd() * 30 * DAY));
    return {
      id: Bun.randomUUIDv7(), at: when, user_id: u.id, login: u.email, event, method: u.isLdap ? "ldap" : u.connected ?? "password",
      ip: `10.0.${Math.floor(rnd() * 8)}.${1 + Math.floor(rnd() * 250)}`, device: pick(DEVICES), location: pick(PLACES),
    };
  });

  await db.begin(async (tx) => {
    await tx`insert into users ${tx(users.map((u) => ({
      id: u.id, name: u.name, username: u.username, email: u.email, is_active: u.isActive, is_ldap: u.isLdap,
      password_hash: u.isLdap ? null : password, totp_secret: u.twoFactor ? encryptSecret(TOTP_SECRET) : null,
      last_login_at: u.lastLoginAt, created_at: u.createdAt, updated_at: u.createdAt,
    })))}`;
    await tx`insert into user_roles ${tx(users.map((u) => ({ user_id: u.id, role_id: roleIds.get(u.role)! })))}`;
    for (const u of users.filter((x) => x.twoFactor)) {
      await tx`insert into recovery_codes ${tx(codes.map((code_hash) => ({ id: Bun.randomUUIDv7(), user_id: u.id, code_hash })))}`;
    }
    for (const u of users.filter((x) => x.connected)) {
      await tx`insert into user_identities (user_id, provider, subject, email) values (${u.id}, ${u.connected}, ${`mock-${u.connected}-demo`}, ${u.email})`;
    }
    // jsonb through text: a parameter typed jsonb would store a JSON string of the text instead of the object
    for (const a of activity) {
      await tx`insert into activity (id, at, actor_id, actor_name, action, target_type, target_id, target_label, before, after)
        values (${a.id}, ${a.at}, ${a.actor_id}, ${a.actor_name}, ${a.action}, ${a.target_type}, ${a.target_id}, ${a.target_label},
                ${a.before && JSON.stringify(a.before)}::text::jsonb, ${a.after && JSON.stringify(a.after)}::text::jsonb)`;
    }
    await tx`insert into auth_log ${tx(authLog)}`;
  });
}
