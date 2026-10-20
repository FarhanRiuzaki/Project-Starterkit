// /v1/audit/*: port of apps/web/src/app/api/audit/**. Read-only, so nothing is recorded. Query 400 → guard 401/403 →
// page, or with `format=csv` the whole filtered list (newest first, CSV_MAX_ROWS at most) instead of a page.
import { Elysia } from "elysia";
import { ActivityQuery, AuthLogQuery } from "@starterkit/shared/contracts/audit";
import { csvFileName } from "@starterkit/ui/lib/csv";
import { guard } from "../auth";
import { activityCsv, activityPage, authLogCsv, authLogPage } from "./service";

/** A CSV attachment `<prefix>-<date in the app time zone>.csv`, never cached. */
const csvResponse = (prefix: string, text: string): Response =>
  new Response(text, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(prefix, Date.now())}"`,
      "Cache-Control": "no-store",
    },
  });

/** The routes of /v1/audit. */
export const auditController = () =>
  new Elysia()
    .use(guard)
    .get("/v1/audit/activity", async ({ query }) => (query.format === "csv" ? csvResponse("activity", await activityCsv(query)) : activityPage(query)),
      { query: ActivityQuery, guard: "audit.view" })
    .get("/v1/audit/auth", async ({ query }) => (query.format === "csv" ? csvResponse("sign-in", await authLogCsv(query)) : authLogPage(query)),
      { query: AuthLogQuery, guard: "audit.view" });
