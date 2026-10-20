import { z } from "zod";

const int = (min: number, max: number, dflt: number) => z.coerce.number().int().min(min).max(max).default(dflt);
const flag = z.enum(["true", "false"]).default("false").transform((v) => v === "true");
/** Standard base64 that decodes to exactly 32 bytes. */
const key32 = z.string().refine((v) => /^[A-Za-z0-9+/]{43}=$/.test(v) && Buffer.from(v, "base64").length === 32, {
  message: "must be base64 of exactly 32 bytes",
});

const Schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: int(1, 65535, 4000),
  DATABASE_URL: z.string(),
  MIGRATION_DATABASE_URL: z.string().optional(),
  DB_POOL_MAX: int(1, 100, 10),
  INTERNAL_API_TOKEN: z.string().min(32),
  DATA_ENCRYPTION_KEY: key32,
  SESSION_TTL_HOURS: int(1, 24, 12),
  SESSION_IDLE_MINUTES: int(5, 1440, 120),
  APP_URL: z.url().default("http://localhost:3000"),
  MAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  AUDIT_RETENTION_DAYS: int(30, 3650, 365),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  OAUTH_MOCK: flag,
  LDAP_MOCK: flag,
  LDAP_URL: z.string().regex(/^ldaps?:\/\/\S+$/i, { message: "must start with ldap:// or ldaps://" }).optional(),
  LDAP_BIND_DN: z.string().optional(),
  LDAP_BIND_PASSWORD: z.string().optional(),
  LDAP_BASE_DN: z.string().optional(),
  // Without {username} every sign-in would search the same entry.
  LDAP_USER_FILTER: z.string().refine((v) => v.includes("{username}"), { message: "must contain {username}" }).default("(uid={username})"),
  LDAP_STARTTLS: flag,
}).transform((c) => ({ ...c, MIGRATION_DATABASE_URL: c.MIGRATION_DATABASE_URL ?? c.DATABASE_URL }));

export type Config = z.output<typeof Schema>;

/**
 * Rules across keys, on the raw env so they're reported even when a field is invalid (zod skips refinements of an
 * object with field issues). Raw values are the enum strings; anything else is a field issue already.
 */
function crossKeyProblems(e: Record<string, string>): string[] {
  const out: string[] = [];
  if (e.MAIL_TRANSPORT === "smtp") {
    if (!e.SMTP_URL) out.push("SMTP_URL (required when MAIL_TRANSPORT=smtp)");
    if (!e.MAIL_FROM) out.push("MAIL_FROM (required when MAIL_TRANSPORT=smtp)");
  }
  if (e.LDAP_URL && !e.LDAP_BASE_DN) out.push("LDAP_BASE_DN (required when LDAP_URL is set)");
  if (e.NODE_ENV === "production") {
    if (e.MAIL_TRANSPORT !== "smtp") out.push("MAIL_TRANSPORT (must be smtp in production)");
    if (e.OAUTH_MOCK === "true") out.push("OAUTH_MOCK (must be false in production)");
    if (e.LDAP_MOCK === "true") out.push("LDAP_MOCK (must be false in production)");
    if (/^ldap:\/\//i.test(e.LDAP_URL ?? "") && e.LDAP_STARTTLS !== "true") out.push("LDAP_URL (production needs ldaps:// or LDAP_STARTTLS=true)");
  }
  return out;
}

/**
 * Validated API settings from `env` (empty strings count as unset). A missing or invalid value throws one error that
 * names every bad key and why, never a value.
 */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const set = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>;
  const r = Schema.safeParse(set);
  const why = [
    ...(r.error?.issues.map((i) => `${i.path.join(".")} (${i.code === "custom" ? i.message : i.code})`) ?? []),
    ...crossKeyProblems(set),
  ];
  if (r.success && !why.length) return r.data;
  throw new Error(`Invalid API configuration: ${[...new Set(why)].join(", ")}. See apps/api/.env.example.`);
}

let cached: Config | undefined;
/** `loadConfig(process.env)`, read once. */
export const config = (): Config => (cached ??= loadConfig(process.env));
