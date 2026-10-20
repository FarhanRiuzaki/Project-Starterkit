import "server-only";
import pino, { type DestinationStream } from "pino";
import { formatLog, maskDeep, maskText, REDACT } from "@starterkit/shared/log-redact";

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
    redact: REDACT,
    formatters: { log: formatLog },
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
