import "server-only";
import pino, { type DestinationStream } from "pino";

const CENSOR = "[redacted]";

/** Field names whose values never reach the log, at the top level and one level down. */
const SECRET_FIELDS = [
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
function maskDeep(v: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
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

/**
 * The err serializer, masked. An identifier-like `code` ("wrong_code", "ECONNREFUSED") is kept as `errCode`, because
 * the `*.code` redact path (there for OTP codes) would hide it; a digit-only code stays `code` and is redacted.
 */
function serializeErr(e: Error): unknown {
  const out: Record<string, unknown> = { ...pino.stdSerializers.err(e) };
  if (typeof out.code === "string" && /^[A-Za-z_][\w.-]*$/.test(out.code)) {
    out.errCode = out.code;
    delete out.code;
  }
  return maskDeep(out);
}

/**
 * Mask what reaches the line outside formatters.log: the message, printf arguments, and the message pino takes from
 * an Error's `.message` when none is given (`log.error(err)`, `log.error({ err })`).
 */
function maskArgs(args: unknown[]): unknown[] {
  const [first, second] = args;
  const out = args.map((a) => (a instanceof Error ? a : maskDeep(a))); // an Error stays an Error for pino's err path
  const merge = first !== null && typeof first === "object" ? (first as { err?: unknown; msg?: unknown }) : undefined;
  const err = first instanceof Error ? first : merge?.err instanceof Error && merge.msg === undefined ? merge.err : undefined;
  if (err && typeof second !== "string") out.splice(1, 0, maskText(err.message));
  return out;
}

/** JSON log to stdout (or `destination`). Secret fields are redacted at any level. */
export function createLogger(destination?: DestinationStream) {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "web" },
    redact: { paths: [...SECRET_FIELDS, ...SECRET_FIELDS.map((f) => `*.${f}`)], censor: CENSOR },
    formatters: { log: (o) => maskDeep(o) as Record<string, unknown> },
    serializers: { err: serializeErr },
    hooks: {
      logMethod(args, method) {
        method.apply(this, maskArgs(args) as Parameters<typeof method>);
      },
    },
  }, destination);
  // Child bindings: pino resets formatters.bindings for children (proto.js child()), so mask them here. Children
  // inherit this `child` through the prototype, so grandchildren are masked too.
  const child = logger.child;
  logger.child = function (this: typeof logger, bindings, options) {
    return child.call(this, maskDeep(bindings) as typeof bindings, options);
  } as typeof child;
  return logger;
}

export const log = createLogger();
