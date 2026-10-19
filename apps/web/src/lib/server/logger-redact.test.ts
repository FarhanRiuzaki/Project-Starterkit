import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

/** A pino destination that keeps every line in memory. */
function capture() {
  const lines: string[] = [];
  const log = createLogger({ write: (s: string) => void lines.push(s) });
  return { log, out: () => lines.join("") };
}

describe("logger redaction", () => {
  it("redacts an otpauth field", () => {
    const { log, out } = capture();
    log.info({ otpauth: "otpauth://totp/x?secret=ABC" }, "x");
    expect(out()).not.toContain("ABC");
    expect(out()).not.toContain("otpauth://totp");
  });

  it("masks an otpauth URI inside the message string", () => {
    const { log, out } = capture();
    log.warn("got otpauth://totp/x?secret=ABCDEFGH");
    expect(out()).not.toContain("ABC");
    expect(out()).toContain("got ");
  });

  it("masks the URI and a bare secret= inside any string value, nested too", () => {
    const { log, out } = capture();
    log.info({ detail: "see otpauth://totp/J:u?secret=JBSWY3DPEHPK3PXP&issuer=J now", nested: { note: "secret=KRSXG5CTMVRXEZLU" }, list: ["Secret: MZXW6YTBOI======"] }, "y"); // gitleaks:allow (fixture placeholders)
    expect(out()).not.toMatch(/JBSWY3DPEHPK3PXP|KRSXG5CTMVRXEZLU|MZXW6YTBOI/);
    expect(out()).toContain("now");
  });

  it("masks printf-style arguments", () => {
    const { log, out } = capture();
    log.info("uri %s", "otpauth://totp/x?secret=ABCDEFGH");
    expect(out()).not.toContain("ABCDEFGH");
  });

  it("redacts uri, secret, phone, email (and one level down)", () => {
    const { log, out } = capture();
    log.info({
      uri: "U-VALUE", secret: "S-VALUE", phone: "+628120000", email: "a@b.invalid",
      user: { uri: "U2", secret: "S2", phone: "P2", email: "E2@x", otpauth: "O2" },
    }, "z");
    for (const v of ["U-VALUE", "S-VALUE", "+628120000", "a@b.invalid", "U2", "S2", "P2", "E2@x", "O2"]) {
      expect(out()).not.toContain(v);
    }
  });

  it("redacts the user record's credential fields (and one level down)", () => {
    const { log, out } = capture();
    log.info({
      passwordHash: "H-VALUE", totpSecret: "T-VALUE", recoveryCodes: ["R-VALUE"], token: "K-VALUE",
      user: { passwordHash: "H2", totpSecret: "T2", recoveryCodes: ["R2"], token: "K2" },
    }, "r");
    for (const v of ["H-VALUE", "T-VALUE", "R-VALUE", "K-VALUE", "H2", "T2", "R2", "K2"]) expect(out()).not.toContain(v);
  });

  it("masks the message of a logged error", () => {
    const { log, out } = capture();
    log.error({ err: new Error("bad otpauth://totp/x?secret=ABCDEFGH") }, "failed");
    expect(out()).not.toContain("ABCDEFGH");
  });

  it("masks the message pino takes from a bare Error", () => {
    const { log, out } = capture();
    log.error(new Error("bad otpauth://totp/x?secret=ABCDEFGH"));
    expect(out()).not.toContain("ABCDEFGH");
    expect((JSON.parse(out()) as { msg: string }).msg).toContain("bad ");
  });

  it("masks the message pino takes from { err } when no message is given", () => {
    const { log, out } = capture();
    log.error({ err: new Error("bad otpauth://totp/x?secret=ABCDEFGH") });
    expect(out()).not.toContain("ABCDEFGH");
  });

  it("masks object printf arguments (%o, %j)", () => {
    const { log, out } = capture();
    log.info("obj %o", { d: "otpauth://totp/x?secret=ABCDEFGH" });
    log.info("obj %j", { d: "secret=IJKLMNOP" });
    expect(out()).not.toMatch(/ABCDEFGH|IJKLMNOP/);
  });

  it("masks child bindings", () => {
    const { log, out } = capture();
    log.child({ note: "otpauth://totp/x?secret=ABCDEFGH" }).info("c");
    log.child({ a: 1 }).child({ note: "secret=IJKLMNOP" }).info("g");
    expect(out()).not.toMatch(/ABCDEFGH|IJKLMNOP/);
    expect(out()).toContain('"msg":"c"');
  });

  it("keeps an error's identifier code diagnosable, still redacts a plain code field", () => {
    const { log, out } = capture();
    log.error({ err: Object.assign(new Error("x"), { code: "wrong_code" }) }, "e");
    log.info({ code: "123456" }, "otp");
    expect(out()).toContain('"errCode":"wrong_code"');
    expect(out()).not.toContain("123456");
  });

  it("logs a URL object without throwing, with its password masked", () => {
    const { log, out } = capture();
    expect(() => log.info({ url: new URL("http://u:pw-SECRET@h.invalid/p?x=1") }, "u")).not.toThrow();
    expect(out()).toContain("h.invalid/p");
    expect(out()).not.toContain("pw-SECRET");
  });

  it("does not mutate the caller's object", () => {
    const { log } = capture();
    const o = { detail: "otpauth://totp/x?secret=ABCDEFGH" };
    log.info(o, "m");
    expect(o.detail).toBe("otpauth://totp/x?secret=ABCDEFGH");
  });

  it("keeps ordinary fields intact", () => {
    const { log, out } = capture();
    log.info({ user: { username: "admin" }, action: "user.update" }, "ok");
    const line = JSON.parse(out()) as Record<string, unknown>;
    expect(line.user).toEqual({ username: "admin" });
    expect(line.action).toBe("user.update");
    expect(line.msg).toBe("ok");
  });
});
