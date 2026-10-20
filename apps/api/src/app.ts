import { Elysia } from "elysia";
import { Hono } from "hono";
import { auditRoutes } from "./audit/routes";
import { authRoutes } from "./auth/routes";
import { dashboardRoutes } from "./dashboard/routes";
import { bodyLimit as honoBodyLimit, type AppEnv, onError, requestContext } from "./http/middleware";
import { ApiError } from "./kernel/errors";
import { bodyLimit } from "./kernel/plugins/body-limit";
import { context } from "./kernel/plugins/context";
import { errorHandler } from "./kernel/plugins/error";
import { internalAuth } from "./kernel/plugins/internal-auth";
import { meRoutes } from "./me/routes";
import { type AppDeps, modules } from "./modules";
import { rbacRoutes } from "./rbac/routes";
import { usersRoutes } from "./users/routes";

/**
 * Transitional: the Hono routers not yet moved to modules (Tasks 16–18), as one app with their own paths (/v1/…).
 * Mount rbac before users: `/users/roles` must not reach `/users/:id`.
 */
export const legacy = new Hono<AppEnv>()
  .use(requestContext, honoBodyLimit)
  .route("/v1", authRoutes)
  .route("/v1", rbacRoutes) // owns /users/roles: keep it before the users router, whose /users/:id would capture it
  .route("/v1", usersRoutes)
  .route("/v1", meRoutes)
  .route("/v1", auditRoutes)
  .route("/v1", dashboardRoutes)
  .notFound(() => {
    throw new ApiError("not_found");
  })
  .onError(onError);

/**
 * The API: kernel plugins (error mapping, request context, body limit, internal token on /v1), the modules of the
 * registry, then the Hono routers for every path no module answers. Tests inject `db` for readyz.
 */
export function createApp(deps: AppDeps = {}) {
  return new Elysia()
    .use(errorHandler)
    .use(context)
    .use(bodyLimit)
    .use(internalAuth)
    .use(modules(deps))
    .mount(legacy.fetch);
}
