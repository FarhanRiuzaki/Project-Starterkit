import { createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "../../kernel/crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_S = 30;

/** RFC 4648 base32 (padding optional) → bytes. */
function base32Decode(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? out + ALPHABET[(value << (5 - bits)) & 31] : out;
}

/** RFC 4226 HOTP (HMAC-SHA1, dynamic truncation). */
function hotp(key: Buffer, counter: number, digits: number): string {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(c).digest();
  const off = mac[mac.length - 1]! & 0x0f;
  return String((mac.readUInt32BE(off) & 0x7fffffff) % 10 ** digits).padStart(digits, "0");
}

/** A new 160-bit secret, base32 (32 characters), as authenticator apps expect. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The URI an authenticator app scans (Key URI format: label `issuer:account`, SHA-1, 6 digits, 30 s). */
export function otpauthUrl(secret: string, account: string, issuer: string): string {
  const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: String(STEP_S) });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${q}`;
}

/** RFC 6238 code of `secret` at `now` (ms). Used by verifyTotp and by tests to produce a valid code. */
export function totpCode(secret: string, now = Date.now(), digits = 6): string {
  return hotp(base32Decode(secret), Math.floor(now / 1000 / STEP_S), digits);
}

/** The time step `code` belongs to (current, previous or next 30 s step, for clock drift), or null. */
export function matchTotpStep(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secret);
  const step = Math.floor(now / 1000 / STEP_S);
  const hits = [-1, 0, 1].map((d) => safeEqual(hotp(key, step + d, 6), code)); // all three compared, no early exit
  const i = hits.indexOf(true);
  return i < 0 ? null : step + i - 1;
}

/** True when `code` is the 6-digit code of the current 30 s step or the one before or after. No replay check. */
export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  return matchTotpStep(secret, code, now) !== null;
}

/** 8 recovery codes of 80 random bits: lowercase base32, `xxxx-xxxx-xxxx-xxxx`. Stored with hashPassword. */
export function newRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => base32Encode(randomBytes(10)).toLowerCase().match(/.{4}/g)!.join("-"));
}
