import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const Env = z.object({
  /** Seals the session cookie. Required in production; elsewhere an empty value gets a random one per process. */
  SESSION_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(32).optional()),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  /** A session with no request for this long ends (checked on its next request). */
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(120),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

export type Config = { SESSION_SECRET: string; SESSION_TTL_HOURS: number; SESSION_IDLE_MINUTES: number; COOKIE_SECURE: boolean };

/** One dev secret per process, shared by every server bundle (route handlers and pages load this module separately). */
const DEV_SECRET = Symbol.for("starterkit.devSessionSecret");
type G = typeof globalThis & { [DEV_SECRET]?: string };

export function parseConfig(env: Record<string, string | undefined>): Config {
  const c = Env.parse(env);
  if (c.SESSION_SECRET) return { ...c, SESSION_SECRET: c.SESSION_SECRET };
  if (env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production (at least 32 characters).");
  const g = globalThis as G;
  return { ...c, SESSION_SECRET: (g[DEV_SECRET] ??= randomBytes(32).toString("base64url")) };
}

let cached: Config | undefined;

/** Runtime configuration from the environment, validated once. */
export function config(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}
