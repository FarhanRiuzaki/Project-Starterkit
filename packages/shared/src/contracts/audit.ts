import { z } from "zod";
import { ACTIVITY_SORTS, AUTH_EVENTS, AUTH_LOG_SORTS, AUTH_METHODS, MAX_RANGE_DAYS, rangeProblem } from "../audit";
import { ListQuery, sortParam } from "./common";

export const ActivityDto = z.object({
  id: z.string(),
  at: z.string(),
  actor: z.object({ id: z.string(), name: z.string() }),
  action: z.string(),
  target: z.object({ type: z.string(), id: z.string(), label: z.string() }),
  before: z.unknown(),
  after: z.unknown(),
});
export type ActivityDto = z.infer<typeof ActivityDto>;

// The value lists live in ../audit (no zod) so screens can import them without shipping zod.
export { ACTIVITY_SORTS, AUTH_EVENTS, AUTH_LOG_SORTS, AUTH_METHODS };

export const AuthLogDto = z.object({
  id: z.string(),
  at: z.string(),
  userId: z.string().nullable(),
  login: z.string(),
  event: z.enum(AUTH_EVENTS),
  method: z.enum(AUTH_METHODS),
  ip: z.string(),
  device: z.string(),
  location: z.string().nullable(),
});
export type AuthLogDto = z.infer<typeof AuthLogDto>;

/**
 * Shared by both logs: paging (no `q`), an optional from–to pair of calendar dates in the app time zone (both days
 * included, to ≥ from, at most MAX_RANGE_DAYS), `user` (free text) and `format` (csv = the whole filtered list,
 * newest first, up to CSV_MAX_ROWS).
 */
const AuditQuery = ListQuery.omit({ q: true }).extend({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  user: z.string().trim().max(64).optional(),
  format: z.enum(["json", "csv"]).default("json"),
});
const validRange = [
  (q: { from?: string; to?: string }) => rangeProblem(q.from, q.to) === null,
  { message: `Dates: both or neither, to on or after from, at most ${MAX_RANGE_DAYS} days.` },
] as const;

/** GET /api/audit/activity. `user` matches the actor's name, id or current email; `action` is exact. */
export const ActivityQuery = AuditQuery.extend({ sort: sortParam(ACTIVITY_SORTS), action: z.string().max(64).optional() }).refine(...validRange);
export type ActivityQuery = z.infer<typeof ActivityQuery>;

/** GET /api/audit/auth. `user` matches the login or the user id. */
export const AuthLogQuery = AuditQuery.extend({
  sort: sortParam(AUTH_LOG_SORTS),
  event: z.enum(AUTH_EVENTS).optional(),
  method: z.enum(AUTH_METHODS).optional(),
}).refine(...validRange);
export type AuthLogQuery = z.infer<typeof AuthLogQuery>;
