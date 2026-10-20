import { Elysia } from "elysia";
import { healthController, type Pingable } from "./health";

/** What tests may swap in when they build the app. */
export type AppDeps = { db?: Pingable };

/**
 * The module registry: every module's controller, mounted in this order. A new module = its folder + one line here.
 * auth, oauth, me, users, rbac, audit and dashboard are still the Hono routers mounted by app.ts (Tasks 16–18).
 */
export const modules = (deps: AppDeps = {}) => new Elysia().use(healthController(deps.db));
