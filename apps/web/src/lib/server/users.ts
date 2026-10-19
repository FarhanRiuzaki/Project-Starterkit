import { randomBytes, randomInt } from "node:crypto";
import { apiError } from "./api";
import { log } from "./logger";
import { db, type UserRecord } from "./mock/db";
import { hashToken } from "./mock/password";
import { checkRoleGrant } from "./mock/rules";
import type { PermissionName } from "@/lib/shared/permissions";

const INVITE_TTL_MS = 72 * 3600_000;

/** Another user (not `exceptId`) that already has this username or email, compared case-insensitively. */
export function duplicateOf(username: string | undefined, email: string | undefined, exceptId?: string): UserRecord | undefined {
  const u = username?.toLowerCase();
  const e = email?.toLowerCase();
  return [...db().users.values()].find((o) => o.id !== exceptId && ((u && o.username.toLowerCase() === u) || (e && o.email.toLowerCase() === e)));
}

/** First role among `names` (existing roles only) the actor may not grant or remove, as a 403; else null. */
export function roleGrantDenied(actorPerms: ReadonlySet<PermissionName>, names: readonly string[]): Response | null {
  for (const r of db().roles.values()) {
    if (names.includes(r.name) && checkRoleGrant(actorPerms, r)) return apiError(403, "forbidden", `Your role doesn't allow granting or removing ${r.name}. Ask an administrator who has all its permissions.`);
  }
  return null;
}

/** Every name in `roles` is an existing role. */
export const rolesExist = (roles: readonly string[]): boolean => {
  const names = new Set([...db().roles.values()].map((r) => r.name));
  return roles.every((r) => names.has(r));
};

/** Sign the user out everywhere (deactivate, delete, password reset). */
export function endSessions(userId: string): void {
  for (const [id, s] of db().sessions) if (s.userId === userId) db().sessions.delete(id);
}

/** Set-password link for a new user: same store and hashing as forgot-password, valid 72 hours; the link goes to the log (mock email). */
export function sendInvite(user: UserRecord): void {
  const tokens = db().resetTokens;
  const now = Date.now();
  for (const [k, t] of tokens) if (t.expiresAt <= now || t.userId === user.id) tokens.delete(k);
  const token = randomBytes(32).toString("base64url");
  tokens.set(hashToken(token), { userId: user.id, expiresAt: now + INVITE_TTL_MS });
  log.info({ userId: user.id, link: `/reset-password?token=${token}` }, "mock email: invitation link");
}

/** 18 random chars from an alphabet without look-alikes, plus one of each class so any password rule passes; unbiased (randomInt) and shuffled. */
export function temporaryPassword(): string {
  const pick = (set: string) => set[randomInt(set.length)]!;
  const all = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = [pick("abcdefghijkmnpqrstuvwxyz"), pick("ABCDEFGHJKLMNPQRSTUVWXYZ"), pick("23456789"), pick("-_!#"), ...Array.from({ length: 14 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join("");
}

/** Spent reset / invite links of a user (delete, admin reset). */
export function dropTokens(userId: string): void {
  for (const [k, t] of db().resetTokens) if (t.userId === userId) db().resetTokens.delete(k);
}
