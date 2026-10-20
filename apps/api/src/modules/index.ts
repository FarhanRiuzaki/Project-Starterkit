import { Elysia } from "elysia";
import { authController } from "./auth";
import { healthController, type Pingable } from "./health";
import { meController } from "./me";
import { oauthController } from "./oauth";

/** What tests may swap in when they build the app. */
export type AppDeps = { db?: Pingable };

/**
 * The module registry: every module's controller, mounted in this order. A new module = its folder + one line here.
 * users, rbac, audit and dashboard are still the Hono routers mounted by app.ts (Tasks 17–18). Controllers are built
 * here, not when their module loads: auth and oauth import each other's index.
 */
export const modules = (deps: AppDeps = {}) =>
  new Elysia()
    .use(healthController(deps.db))
    .use(authController())
    .use(oauthController())
    .use(meController());
