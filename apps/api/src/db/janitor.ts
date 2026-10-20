// The clean-up job (spec "Operasional"): cross-module like the seeds, so it only calls each owning module's purge.
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { client } from "../kernel/db";
import { LOCKS } from "../kernel/locks";
import { log } from "../kernel/log";
import { purgeAudit } from "../modules/audit";
import { purgeAuth } from "../modules/auth";
import { purgeOAuth } from "../modules/oauth";

/**
 * One clean-up pass on one pool connection under the session lock LOCKS.janitor (`pg_try_advisory_lock`): null when
 * another process holds it, else the rows deleted per table (logged at info). Each delete commits on its own.
 */
export async function runJanitor(): Promise<Record<string, number> | null> {
  const conn = await client.reserve();
  try {
    const db = drizzle({ client: conn });
    const [lock] = await db.execute<{ ok: boolean }>(sql`select pg_try_advisory_lock(${LOCKS.janitor}) as ok`);
    if (!lock?.ok) return null;
    try {
      const counts = { ...(await purgeAuth(db)), ...(await purgeOAuth(db)), ...(await purgeAudit(db)) };
      log.info({ counts }, "janitor");
      return counts;
    } finally {
      // A failed unlock (a broken connection drops the lock anyway) must not hide the error above.
      await db.execute(sql`select pg_advisory_unlock(${LOCKS.janitor})`).catch(() => {});
    }
  } finally {
    conn.release();
  }
}

/** Runs the janitor now and every 5 minutes (the timer never keeps the process alive); returns the function that stops it. */
export function startJanitor(): () => void {
  const tick = () => void runJanitor().catch((err: unknown) => log.error({ err }, "janitor failed"));
  tick();
  const timer = setInterval(tick, 5 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
