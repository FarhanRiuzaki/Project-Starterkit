import type { Section } from "@/components/route-skeleton";

// Loading shapes of this feature's screens: imported by each route's loading.tsx and by the screen itself (LoadingShape),
// kept apart so a loading.tsx never pulls a screen's code into the route's first load.

/** Loading shape of /roles/[id] (its loading.tsx uses the same list), section heights at the 1440 px reference width. */
export const ROLE_DETAIL_SHAPE: readonly Section[] = [
  { kind: "header", h: 50 },
  { kind: "panels", panels: [[12, 256]] },
];
