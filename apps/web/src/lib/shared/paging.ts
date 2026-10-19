// Table paging limits shared by the contracts (zod, server) and the browser's table state (no zod in client bundles).

/** Rows per page a list endpoint accepts; the first is the default. */
export const PAGE_SIZES = [15, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 15;
/** Deepest page a list serves; deeper is 400 (narrow the filters instead). */
export const MAX_PAGE = 1000;
