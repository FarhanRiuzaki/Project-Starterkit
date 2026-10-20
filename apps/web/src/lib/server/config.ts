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
  /** Public origin of this site (metadataBase: absolute og:image and icon URLs); server env only. Required in production. */
  APP_URL: z.preprocess(unsetIfEmpty, z.url({ protocol: /^https?$/ }).optional()),
  /** The fake Google/Apple authorize page (the API's OAUTH_MOCK must be on too); development and E2E only. */
  OAUTH_MOCK: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

/** Every key the schema reads (apps/web/.env.example must name each; its test checks). */
export const CONFIG_KEYS = Object.keys(Env.shape);

export type Config = {
  SESSION_SECRET: string; SESSION_TTL_HOURS: number; COOKIE_SECURE: boolean; API_BASE_URL: string; INTERNAL_API_TOKEN: string;
  APP_URL: string; OAUTH_MOCK: boolean;
};

/** Where `bun run dev` starts the API; used outside production when API_BASE_URL is unset. */
export const DEV_API_BASE_URL = "http://127.0.0.1:4000";

/** Where `bun run dev` serves the web; used outside production when APP_URL is unset. */
export const DEV_APP_URL = "http://localhost:3000";

/** One dev secret per process, shared by every server bundle (route handlers and pages load this module separately). */
const DEV_SECRET = Symbol.for("starterkit.devSessionSecret");
type G = typeof globalThis & { [DEV_SECRET]?: string };

export function parseConfig(env: Record<string, string | undefined>): Config {
  const c = Env.parse(env);
  const prod = env.NODE_ENV === "production";
  if (prod && !c.SESSION_SECRET) throw new Error("SESSION_SECRET is required in production (at least 32 characters).");
  if (prod && !c.API_BASE_URL) throw new Error("API_BASE_URL is required in production.");
  if (prod && !c.APP_URL) throw new Error("APP_URL is required in production (the site's public origin, e.g. https://app.example.com).");
  // Production over HTTPS is a deployment. E2E runs a production build over plain HTTP with the mock, so NODE_ENV alone
  // can't refuse it; the API refuses OAUTH_MOCK in production either way.
  if (prod && c.COOKIE_SECURE && c.OAUTH_MOCK) throw new Error("OAUTH_MOCK must be false in production over HTTPS (COOKIE_SECURE=true).");
  const g = globalThis as G;
  return {
    ...c,
    SESSION_SECRET: c.SESSION_SECRET ?? (g[DEV_SECRET] ??= randomBytes(32).toString("base64url")),
    API_BASE_URL: (c.API_BASE_URL ?? DEV_API_BASE_URL).replace(/\/+$/, ""),
    APP_URL: c.APP_URL ?? DEV_APP_URL,
  };
}

let cached: Config | undefined;

/** Runtime configuration from the environment, validated once. */
export function config(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}
