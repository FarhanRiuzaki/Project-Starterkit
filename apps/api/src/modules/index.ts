import { Elysia } from "elysia";
import { auditController } from "./audit";
import { authController } from "./auth";
import { dashboardController } from "./dashboard";
import { healthController, type Pingable } from "./health";
import { meController } from "./me";
import { oauthController } from "./oauth";
import { rbacController } from "./rbac";
import { usersController } from "./users";

/** What tests may swap in when they build the app. */
export type AppDeps = { db?: Pingable };

/**
 * The module registry: every module's controller, mounted in this order. A new module = its folder + one line here.
 * Each app gets its own controller instances. rbac comes before users: it owns GET /v1/users/roles, which users'
 * /v1/users/:id must not take.
 */
export const modules = (deps: AppDeps = {}) =>
  new Elysia()
    .use(healthController(deps.db))
    .use(authController())
    .use(oauthController())
    .use(meController())
    .use(rbacController())
    .use(usersController())
    .use(auditController())
    .use(dashboardController());
