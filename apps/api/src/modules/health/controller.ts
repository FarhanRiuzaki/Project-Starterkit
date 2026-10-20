import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { db as appDb } from "../../kernel/db";

/** What readyz needs from the database: one query. Tests pass one that fails or never answers. */
export type Pingable = { execute: (q: ReturnType<typeof sql>) => PromiseLike<unknown> };

/** `select 1` answers within 2 s. */
async function dbReady(db: Pingable): Promise<boolean> {
  try {
    await Promise.race([db.execute(sql`select 1`), Bun.sleep(2000).then(() => Promise.reject(new Error("readyz timeout")))]);
    return true;
  } catch {
    return false;
  }
}

/** `/healthz` (the process answers) and `/readyz` (the database answers too; 503 when not). No token needed. */
export const healthController = (db: Pingable = appDb) =>
  new Elysia()
    .get("/healthz", () => ({ ok: true }))
    .get("/readyz", async ({ set }) => {
      if (await dbReady(db)) return { ok: true };
      set.status = 503;
      return { ok: false };
    });
