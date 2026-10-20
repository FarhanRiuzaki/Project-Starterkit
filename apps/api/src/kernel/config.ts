import { z } from "zod";

const int = (min: number, max: number, dflt: number) => z.coerce.number().int().min(min).max(max).default(dflt);
const flag = z.enum(["true", "false"]).default("false").transform((v) => v === "true");
/** Standard base64 that decodes to exactly 32 bytes. */
const key32 = z.string().refine((v) => /^[A-Za-z0-9+/]{43}=$/.test(v) && Buffer.from(v, "base64").length === 32, {
  message: "must be base64 of exactly 32 bytes",
});

const Fields = z.object({
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
  // Google and Apple sign-in: each provider is on when all of its keys are set (redirect: APP_URL/api/auth/oauth/<provider>/callback).
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  /** The Sign in with Apple key (.p8): PKCS#8 PEM; line breaks may be written as \n. */
  APPLE_PRIVATE_KEY: z.string().refine((v) => v.includes("-----BEGIN PRIVATE KEY-----"), { message: "must be a PKCS#8 PEM (BEGIN PRIVATE KEY)" }).optional(),
});
const Schema = Fields.transform((c) => ({ ...c, MIGRATION_DATABASE_URL: c.MIGRATION_DATABASE_URL ?? c.DATABASE_URL }));
/** What the pool needs (kernel/db.ts builds it when it loads). */
const DbFields = Fields.pick({ DATABASE_URL: true, DB_POOL_MAX: true });

export type Config = z.output<typeof Schema>;

/** Every key the schema reads (apps/api/.env.example must name each; its test checks). */
export const CONFIG_KEYS = Object.keys(Fields.shape);

export const GOOGLE_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;
export const APPLE_KEYS = ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"] as const;

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
  // A provider's keys come all together or not at all: half a provider would show a button that can't work.
  for (const keys of [GOOGLE_KEYS, APPLE_KEYS]) {
    if (keys.some((k) => e[k])) out.push(...keys.filter((k) => !e[k]).map((k) => `${k} (required with ${keys.filter((x) => e[x]).join(", ")})`));
  }
  if (e.NODE_ENV === "production") {
    if (e.MAIL_TRANSPORT !== "smtp") out.push("MAIL_TRANSPORT (must be smtp in production)");
    if (!e.APP_URL) out.push("APP_URL (required in production: the public origin the reset and invitation links point to)");
    if (e.OAUTH_MOCK === "true") out.push("OAUTH_MOCK (must be false in production)");
    if (e.LDAP_MOCK === "true") out.push("LDAP_MOCK (must be false in production)");
    if (/^ldap:\/\//i.test(e.LDAP_URL ?? "") && e.LDAP_STARTTLS !== "true") out.push("LDAP_URL (production needs ldaps:// or LDAP_STARTTLS=true)");
    // smtp:// alone sends the password and the reset links in clear text whenever the server offers no STARTTLS.
    if (e.MAIL_TRANSPORT === "smtp" && e.SMTP_URL && !/^smtps:\/\//i.test(e.SMTP_URL) && !/[?&]requireTLS=true(&|$)/.test(e.SMTP_URL)) {
      out.push("SMTP_URL (production needs smtps:// or ?requireTLS=true)");
    }
  }
  return out;
}

const nonEmpty = (env: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>;
const issues = (e: z.ZodError | undefined) => e?.issues.map((i) => `${i.path.join(".")} (${i.code === "custom" ? i.message : i.code})`) ?? [];
const invalid = (why: string[]) => new Error(`Invalid API configuration: ${[...new Set(why)].join(", ")}. See apps/api/.env.example.`);

/**
 * Validated API settings from `env` (empty strings count as unset). A missing or invalid value throws one error that
 * names every bad key and why, never a value.
 */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const set = nonEmpty(env);
  const r = Schema.safeParse(set);
  const why = [...issues(r.error), ...crossKeyProblems(set)];
  if (r.success && !why.length) return r.data;
  throw invalid(why);
}

/**
 * Only DATABASE_URL and DB_POOL_MAX, validated the same way: the pool is built when kernel/db.ts loads, so the one-shot
 * scripts (db:seed) that import the modules run without the server's secrets. The server checks everything at boot
 * (`config()` in index.ts).
 */
export function loadDbConfig(env: Record<string, string | undefined>): z.output<typeof DbFields> {
  const r = DbFields.safeParse(nonEmpty(env));
  if (r.success) return r.data;
  throw invalid(issues(r.error));
}

let cached: Config | undefined;
/** `loadConfig(process.env)`, read once. */
export const config = (): Config => (cached ??= loadConfig(process.env));
