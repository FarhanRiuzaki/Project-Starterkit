import { describe, expect, it } from "bun:test";
import type { UserRow } from "../../../auth";
import { toMe } from "../../service";

const row: UserRow = {
  id: "01a157f3-5cd2-775d-8c0e-776380fdaa33", name: "Admin User", username: "admin", email: "admin@example.com", avatarUrl: null,
  isActive: true, isLdap: false, passwordHash: "$argon2id$hash", totpSecret: "v1:secret", pendingTotpSecret: "v1:pending", totpLastStep: 7,
  twoFactorEnabled: true, roles: ["Admin"], connected: ["google"], lastLoginAt: null, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("toMe", () => {
  it("answers the user with hasPassword and without the secret fields", () => {
    const me = toMe(row);
    expect(me).toMatchObject({ username: "admin", twoFactorEnabled: true, connected: ["google"], hasPassword: true });
    expect(JSON.stringify(me)).not.toMatch(/argon2id|v1:secret|v1:pending|totpLastStep/);
    expect(toMe({ ...row, passwordHash: null }).hasPassword).toBe(false);
  });
});
