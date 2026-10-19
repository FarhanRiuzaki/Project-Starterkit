import { z } from "zod";
import { ListQuery } from "./common";

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

export const AUTH_EVENTS = ["login_success", "login_failed", "logout", "2fa_success", "2fa_failed"] as const;

export const AuthLogDto = z.object({
  id: z.string(),
  at: z.string(),
  userId: z.string().nullable(),
  login: z.string(),
  event: z.enum(AUTH_EVENTS),
  method: z.enum(["password", "ldap", "google", "apple"]),
  ip: z.string(),
  device: z.string(),
  location: z.string().nullable(),
});
export type AuthLogDto = z.infer<typeof AuthLogDto>;

const range = { from: z.iso.datetime().optional(), to: z.iso.datetime().optional() };

export const ActivityQuery = ListQuery.extend({ ...range, actor: z.string().max(64).optional(), action: z.string().max(64).optional() });
export type ActivityQuery = z.infer<typeof ActivityQuery>;

export const AuthLogQuery = ListQuery.extend({
  ...range,
  event: z.enum(AUTH_EVENTS).optional(),
  method: z.enum(["password", "ldap", "google", "apple"]).optional(),
});
export type AuthLogQuery = z.infer<typeof AuthLogQuery>;
