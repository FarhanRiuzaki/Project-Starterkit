import pino from "pino";
import { formatLog, maskArgs, maskErr, REDACT } from "@starterkit/shared/log-redact";

/** JSON log to stdout with the web's redaction (`@starterkit/shared/log-redact`). Level from LOG_LEVEL. */
export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "api" },
  redact: REDACT,
  formatters: { log: formatLog },
  serializers: { err: (e: Error) => maskErr(pino.stdSerializers.err(e)) },
  hooks: {
    logMethod(args, method) {
      method.apply(this, maskArgs(args) as Parameters<typeof method>);
    },
  },
});
