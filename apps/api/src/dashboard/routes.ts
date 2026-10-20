// /v1/dashboard: port of apps/web/src/app/api/dashboard/route.ts.
import { Hono } from "hono";
import { guard } from "../http/guard";
import type { AppEnv } from "../http/middleware";
import { dashboard } from "./queries";

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get("/dashboard", async (c) => {
  const ctx = await guard(c, null);
  return c.json(await dashboard(ctx));
});
