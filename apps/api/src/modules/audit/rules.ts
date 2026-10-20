import { MASK, SECRET_KEY } from "@starterkit/shared/audit";

/** UserRow fields that must never reach an entry, even when a caller passes the raw row. */
const HIDDEN = new Set(["passwordHash", "totpSecret", "pendingTotpSecret", "recoveryCodes"]);

/**
 * Plain-data copy of a `before`/`after` value, or null when there is none: the row's own credential fields are dropped,
 * and any other credential-named field (SECRET_KEY, at any depth) keeps only `MASK` when it had a value. So the API,
 * the CSV, the dashboard and the diff never see a credential, whatever a caller passes.
 */
export const snapshot = (v: unknown): unknown =>
  v == null ? null : JSON.parse(JSON.stringify(v, (k, x: unknown) => (HIDDEN.has(k) ? undefined : k && SECRET_KEY.test(k) && x != null ? MASK : x)));
