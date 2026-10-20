// /v1/audit/*: port of apps/web/src/app/api/audit/**. Read-only, so nothing is recorded. `format=csv` answers the whole
// filtered list (newest first, CSV_MAX_ROWS at most) instead of a page.
import { Hono } from "hono";
import { ActivityQuery, AuthLogQuery } from "@starterkit/shared/contracts/audit";
import { guard } from "../http/guard";
import type { AppEnv } from "../http/middleware";
import { query } from "../http/parse";
import { activityCsv, activityPage, authLogCsv, authLogPage, csvResponse } from "./queries";

export const auditRoutes = new Hono<AppEnv>();

auditRoutes.get("/audit/activity", async (c) => {
  const q = query(c, ActivityQuery);
  await guard(c, "audit.view");
  return q.format === "csv" ? csvResponse("activity", await activityCsv(q)) : c.json(await activityPage(q));
});

auditRoutes.get("/audit/auth", async (c) => {
  const q = query(c, AuthLogQuery);
  await guard(c, "audit.view");
  return q.format === "csv" ? csvResponse("sign-in", await authLogCsv(q)) : c.json(await authLogPage(q));
});
