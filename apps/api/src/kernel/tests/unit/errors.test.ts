import { describe, expect, it, spyOn } from "bun:test";
import { DrizzleQueryError } from "drizzle-orm";
import { unexpected } from "../../errors";
import { log } from "../../log";

describe("unexpected", () => {
  it("a failed Drizzle query is logged as the driver's error, never its SQL or parameters", async () => {
    // Shaped as Bun SQL's PostgresError: `errno` is the SQLSTATE, `detail` and `hint` quote the row's values.
    const cause = Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
      name: "PostgresError", errno: "23505", code: "ERR_POSTGRES_SERVER_ERROR", constraint: "users_email_key", table: "users",
      detail: "Key (lower(email))=(leaked@example.com) already exists.", hint: "leaked-hint",
    });
    const err = new DrizzleQueryError('… "password_hash" = $1 where "users"."id" = $2', ["$argon2id$v=19$secret-hash", "a@b.c"], cause);
    const spy = spyOn(log, "error");
    try {
      const res = unexpected(err, "req-1");
      expect(res.status).toBe(500);
      const logged = JSON.stringify(spy.mock.calls[0]);
      expect(logged).toContain("PostgresError");
      expect(logged).toContain("users_email_key");
      expect(logged).not.toContain("argon2id");
      expect(logged).not.toContain("password_hash");
      expect((spy.mock.calls[0]![0] as unknown as { err: unknown }).err).toMatchObject({ code: "23505", constraint: "users_email_key", table: "users" });
      expect(logged).not.toContain("leaked");
    } finally {
      spy.mockRestore();
    }
  });
});
