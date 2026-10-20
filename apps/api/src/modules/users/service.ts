// The writes on users and recovery_codes that other modules make (auth: sign-in, 2FA step, reset; me: own profile,
// password and 2FA). Each is one statement, or one transaction step of the caller's `tx`.
import { and, eq, isNotNull, isNull, lt, ne, or, sql, type SQLWrapper } from "drizzle-orm";
import { db, type Tx } from "../../kernel/db";
import { recoveryCodes, users } from "./schema";

const NOW = sql`now()`;

/** Locks the user's row for the transaction, then reads what a self-service change decides on. */
export async function lockUser(tx: Tx, id: string): Promise<{ name: string; email: string; hasPassword: boolean } | undefined> {
  const [u] = await tx.select({ name: users.name, email: users.email, hasPassword: sql<boolean>`${users.passwordHash} is not null` })
    .from(users).where(eq(users.id, id)).for("update");
  return u;
}

/** Another user (not `exceptId`) that already has this username or email, any letter case. */
export async function duplicateOf(tx: Tx, username: string | undefined, email: string | undefined, exceptId: string): Promise<boolean> {
  const same = (col: SQLWrapper, v: string | undefined) => eq(sql`lower(${col})`, sql`lower(${v ?? null})`);
  const rows = await tx.select({ one: sql`1` }).from(users)
    .where(and(ne(users.id, exceptId), or(same(users.username, username), same(users.email, email)))).limit(1);
  return rows.length > 0;
}

/** Name, email and/or password hash, and `updated_at` stamped. */
export async function updateUser(tx: Tx, id: string, v: { name?: string; email?: string; passwordHash?: string }): Promise<void> {
  await tx.update(users).set({ ...v, updatedAt: NOW }).where(eq(users.id, id));
}

/** The password hash and nothing else (a reset or invitation link). */
export async function setPassword(tx: Tx, id: string, hash: string): Promise<void> {
  await tx.update(users).set({ passwordHash: hash }).where(eq(users.id, id));
}

/** `last_login_at` = now (a full sign-in). */
export async function stampSignIn(tx: Tx, id: string): Promise<void> {
  await tx.update(users).set({ lastLoginAt: NOW }).where(eq(users.id, id));
}

/** TOTP replay guard: records `step` only when it is newer than the last accepted one; true when it did. */
export async function advanceTotpStep(id: string, step: number): Promise<boolean> {
  const done = await db.update(users).set({ totpLastStep: step })
    .where(and(eq(users.id, id), or(isNull(users.totpLastStep), lt(users.totpLastStep, step)))).returning({ id: users.id });
  return done.length === 1;
}

/** The user's unused recovery codes (hashes). */
export const unusedRecoveryCodes = (userId: string): Promise<{ id: string; codeHash: string }[]> =>
  db.select({ id: recoveryCodes.id, codeHash: recoveryCodes.codeHash }).from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));

/** Marks one recovery code used; `used_at is null` again, so of two concurrent uses only one is true. */
export async function markRecoveryCodeUsed(id: string): Promise<boolean> {
  const done = await db.update(recoveryCodes).set({ usedAt: NOW })
    .where(and(eq(recoveryCodes.id, id), isNull(recoveryCodes.usedAt))).returning({ id: recoveryCodes.id });
  return done.length === 1;
}

/** Stores a new pending (encrypted) TOTP secret while 2FA is off; false when it is on. */
export async function startTotp(tx: Tx, id: string, encrypted: string): Promise<boolean> {
  const done = await tx.update(users).set({ pendingTotpSecret: encrypted, updatedAt: NOW })
    .where(and(eq(users.id, id), isNull(users.totpSecret))).returning({ id: users.id });
  return done.length === 1;
}

/**
 * Turns 2FA on with the pending secret the code matched (still `pending`: a second setup in between would have
 * replaced it), the code's step as the replay guard, and these recovery code hashes in place of any old ones; false
 * (nothing written) when the pending secret changed or 2FA is already on.
 */
export async function enableTotp(tx: Tx, id: string, o: { pending: string; step: number; codeHashes: string[] }): Promise<boolean> {
  const done = await tx.update(users).set({ totpSecret: sql`${users.pendingTotpSecret}`, pendingTotpSecret: null, totpLastStep: o.step, updatedAt: NOW })
    .where(and(eq(users.id, id), eq(users.pendingTotpSecret, o.pending), isNull(users.totpSecret))).returning({ id: users.id });
  if (!done.length) return false;
  await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, id));
  await tx.insert(recoveryCodes).values(o.codeHashes.map((codeHash) => ({ id: Bun.randomUUIDv7(), userId: id, codeHash })));
  return true;
}

/** Turns 2FA off: both secrets and the recovery codes go; false when it was already off. */
export async function disableTotp(tx: Tx, id: string): Promise<boolean> {
  const done = await tx.update(users).set({ totpSecret: null, pendingTotpSecret: null, updatedAt: NOW })
    .where(and(eq(users.id, id), isNotNull(users.totpSecret))).returning({ id: users.id });
  if (!done.length) return false;
  await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, id));
  return true;
}
