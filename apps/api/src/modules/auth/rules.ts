// Pure sign-in rules (no I/O).

/** No password and not a directory user: the account signs in only through a connected Google or Apple account. */
export const oauthOnly = (u: { passwordHash: string | null; isLdap: boolean }): boolean => !u.passwordHash && !u.isLdap;

/** Six digits are a TOTP code only; anything else is a recovery code only (so a wrong TOTP costs no argon2 verify). */
export const isTotpCode = (code: string): boolean => /^\d{6}$/.test(code);

/** Where a password step that needs a second factor goes: the code page, carrying `next` unless it is the home page. */
export const twoFactorPath = (next: string): string => (next === "/" ? "/login/2fa" : `/login/2fa?next=${encodeURIComponent(next)}`);
