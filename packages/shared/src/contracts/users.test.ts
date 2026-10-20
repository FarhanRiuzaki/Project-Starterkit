import { describe, expect, it } from "vitest";
import { CreateUserBody } from "./users";

const BASE = { name: "New Person", username: "new.person", email: "new.person@example.com" };

describe("CreateUserBody", () => {
  it("an invite needs an active user; an inactive user with a password is fine", () => {
    const r = CreateUserBody.safeParse({ ...BASE, isActive: false, invite: true });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(["An invitation needs an active user. Set the user active, or set a password instead."]);
    expect(CreateUserBody.safeParse({ ...BASE, invite: true }).success).toBe(true);
    expect(CreateUserBody.safeParse({ ...BASE, isActive: false, password: "Brand-New-Pass-1!" }).success).toBe(true);
  });
});
