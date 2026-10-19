import { describe, expect, it } from "vitest";
import { toUserDto } from "./db";
import { verifyPassword } from "./password";
import { SEED_PASSWORD, LDAP_PASSWORD, TOTP_SECRET, seed } from "./seed";

const NOW = Date.parse("2026-10-19T00:00:00.000Z");
const strip = (s: ReturnType<typeof seed>) =>
  JSON.stringify([...s.users.values()].map((u) => ({ ...u, passwordHash: !!u.passwordHash, recoveryCodes: u.recoveryCodes.length })));

describe("seed", () => {
  const s = seed(NOW);
  const byEmail = (e: string) => [...s.users.values()].find((u) => u.email === e)!;

  it("is deterministic and has every fixed account", () => {
    const again = seed(NOW);
    expect(strip(again)).toBe(strip(s));
    expect(JSON.stringify([...again.activity.values()])).toBe(JSON.stringify([...s.activity.values()]));
    expect(JSON.stringify([...again.authLog.values()])).toBe(JSON.stringify([...s.authLog.values()]));
    for (const e of ["superadmin", "admin", "viewer", "twofa", "inactive", "ldap", "google", "apple"])
      expect(byEmail(`${e}@example.com`), e).toBeTruthy();
  });
  it("has the agreed shape", () => {
    expect(s.users.size).toBe(50);
    expect(s.roles.size).toBe(3);
    expect(s.activity.size).toBeGreaterThanOrEqual(180);
    expect(s.authLog.size).toBeGreaterThanOrEqual(280);
    expect(byEmail("superadmin@example.com").roles).toEqual(["Superadmin"]);
    expect(byEmail("twofa@example.com")).toMatchObject({ roles: ["Admin"], twoFactorEnabled: true, totpSecret: TOTP_SECRET });
    expect(byEmail("twofa@example.com").recoveryCodes.length).toBeGreaterThan(0);
    expect(byEmail("inactive@example.com").isActive).toBe(false);
    expect(byEmail("google@example.com").connected).toEqual(["google"]);
    expect(byEmail("apple@example.com").connected).toEqual(["apple"]);
    const ldap = byEmail("ldap@example.com");
    expect(ldap).toMatchObject({ isLdap: true, passwordHash: null, roles: ["Viewer"] });
    expect(s.ldapDirectory.get(ldap.id)).toBe(LDAP_PASSWORD);
  });
  it("password accounts share the one seed password, hashed once", () => {
    expect(verifyPassword(SEED_PASSWORD, byEmail("admin@example.com").passwordHash!)).toBe(true);
    expect(s.users.get(byEmail("admin@example.com").id)!.passwordHash).toBe(byEmail("viewer@example.com").passwordHash);
  });
  it("toUserDto strips secrets", () => {
    const u = byEmail("twofa@example.com");
    const dto = toUserDto(u);
    for (const k of ["passwordHash", "totpSecret", "recoveryCodes"]) expect(dto).not.toHaveProperty(k);
    const json = JSON.stringify(dto);
    expect(json).not.toContain(u.passwordHash!);
    expect(json).not.toContain(TOTP_SECRET);
    expect(dto.email).toBe("twofa@example.com");
  });
  it("spreads logs over the last 30 days", () => {
    const ts = [...s.authLog.values()].map((l) => Date.parse(l.at));
    expect(Math.max(...ts)).toBeLessThanOrEqual(NOW);
    expect(Math.min(...ts)).toBeGreaterThanOrEqual(NOW - 30 * 86400_000);
  });
});
