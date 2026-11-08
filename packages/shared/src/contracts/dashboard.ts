import { z } from "zod";
import { ActivityDto } from "./audit";
import { MAX_RANGE_DAYS, rangeProblem } from "../audit";

import { isTimeExpression, timeRangeProblem, MAX_TIME_RANGE_DAYS } from "@starterkit/ui/lib/time-range";

export const DashboardQuery = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional(), start: z.string().max(100).refine(isTimeExpression).optional(), end: z.string().max(100).refine(isTimeExpression).optional() })
  .refine((q) => rangeProblem(q.from, q.to) === null && timeRangeProblem(q, Date.now()) === null, { message: `Choose both dates in order, up to ${MAX_RANGE_DAYS} days.` });
export type DashboardQuery = z.infer<typeof DashboardQuery>;

/** Days in `loginsPerDay`. */
export const DASHBOARD_DAYS = 14;

/**
 * GET /api/dashboard (any signed-in user). Audit-derived detail needs `audit.view`: without it `failedLogins24h`,
 * `failedLoginsPrev24h`, `recent` and every day's `failed` count are null (successful sign-ins stay). `loginsPerDay` = sign-in outcomes for the 14 calendar days in the app time zone ending today,
 * oldest first, every day present (0 when nothing happened).
 */
export const DashboardDto = z.object({
  activeUsers: z.number().int(),
  /** Users created in the last 7 × 24 hours. */
  newUsers7d: z.number().int(),
  /** Users created in the 7 × 24 hours before those: the tile's comparison. */
  newUsersPrev7d: z.number().int(),
  /** `login_failed` entries in the last 24 hours. */
  failedLogins24h: z.number().int().nullable(),
  /** `login_failed` entries in the 24 hours before those: the tile's comparison. */
  failedLoginsPrev24h: z.number().int().nullable(),
  /** Live store sessions of active users. */
  activeSessions: z.number().int(),
  loginsPerDay: z.array(z.object({ date: z.iso.date(), success: z.number().int(), failed: z.number().int().nullable() })).min(1).max(MAX_TIME_RANGE_DAYS + 1),
  /** Present for an explicitly selected range. Snapshot counts and recent activity keep their own scope. */
  period: z.object({
    from: z.iso.date(), to: z.iso.date(), start: z.iso.datetime().optional(), end: z.iso.datetime().optional(), newUsers: z.number().int(), previousNewUsers: z.number().int(),
    failedSignIns: z.number().int().nullable(), previousFailedSignIns: z.number().int().nullable(),
  }).optional(),
  /** The 5 newest activity entries. */
  recent: z.array(ActivityDto).max(5).nullable(),
});
export type DashboardDto = z.infer<typeof DashboardDto>;
