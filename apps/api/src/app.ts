import { Elysia } from "elysia";
import { bodyLimit } from "./kernel/plugins/body-limit";
import { context } from "./kernel/plugins/context";
import { errorHandler } from "./kernel/plugins/error";
import { internalAuth } from "./kernel/plugins/internal-auth";
import { type AppDeps, modules } from "./modules";

/**
 * The API: kernel plugins (error mapping, request context, body limit, internal token on /v1), then the modules of the
 * registry. Tests inject `db` for readyz. A trailing slash is another path (`/v1/me/` is 404).
 */
export function createApp(deps: AppDeps = {}) {
  return new Elysia({ strictPath: true })
    .use(errorHandler)
    .use(context)
    .use(bodyLimit)
    .use(internalAuth)
    .use(modules(deps));
}
