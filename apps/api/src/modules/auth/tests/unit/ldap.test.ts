import { describe, expect, it, spyOn } from "bun:test";
import { LDAP_PASSWORD } from "../../../../db/seed/demo";
import { loadConfig } from "../../../../kernel/config";
import { log } from "../../../../kernel/log";
import { directory, userFilter } from "../../ldap";

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

  it("a directory that never answers fails within the total timeout, closes the socket and logs no password", async () => {
    let closed = false;
    const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {}, close() { closed = true; } } }); // accepts, never answers
    const warn = spyOn(log, "warn");
    try {
      const dir = directory(loadConfig({ ...base, ...ldap, LDAP_URL: `ldap://127.0.0.1:${server.port}` }), 300)!;
      const t0 = performance.now();
      expect(await dir.verify("rina", "dir-secret-value")).toBe(false);
      expect(performance.now() - t0).toBeLessThan(1000); // 3 operations, one 300 ms budget
      await Bun.sleep(50);
      expect(closed).toBe(true);
      const lines = JSON.stringify(warn.mock.calls);
      expect(warn).toHaveBeenCalledTimes(1);
      expect((warn.mock.calls[0]![0] as unknown as { err: Error }).err).toBeInstanceOf(Error); // the total timer or the client's own per-step timeout, whichever fires first
      expect(lines).not.toContain("dir-secret-value");
      expect(lines).not.toContain("bind-secret-value");
    } finally {
      warn.mockRestore();
      server.stop(true);
    }
  });
});
