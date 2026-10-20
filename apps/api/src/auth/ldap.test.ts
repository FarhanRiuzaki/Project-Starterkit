import { describe, expect, it } from "bun:test";
import { loadConfig } from "../config";
import { LDAP_PASSWORD } from "../seed/demo";
import { directory, userFilter } from "./ldap";

const base = {
  DATABASE_URL: "postgresql://app:pw@localhost:5432/app",
  INTERNAL_API_TOKEN: "t".repeat(40),
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};
const prod = { ...base, NODE_ENV: "production", MAIL_TRANSPORT: "smtp", SMTP_URL: "smtp://mail:25", MAIL_FROM: "a@b.c" };
const ldap = { LDAP_URL: "ldap://dir.example:389", LDAP_BASE_DN: "dc=example,dc=com", LDAP_BIND_DN: "cn=app", LDAP_BIND_PASSWORD: "bind-secret-value" };

/** The message of the error `loadConfig(env)` throws. */
function failure(env: Record<string, string | undefined>): string {
  try {
    loadConfig(env);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("loadConfig did not throw");
}

describe("ldap", () => {
  it("filter escapes `*()\\` and NUL", () => {
    expect(userFilter("(uid={username})", "a*b(c)d\\e\0f")).toBe("(uid=a\\2ab\\28c\\29d\\5ce\\00f)");
    expect(userFilter("(|(uid={username})(mail={username}))", "*")).toBe("(|(uid=\\2a)(mail=\\2a))");
    expect(userFilter("(uid={username})", "$&$'")).toBe("(uid=$&$')"); // no replacement patterns
  });

  it("mock verifies the demo account only", async () => {
    const dir = directory(loadConfig({ ...base, LDAP_MOCK: "true" }))!;
    expect(await dir.verify("ldap", LDAP_PASSWORD)).toBe(true);
    expect(await dir.verify("ldap", "Password123!")).toBe(false);
    expect(await dir.verify("admin", LDAP_PASSWORD)).toBe(false);
    expect(directory(loadConfig(base))).toBeNull();
    expect(directory(loadConfig({ ...base, ...ldap }))).not.toBeNull();
  });

  it("production with ldap:// and no StartTLS is a config error", () => {
    const msg = failure({ ...prod, ...ldap });
    expect(msg).toContain("LDAP_URL");
    expect(msg).not.toContain("bind-secret-value");
    expect(loadConfig({ ...prod, ...ldap, LDAP_STARTTLS: "true" }).LDAP_STARTTLS).toBe(true);
    expect(loadConfig({ ...prod, ...ldap, LDAP_URL: "ldaps://dir.example:636" }).LDAP_USER_FILTER).toBe("(uid={username})");
    expect(loadConfig({ ...base, ...ldap }).LDAP_URL).toBe(ldap.LDAP_URL); // fine outside production
    expect(failure({ ...base, LDAP_URL: "http://dir.example" })).toContain("LDAP_URL");
    expect(failure({ ...base, ...ldap, LDAP_BASE_DN: undefined })).toContain("LDAP_BASE_DN");
    expect(failure({ ...base, ...ldap, LDAP_USER_FILTER: "(uid=admin)" })).toContain("LDAP_USER_FILTER");
  });
});
