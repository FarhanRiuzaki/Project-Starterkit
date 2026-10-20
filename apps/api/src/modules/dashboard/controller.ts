// /v1/dashboard: port of apps/web/src/app/api/dashboard/route.ts. Any signed-in user (`guard: null`).
import { Elysia } from "elysia";
import { guard } from "../auth";
import { dashboard } from "./service";

/** The route of /v1/dashboard. */
export const dashboardController = () => new Elysia().use(guard).get("/v1/dashboard", ({ ctx }) => dashboard(ctx), { guard: null });
