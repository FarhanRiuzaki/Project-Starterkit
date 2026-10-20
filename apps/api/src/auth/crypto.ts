import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config";

const key = () => Buffer.from(config().DATA_ENCRYPTION_KEY, "base64");
const b64u = (b: Buffer) => b.toString("base64url");

/** 32 random bytes, base64url: session, challenge, reset and OAuth state tokens. */
export const randomToken = (): string => b64u(randomBytes(32));

/** What the database stores in place of a token. */
export const hashToken = (t: string): Buffer => createHash("sha256").update(t).digest();

/** AES-256-GCM with DATA_ENCRYPTION_KEY: `v1:<iv>:<tag>:<ciphertext>` (base64url, 12-byte IV, 16-byte tag). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${b64u(iv)}:${b64u(c.getAuthTag())}:${b64u(ct)}`;
}

/** The plain text of `encryptSecret`; throws on another format or version, a wrong key or any change. */
export function decryptSecret(enc: string): string {
  const parts = enc.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("unknown secret format");
  const [iv, tag, ct] = parts.slice(1).map((p) => Buffer.from(p, "base64url")) as [Buffer, Buffer, Buffer];
  const d = createDecipheriv("aes-256-gcm", key(), iv, { authTagLength: 16 });
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

/** Constant-time string equality (compared as SHA-256 digests, so lengths may differ). */
export const safeEqual = (a: string, b: string): boolean => timingSafeEqual(hashToken(a), hashToken(b));
