import { z } from "zod";

export const ERROR_CODES = [
  "unauthenticated", "forbidden", "csrf", "not_found", "bad_request", "duplicate", "rate_limited",
  "invalid_credentials", "account_inactive", "invalid_code", "superadmin_locked", "last_superadmin",
  "self_action", "role_in_use", "ldap_password", "internal",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401, forbidden: 403, csrf: 403, not_found: 404, bad_request: 400, duplicate: 409,
  rate_limited: 429, invalid_credentials: 401, account_inactive: 403, invalid_code: 400,
  superadmin_locked: 409, last_superadmin: 409, self_action: 409, role_in_use: 409, ldap_password: 409,
  internal: 500,
};

export const ApiErrorBody = z.object({ error: z.object({ code: z.enum(ERROR_CODES), message: z.string() }) });
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).default(25),
  q: z.string().max(200).optional(),
  sort: z.string().regex(/^-?[a-zA-Z]+$/).optional(),
});
export type ListQuery = z.infer<typeof ListQuery>;

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export const BulkResult = z.object({
  done: z.array(z.string()),
  skipped: z.array(z.object({ id: z.string(), code: z.string() })),
});
export type BulkResult = z.infer<typeof BulkResult>;

export const BulkBody = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) });
export type BulkBody = z.infer<typeof BulkBody>;
