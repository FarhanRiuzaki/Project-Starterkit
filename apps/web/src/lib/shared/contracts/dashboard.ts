import { z } from "zod";

export const DashboardDto = z.object({
  users: z.object({ total: z.number().int(), active: z.number().int(), inactive: z.number().int(), twoFactor: z.number().int() }),
  roles: z.array(z.object({ name: z.string(), userCount: z.number().int() })),
  /** Sign-in outcomes per day, oldest first. */
  signIns: z.array(z.object({ day: z.string(), success: z.number().int(), failed: z.number().int() })),
});
export type DashboardDto = z.infer<typeof DashboardDto>;
