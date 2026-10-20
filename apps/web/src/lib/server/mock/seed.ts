import type { ActivityDto, AuthLogDto } from "@starterkit/shared/contracts/audit";
import { PERMISSIONS, type PermissionName } from "@starterkit/shared/permissions";
import type { Db, RoleRecord, UserRecord } from "./db";
import { hashPassword, hashRecoveryCode } from "./password";

export const SEED_PASSWORD = "Password123!";
export const LDAP_PASSWORD = "LdapPass123!";
/** Fixed base32 TOTP secret of twofa@example.com. */
export const TOTP_SECRET = "JBSWY3DPEHPK3PXP";
export const RECOVERY_CODES = ["aaaa-1111", "bbbb-2222", "cccc-3333", "dddd-4444", "eeee-5555", "ffff-6666", "gggg-7777", "hhhh-8888"];
const DAY = 86_400_000;
const USER_COUNT = 50;

let cachedHash: string | undefined;

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

const FIXED: { key: string; name: string; role: string; over?: Partial<UserRecord> }[] = [
  { key: "superadmin", name: "Super Admin", role: "Superadmin" },
  { key: "admin", name: "Admin User", role: "Admin" },
  { key: "viewer", name: "Viewer User", role: "Viewer" },
  { key: "twofa", name: "Two Factor", role: "Admin", over: { twoFactorEnabled: true, totpSecret: TOTP_SECRET } },
  { key: "inactive", name: "Inactive User", role: "Viewer", over: { isActive: false } },
  { key: "ldap", name: "Directory User", role: "Viewer", over: { isLdap: true } },
  { key: "google", name: "Google User", role: "Viewer", over: { connected: ["google"] } },
  { key: "apple", name: "Apple User", role: "Viewer", over: { connected: ["apple"] } },
];

export function seed(now: number = Date.now()): Db {
  const rnd = prng(20261019);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const iso = (ms: number) => new Date(ms).toISOString();
  const passwordHash = (cachedHash ??= hashPassword(SEED_PASSWORD));

  const mkRole = (id: string, name: string, permissions: PermissionName[], locked = false): RoleRecord => ({ id, name, locked, permissions });
  const roleList = [
    mkRole("role-superadmin", "Superadmin", [...PERMISSIONS], true),
    mkRole("role-admin", "Admin", PERMISSIONS.filter((p) => !p.startsWith("role.") && !p.startsWith("permission."))),
    mkRole("role-viewer", "Viewer", ["user.view", "audit.view"]),
  ];

  const users = new Map<string, UserRecord>();
  const ldapDirectory = new Map<string, string>();
  const add = (i: number, key: string, name: string, role: string, over: Partial<UserRecord> = {}) => {
    const id = `u-${String(i + 1).padStart(3, "0")}`;
    const u: UserRecord = {
      id, name, username: key, email: `${key}@example.com`, avatarUrl: null, isActive: true, isLdap: false,
      twoFactorEnabled: false, roles: [role], connected: [],
      lastLoginAt: over.isActive === false ? null : iso(now - Math.floor(rnd() * 14 * DAY)),
      createdAt: iso(now - (30 + Math.floor(rnd() * 60)) * DAY),
      passwordHash, totpSecret: null, recoveryCodes: [], ...over,
    };
    if (u.isLdap) {
      u.passwordHash = null;
      ldapDirectory.set(id, LDAP_PASSWORD);
    }
    if (u.twoFactorEnabled) u.recoveryCodes = RECOVERY_CODES.map(hashRecoveryCode);
    users.set(id, u);
  };
  FIXED.forEach((f, i) => add(i, f.key, f.name, f.role, f.over));
  for (let i = FIXED.length; i < USER_COUNT; i++) {
    const first = pick(FIRST);
    const name = `${first} ${pick(LAST)}`;
    const roll = rnd();
    add(i, `${first.toLowerCase()}.${i + 1}`, name, roll < 0.2 ? "Admin" : "Viewer", { isActive: rnd() > 0.1 });
  }

  const all = [...users.values()];
  const actors = all.filter((u) => u.isActive && !u.roles.includes("Viewer"));
  const activity = new Map<string, ActivityDto>();
  const actions = ["user.create", "user.update", "user.deactivate", "user.delete", "role.update", "role.create", "user.reset_password"] as const;
  for (let i = 0; i < 200; i++) {
    const actor = pick(actors);
    const target = pick(all);
    const action = pick(actions);
    const id = `act-${String(i + 1).padStart(4, "0")}`;
    activity.set(id, {
      id, at: iso(now - Math.floor(rnd() * 30 * DAY)), actor: { id: actor.id, name: actor.name }, action,
      target: action.startsWith("role") ? { type: "role", id: "role-viewer", label: "Viewer" } : { type: "user", id: target.id, label: target.name },
      before: action === "user.update" ? { name: target.name } : null,
      after: action === "user.update" ? { name: `${target.name} (edited)` } : null,
    });
  }

  const authLog = new Map<string, AuthLogDto>();
  const events = ["login_success", "login_success", "login_success", "login_failed", "logout", "password_ok", "2fa_success", "2fa_failed", "password_reset"] as const;
  for (let i = 0; i < 300; i++) {
    const u = pick(all);
    const event = pick(events);
    const id = `log-${String(i + 1).padStart(4, "0")}`;
    authLog.set(id, {
      id, at: iso(now - Math.floor(rnd() * 30 * DAY)), userId: u.id, login: u.email, event,
      method: u.isLdap ? "ldap" : u.connected[0] ?? "password",
      ip: `10.0.${Math.floor(rnd() * 8)}.${1 + Math.floor(rnd() * 250)}`, device: pick(DEVICES), location: pick(PLACES),
    });
  }

  return {
    users, roles: new Map(roleList.map((r) => [r.id, r])), sessions: new Map(), activity, authLog,
    resetTokens: new Map(), ldapDirectory, permissionCatalog: new Set(PERMISSIONS),
  };
}
