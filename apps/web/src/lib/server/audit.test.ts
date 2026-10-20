import { beforeEach, describe, expect, it } from "vitest";
import { recordActivity, recordAuth } from "./audit";
import { db, resetDb } from "./mock/db";
import type { AuthCtx } from "./session";

beforeEach(() => void resetDb());

describe("audit", () => {
  it("recordActivity stores the actor and a credential-free snapshot", () => {
    const user = db().users.get("u-002")!;
    const ctx: AuthCtx = { user, sid: "s", perms: new Set() };
    recordActivity(ctx, { action: "user.update", target: { type: "user", id: user.id, label: user.name }, before: user });
    const e = [...db().activity.values()].at(-1)!;
    expect(e.actor).toEqual({ id: user.id, name: user.name });
    expect(e.before).toMatchObject({ id: user.id, email: user.email });
    expect(JSON.stringify(e)).not.toMatch(/passwordHash|totpSecret|recoveryCodes/);
    expect(e.after).toBeNull();
  });

  it("recordAuth keeps the log bounded at 10,000 entries by evicting the oldest", () => {
    const first = db().authLog.keys().next().value;
    for (let i = 0; i < 10_000; i++) {
      recordAuth({ userId: null, login: `x${i}`, event: "login_failed", method: "password", ip: "unknown", device: "t", location: null });
    }
    expect(db().authLog.size).toBe(10_000);
    expect(db().authLog.has(first!)).toBe(false);
    expect([...db().authLog.values()].at(-1)).toMatchObject({ login: "x9999", event: "login_failed" });
  });
});

describe("recordActivity masks credentials at store time", () => {
  it("any credential-named field, at any depth, is stored as MASK; null stays null; other fields stay", async () => {
    const { MASK } = await import("@starterkit/shared/audit");
    const user = db().users.get("u-002")!;
    const ctx: AuthCtx = { user, sid: "s", perms: new Set() };
    recordActivity(ctx, {
      action: "user.update", target: { type: "user", id: user.id, label: user.name },
      before: { password: "Old-Secret-1!", name: "A", apiToken: null },
      after: { newPassword: "New-Secret-2!", name: "B", nested: { clientSecret: "s3cr3t-value", recoveryCode: "aaaa-1111", label: "x" } },
    });
    const e = [...db().activity.values()].at(-1)!;
    expect(e.before).toEqual({ password: MASK, name: "A", apiToken: null });
    expect(e.after).toEqual({ newPassword: MASK, name: "B", nested: { clientSecret: MASK, recoveryCode: MASK, label: "x" } });
    expect(JSON.stringify(e)).not.toMatch(/Old-Secret|New-Secret|s3cr3t-value|aaaa-1111/);
  });
});
