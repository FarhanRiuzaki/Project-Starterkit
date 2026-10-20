import "server-only";
import pino, { type DestinationStream } from "pino";
import { formatLog, maskArgs, maskDeep, maskErr, REDACT } from "@starterkit/shared/log-redact";

/** JSON log to stdout (or `destination`). Secret fields are redacted at any level. */
export function createLogger(destination?: DestinationStream) {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "web" },
    redact: REDACT,
    formatters: { log: formatLog },
    serializers: { err: (e: Error) => maskErr(pino.stdSerializers.err(e)) },
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
