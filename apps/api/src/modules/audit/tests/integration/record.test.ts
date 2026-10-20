// Port of apps/web/src/lib/server/audit.test.ts.
import { beforeAll, describe, expect, it } from "bun:test";
import { desc, sql } from "drizzle-orm";
import { MASK } from "@starterkit/shared/audit";
import { resetData, signIn } from "../../../../../test/helpers/app";
import { db } from "../../../../kernel/db";
import { type Ctx, resolveSession } from "../../../auth";
import { recordActivity, recordAuth } from "../../record";
import { activity, authLog } from "../../schema";

beforeAll(resetData);

const ctxOf = async (login: string): Promise<Ctx> => ({ ...(await resolveSession(await signIn(login)))!, client: { ip: "127.0.0.1", ua: "" }, requestId: "r" });
const last = async <T extends typeof activity | typeof authLog>(table: T) => (await db.select().from(table as typeof activity).orderBy(desc(table.at), desc(table.id)).limit(1))[0]!;

describe("audit", () => {
  it("recordActivity stores the actor and a credential-free snapshot", async () => {
    const ctx = await ctxOf("twofa"); // has a password hash, a TOTP secret and recovery codes
    const user = ctx.user;
    await db.transaction((tx) => recordActivity(tx, ctx, { action: "user.update", target: { type: "user", id: user.id, label: user.name }, before: user }));
    const e = await last(activity);
    expect(e).toMatchObject({ actorId: user.id, actorName: user.name, action: "user.update", targetType: "user", targetId: user.id, targetLabel: user.name });
    expect(e.before).toMatchObject({ id: user.id, email: user.email });
    expect(JSON.stringify(e)).not.toMatch(/passwordHash|totpSecret|recoveryCodes|argon2|v1:/);
    expect(e.after).toBeNull();
  });

  it("recordAuth stores the entry", async () => {
    await recordAuth(db, { userId: null, login: "x9999", event: "login_failed", method: "password", ip: "unknown", device: "t", location: null });
    expect(await last(authLog)).toMatchObject({ userId: null, login: "x9999", event: "login_failed", method: "password", ip: "unknown", device: "t", location: null });
  });
});

describe("recordActivity masks credentials at store time", () => {
  it("any credential-named field, at any depth, is stored as MASK; null stays null; other fields stay", async () => {
    const ctx = await ctxOf("admin");
    const user = ctx.user;
    await db.transaction((tx) => recordActivity(tx, ctx, {
      action: "user.update", target: { type: "user", id: user.id, label: user.name },
      before: { password: "Old-Secret-1!", name: "A", apiToken: null },
      after: { newPassword: "New-Secret-2!", name: "B", nested: { clientSecret: "s3cr3t-value", recoveryCode: "aaaa-1111", label: "x" } },
    }));
    const e = await last(activity);
    expect(e.before).toEqual({ password: MASK, name: "A", apiToken: null });
    expect(e.after).toEqual({ newPassword: MASK, name: "B", nested: { clientSecret: MASK, recoveryCode: MASK, label: "x" } });
    expect(JSON.stringify(e)).not.toMatch(/Old-Secret|New-Secret|s3cr3t-value|aaaa-1111/);
  });

  it("no before/after (or null) is SQL NULL, not jsonb null", async () => {
    const ctx = await ctxOf("admin");
    await db.transaction((tx) => recordActivity(tx, ctx, { action: "user.delete", target: { type: "user", id: ctx.user.id, label: ctx.user.name }, after: null }));
    const [r] = await db.select({ b: sql`${activity.before} is null`, a: sql`${activity.after} is null` }).from(activity).orderBy(desc(activity.at), desc(activity.id)).limit(1);
    expect(r).toEqual({ b: true, a: true });
  });

  it("a non-object value is stored as JSON, not as text", async () => {
    const ctx = await ctxOf("admin");
    await db.transaction((tx) => recordActivity(tx, ctx, { action: "me.update", target: { type: "user", id: ctx.user.id, label: ctx.user.name }, before: "plain", after: ["a"] }));
    const [r] = await db.select({ b: sql`jsonb_typeof(${activity.before})`, a: sql`jsonb_typeof(${activity.after})` }).from(activity).orderBy(desc(activity.at), desc(activity.id)).limit(1);
    expect(r).toEqual({ b: "string", a: "array" });
  });
});
