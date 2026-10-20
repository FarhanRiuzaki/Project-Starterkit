import { describe, expect, it } from "bun:test";
import { loadConfig } from "./config";

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
    const prod = { ...base, NODE_ENV: "production", MAIL_TRANSPORT: "smtp", SMTP_URL: "smtp://mail:25", MAIL_FROM: "a@b.c" };
    expect(loadConfig(prod).NODE_ENV).toBe("production");
    expect(failure({ ...prod, OAUTH_MOCK: "true" })).toContain("OAUTH_MOCK");
    expect(failure({ ...prod, LDAP_MOCK: "true" })).toContain("LDAP_MOCK");
  });

  it("production requires smtp", () => {
    expect(failure({ ...base, NODE_ENV: "production" })).toContain("MAIL_TRANSPORT");
    const msg = failure({ ...base, MAIL_TRANSPORT: "smtp" });
    expect(msg).toContain("SMTP_URL");
    expect(msg).toContain("MAIL_FROM");
  });
});
