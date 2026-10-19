import type { Section } from "@/components/route-skeleton";

// Loading shapes of this feature's screens: imported by each route's loading.tsx and by the screen itself (LoadingShape),
// kept apart so a loading.tsx never pulls a screen's code into the route's first load.

/**
 * Loading shape of /users/[id] (its loading.tsx uses the same list) with the loaded page's section heights at the
 * 1440 px reference width (components/route-skeleton): the detail cards (two rows, 16 px apart on the page; the second
 * row is 8 px shorter here for the 24 px section gap), sessions, activity.
 */
export const USER_DETAIL_SHAPE: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "panels", panels: [[6, 203], [6, 203]] },
  { kind: "panels", panels: [[12, 195]] },
  { kind: "table", chrome: 154, rows: 3, rowHeight: 44 },
  { kind: "table", chrome: 96, rows: 2, rowHeight: 44, perm: "audit.view" },
];
/** Loading shapes (their routes' loading.tsx use the same lists), section heights at the 1440 px reference width. */
export const CREATE_USER_SHAPE: readonly Section[] = [{ kind: "header", h: 50 }, { kind: "panels", panels: [[12, 724]] }];
export const EDIT_USER_SHAPE: readonly Section[] = [{ kind: "header", h: 50 }, { kind: "panels", panels: [[12, 502]] }];
