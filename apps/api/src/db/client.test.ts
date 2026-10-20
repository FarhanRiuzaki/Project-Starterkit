import { expect, it } from "bun:test";
import { sql } from "./client";

it("every pool connection carries the statement and idle-in-transaction timeouts", async () => {
  const [row] = await sql`select current_setting('statement_timeout') as st, current_setting('idle_in_transaction_session_timeout') as idle`;
  expect(row).toEqual({ st: "5s", idle: "10s" });
});
