import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CONFIG_KEYS, loadConfig, loadDbConfig } from "../../config";

const KEY = Buffer.alloc(32, 7).toString("base64");
const base = {
  DATABASE_URL: "postgresql://app:hunter2-db@localhost:5432/app",
  INTERNAL_API_TOKEN: "t".repeat(40),
  DATA_ENCRYPTION_KEY: KEY,
};

/** The message of the error `loadConfig(env)` throws. */
function failure(env: Record<string, string | undefined>): string {
  try {
    loadConfig(env);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("loadConfig did not throw");
}

describe("loadConfig", () => {
  it("applies the defaults", () => {
    const c = loadConfig(base);
    expect(c).toMatchObject({
      NODE_ENV: "development", API_HOST: "127.0.0.1", API_PORT: 4000, MIGRATION_DATABASE_URL: base.DATABASE_URL,
      DB_POOL_MAX: 10, SESSION_TTL_HOURS: 12, SESSION_IDLE_MINUTES: 120, APP_URL: "http://localhost:3000",
      MAIL_TRANSPORT: "log", AUDIT_RETENTION_DAYS: 365, LOG_LEVEL: "info", OAUTH_MOCK: false, LDAP_MOCK: false,
    });
  });

  it("rejects a missing DATABASE_URL and names the key only", () => {
    const msg = failure({ ...base, DATABASE_URL: undefined, INTERNAL_API_TOKEN: "short-secret-value" });
    expect(msg).toContain("DATABASE_URL");
    expect(msg).toContain("INTERNAL_API_TOKEN");
    expect(msg).not.toContain("short-secret-value");
    expect(msg).not.toContain(KEY);
  });

  it("rejects a short INTERNAL_API_TOKEN", () => {
    expect(failure({ ...base, INTERNAL_API_TOKEN: "x".repeat(31) })).toContain("INTERNAL_API_TOKEN");
  });

  it("rejects a DATA_ENCRYPTION_KEY that is not 32 bytes", () => {
    const short = Buffer.alloc(31, 1).toString("base64");
    const msg = failure({ ...base, DATA_ENCRYPTION_KEY: short });
    expect(msg).toContain("DATA_ENCRYPTION_KEY");
    expect(msg).not.toContain(short);
    expect(failure({ ...base, DATA_ENCRYPTION_KEY: "not base64 at all, but long enough to be 44!" })).toContain("DATA_ENCRYPTION_KEY");
  });

  it("refuses OAUTH_MOCK=true in production", () => {
    const prod = { ...base, NODE_ENV: "production", MAIL_TRANSPORT: "smtp", SMTP_URL: "smtps://mail:465", MAIL_FROM: "a@b.c" };
    expect(loadConfig(prod).NODE_ENV).toBe("production");
    expect(failure({ ...prod, OAUTH_MOCK: "true" })).toContain("OAUTH_MOCK");
    expect(failure({ ...prod, LDAP_MOCK: "true" })).toContain("LDAP_MOCK");
  });

  it("names cross-key problems next to field problems", () => {
    const msg = failure({ ...base, DATABASE_URL: undefined, NODE_ENV: "production", MAIL_TRANSPORT: "smtp", OAUTH_MOCK: "true" });
    for (const key of ["DATABASE_URL", "OAUTH_MOCK", "SMTP_URL", "MAIL_FROM"]) expect(msg).toContain(key);
  });

  it("production refuses SMTP without TLS: smtps://, or smtp:// with requireTLS=true (STARTTLS)", () => {
    const prod = { ...base, NODE_ENV: "production", MAIL_TRANSPORT: "smtp", MAIL_FROM: "a@b.c" };
    for (const url of ["smtps://u:p@mail:465", "smtp://u:p@mail:587?requireTLS=true", "SMTPS://mail", "smtp://mail:587?name=x&requireTLS=true"]) {
      expect(loadConfig({ ...prod, SMTP_URL: url }).SMTP_URL).toBe(url);
    }
    for (const url of ["smtp://u:hunter2-smtp@mail:587", "smtp://mail:25?requireTLS=false", "smtp://mail:25?xrequireTLS=true"]) {
      const msg = failure({ ...prod, SMTP_URL: url });
      expect(msg).toContain("SMTP_URL (production needs smtps:// or ?requireTLS=true)");
      expect(msg).not.toContain("hunter2");
    }
    // Outside production a plain URL stays allowed (a local catcher such as Mailpit).
    expect(loadConfig({ ...base, MAIL_TRANSPORT: "smtp", MAIL_FROM: "a@b.c", SMTP_URL: "smtp://localhost:1025" }).SMTP_URL).toBe("smtp://localhost:1025");
  });

  it("loadDbConfig needs only the pool's keys, so a one-shot script loads the modules without the app's secrets", () => {
    expect(loadDbConfig({ DATABASE_URL: base.DATABASE_URL })).toEqual({ DATABASE_URL: base.DATABASE_URL, DB_POOL_MAX: 10 });
    expect(loadDbConfig({ DATABASE_URL: base.DATABASE_URL, DB_POOL_MAX: "3", INTERNAL_API_TOKEN: "" })).toEqual({ DATABASE_URL: base.DATABASE_URL, DB_POOL_MAX: 3 });
    expect(() => loadDbConfig({ DATABASE_URL: "" })).toThrow("Invalid API configuration: DATABASE_URL (invalid_type)");
  });

  it("production requires smtp", () => {
    expect(failure({ ...base, NODE_ENV: "production" })).toContain("MAIL_TRANSPORT");
    const msg = failure({ ...base, MAIL_TRANSPORT: "smtp" });
    expect(msg).toContain("SMTP_URL");
    expect(msg).toContain("MAIL_FROM");
  });

  it("a provider's keys come together or not at all; the Apple key must be a PKCS#8 PEM", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\\nMIGTAgEA\\n-----END PRIVATE KEY-----";
    const apple = { APPLE_CLIENT_ID: "com.example", APPLE_TEAM_ID: "T", APPLE_KEY_ID: "K", APPLE_PRIVATE_KEY: pem };
    expect(loadConfig({ ...base, GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "google-secret-value", ...apple }).APPLE_KEY_ID).toBe("K");
    const msg = failure({ ...base, GOOGLE_CLIENT_ID: "g", APPLE_CLIENT_ID: "com.example" });
    for (const key of ["GOOGLE_CLIENT_SECRET", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"]) expect(msg).toContain(key);
    expect(msg).not.toContain("GOOGLE_CLIENT_ID (");
    const bad = failure({ ...base, ...apple, APPLE_PRIVATE_KEY: "secret-but-not-a-pem" });
    expect(bad).toContain("APPLE_PRIVATE_KEY");
    expect(bad).not.toContain("secret-but-not-a-pem");
  });
});

/** The keys an env example file names, set or commented out (`KEY=` or `# KEY=` at the start of a line). */
const exampleKeys = (file: string) => new Set([...readFileSync(file, "utf8").matchAll(/^(?:# ?)?([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
const API = path.join(import.meta.dir, "../../../..");

describe("example env files", () => {
  it("apps/api/.env.example names every key of the config schema and the seeder", () => {
    const named = exampleKeys(path.join(API, ".env.example"));
    const seed = ["SEED_SUPERADMIN_NAME", "SEED_SUPERADMIN_EMAIL", "SEED_SUPERADMIN_USERNAME", "SEED_SUPERADMIN_PASSWORD"];
    expect([...CONFIG_KEYS, ...seed].filter((k) => !named.has(k))).toEqual([]);
  });

  it(".env.compose.example names every key docker-compose.yml reads", () => {
    const compose = readFileSync(path.join(API, "../../docker-compose.yml"), "utf8");
    const used = [...new Set([...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]!))];
    expect(used.length).toBeGreaterThan(10);
    const named = exampleKeys(path.join(API, "../../.env.compose.example"));
    expect(used.filter((k) => !named.has(k))).toEqual([]);
  });
});
