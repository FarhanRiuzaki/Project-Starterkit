import { describe, expect, it, spyOn } from "bun:test";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("verifies the right password, rejects a wrong one", async () => {
    const hash = await hashPassword("Correct-Horse-1!");
    expect(hash).toStartWith("$argon2id$v=19$m=19456,t=2,");
    expect(await verifyPassword("Correct-Horse-1!", hash)).toBe(true);
    expect(await verifyPassword("Correct-Horse-2!", hash)).toBe(false);
  });

  it("null hash returns false after a full verify", async () => {
    const spy = spyOn(Bun.password, "verify");
    try {
      expect(await verifyPassword("anything", null)).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![1]).toStartWith("$argon2id$v=19$m=19456,t=2,"); // a real argon2id hash, same cost
    } finally {
      spy.mockRestore();
    }
  });
});
