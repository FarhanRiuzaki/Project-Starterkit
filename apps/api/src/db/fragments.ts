// Transitional: the raw-SQL session fragment of the Hono dashboard route until Task 18; the Drizzle version (and
// everything else about sessions) lives in modules/auth.
import { config } from "../kernel/config";
import { sql } from "./client";

/** SQL: session `s` has not ended (SESSION_TTL_HOURS since sign-in, SESSION_IDLE_MINUTES since its last request). */
export const sessionLive = () =>
  sql`s.expires_at > now() and s.last_seen_at >= now() - make_interval(mins => ${config().SESSION_IDLE_MINUTES})`;
