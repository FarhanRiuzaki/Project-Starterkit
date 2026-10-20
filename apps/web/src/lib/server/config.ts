import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const unsetIfEmpty = (v: unknown) => (v === "" ? undefined : v);

const Env = z.object({
  /** Seals the session cookie. Required in production; elsewhere an empty value gets a random one per process. */
  SESSION_SECRET: z.preprocess(unsetIfEmpty, z.string().min(32).optional()),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  /** The API (apps/api); server env only. Required in production. */
  API_BASE_URL: z.preprocess(unsetIfEmpty, z.url({ protocol: /^https?$/ }).optional()),
  /** Shared with the API, sent as `X-Internal-Token`. */
  INTERNAL_API_TOKEN: z.string().min(32),
});

export type Config = {
  SESSION_SECRET: string; SESSION_TTL_HOURS: number; COOKIE_SECURE: boolean; API_BASE_URL: string; INTERNAL_API_TOKEN: string;
};

/** Where `bun run dev` starts the API; used outside production when API_BASE_URL is unset. */
export const DEV_API_BASE_URL = "http://127.0.0.1:4000";

/** One dev secret per process, shared by every server bundle (route handlers and pages load this module separately). */
const DEV_SECRET = Symbol.for("starterkit.devSessionSecret");
type G = typeof globalThis & { [DEV_SECRET]?: string };

export function parseConfig(env: Record<string, string | undefined>): Config {
  const c = Env.parse(env);
  const prod = env.NODE_ENV === "production";
  if (prod && !c.SESSION_SECRET) throw new Error("SESSION_SECRET is required in production (at least 32 characters).");
  if (prod && !c.API_BASE_URL) throw new Error("API_BASE_URL is required in production.");
  const g = globalThis as G;
  return {
    ...c,
    SESSION_SECRET: c.SESSION_SECRET ?? (g[DEV_SECRET] ??= randomBytes(32).toString("base64url")),
    API_BASE_URL: (c.API_BASE_URL ?? DEV_API_BASE_URL).replace(/\/+$/, ""),
  };
}

let cached: Config | undefined;

/** Runtime configuration from the environment, validated once. */
export function config(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}
