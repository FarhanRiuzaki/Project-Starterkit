import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 32;

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, KEYLEN).toString("hex")}`;
}

export function verifyPassword(pw: string, hash: string): boolean {
  const [alg, salt, key] = hash.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  if (expected.length !== KEYLEN) return false;
  return timingSafeEqual(scryptSync(pw, Buffer.from(salt, "hex"), KEYLEN), expected);
}

/** Recovery codes are high-entropy, so a fast hash is enough (scrypt would cost ~50 ms per code). */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

/** Reset-link tokens are stored as this hash (random 256-bit tokens, so a fast hash is enough). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
