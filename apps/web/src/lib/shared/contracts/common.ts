import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE, PAGE_SIZES } from "../paging";

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

export { DEFAULT_PAGE_SIZE, MAX_PAGE, PAGE_SIZES, type PageSize } from "../paging";

/**
 * Query of every list endpoint: `page` 1..MAX_PAGE, `pageSize` 15|25|50|100 (default 15), `q`, `sort`. Endpoints
 * narrow `sort` to their own keys with `sortParam`.
 */
export const ListQuery = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  // `meta.enum`: the emitted JSON Schema (docs/api) lists the sizes; a coerced pipe would otherwise read as any number.
  pageSize: z.coerce.number().pipe(z.union([z.literal(15), z.literal(25), z.literal(50), z.literal(100)])).default(DEFAULT_PAGE_SIZE).meta({ enum: [...PAGE_SIZES] }),
  q: z.string().max(200).optional(),
  sort: z.string().regex(/^-?[a-zA-Z]+$/).optional(),
});
export type ListQuery = z.infer<typeof ListQuery>;

/** `sort` limited to `keys`: "key" (ascending) or "-key" (descending). An enum, so the API contract lists the values. */
export const sortParam = (keys: readonly string[]) => z.enum(keys.flatMap((k) => [k, `-${k}`]) as [string, ...string[]]).optional();

/** One page of a list. `totalCapped` = the server stopped counting at `total` (the UI shows "100,000+"). */
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number; totalCapped?: boolean };

export const BulkResult = z.object({
  done: z.array(z.string()),
  skipped: z.array(z.object({ id: z.string(), code: z.string() })),
});
export type BulkResult = z.infer<typeof BulkResult>;
