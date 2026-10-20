/** contracts/password.ts `Password` minimum (zod stays out of client code; password.test.ts checks they agree). */
export const PASSWORD_MIN = 12;

/**
 * The new-password requirements, ticked off while the user types (`PasswordChecks`): the length with how many are
 * left, and with a repeat field (`again`) that both match.
 */
export function passwordChecks(password: string, again?: string): { label: string; met: boolean }[] {
  const left = PASSWORD_MIN - password.length;
  return [
    { label: `At least ${PASSWORD_MIN} characters${left > 0 && password ? ` (${left} more)` : ""}`, met: left <= 0 },
    ...(again === undefined ? [] : [{ label: "The two passwords match", met: password !== "" && password === again }]),
  ];
}
