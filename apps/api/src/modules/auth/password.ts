import { randomToken } from "../../kernel/crypto";

const OPTIONS = { algorithm: "argon2id", memoryCost: 19456, timeCost: 2 } as const;

/** Argon2id (19 MiB, 2 passes): passwords and recovery codes. */
export const hashPassword = (p: string): Promise<string> => Bun.password.hash(p, OPTIONS);

/** Verified in place of a missing hash, so an unknown account costs the same as a wrong password. */
const DUMMY = hashPassword(randomToken());

/** True when `p` matches `hash`; a null hash (no such user, no password) runs one full verify and is false. */
export async function verifyPassword(p: string, hash: string | null): Promise<boolean> {
  const ok = await Bun.password.verify(p, hash ?? (await DUMMY));
  return hash !== null && ok;
}
