// Pure parts of the logger (no pino, no server-only): the secret key list, text masking and the pino redact config.
export const CENSOR = "[redacted]";

/** Field names whose values never reach the log, at the top level and one level down. */
export const SECRET_FIELDS = [
  "password", "passwordHash", "token", "cookie", "code", "csrf",
  "otpauth", "otpauthUri", "uri", "secret", "totpSecret", "recoveryCodes", "formToken", "phone", "email",
];

/** OTP secrets inside free text: an otpauth URI, a `secret=` query value, a "Secret: <B32>" line. */
const SECRET_TEXT: Array<[RegExp, string]> = [
  [/otpauth:\/\/\S+/gi, `otpauth://${CENSOR}`],
  [/secret=[A-Z2-7]+/gi, `secret=${CENSOR}`],
  [/Secret: [A-Z2-7]{8,}=*/g, `Secret: ${CENSOR}`],
];

export function maskText(s: string): string {
  let out = s;
  for (const [re, by] of SECRET_TEXT) out = out.replace(re, by);
  return out;
}

/** Copy of `v` with every string masked; plain objects and arrays only (depth-limited, cycle-safe). */
export function maskDeep(v: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof v === "string") return maskText(v);
  if (v instanceof URL) return maskUrl(v); // as a string: redaction would otherwise poke URL's private fields
  if (v === null || typeof v !== "object" || depth > 8 || seen.has(v)) return v;
  if (Array.isArray(v)) {
    seen.add(v);
    return v.map((x) => maskDeep(x, depth + 1, seen));
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return v; // Error, Date, Buffer…: serializers handle `err`
  seen.add(v);
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) out[k] = maskDeep(x, depth + 1, seen);
  return out;
}

function maskUrl(u: URL): string {
  const c = new URL(u.href);
  if (c.password) c.password = CENSOR;
  return maskText(c.href);
}

/** pino `redact` option: every secret field at the top level and one level down. */
export const REDACT = { paths: [...SECRET_FIELDS, ...SECRET_FIELDS.map((f) => `*.${f}`)], censor: CENSOR };

/** pino `formatters.log`: masks every string in the merged object. */
export const formatLog = (o: Record<string, unknown>) => maskDeep(o) as Record<string, unknown>;
