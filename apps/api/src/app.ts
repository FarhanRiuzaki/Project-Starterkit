import type { SQL } from "bun";
import { Hono } from "hono";
import { sql } from "./db/client";
import { ApiError, onError } from "./http/errors";
import { type AppEnv, bodyLimit, internalAuth, requestContext } from "./http/middleware";

/** `select 1` answers within 2 s. */
async function dbReady(db: SQL): Promise<boolean> {
  try {
    await Promise.race([db`select 1`, Bun.sleep(2000).then(() => Promise.reject(new Error("readyz timeout")))]);
    return true;
  } catch {
    return false;
  }
}

/** The API: middleware, health routes and the `/v1` module routers. Tests inject `db` for readyz. */
export function createApp(deps: { db?: SQL } = {}) {
  const db = deps.db ?? sql;
  const app = new Hono<AppEnv>();
  app.use(requestContext, bodyLimit);
  app.use("/v1/*", internalAuth);
  app.get("/healthz", (c) => c.json({ ok: true }));
  app.get("/readyz", async (c) => ((await dbReady(db)) ? c.json({ ok: true }) : c.json({ ok: false }, 503)));
  // Module routers mount here: app.route("/v1", …).
  app.notFound(() => {
    throw new ApiError("not_found");
  });
  app.onError(onError);
  return app;
}
