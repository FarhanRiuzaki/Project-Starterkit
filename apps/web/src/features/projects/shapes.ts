import type { Section } from "@/components/route-skeleton";

// Loading shapes of this feature's screens: imported by each route's loading.tsx and by the screen itself (LoadingShape),
// kept apart so a loading.tsx never pulls a screen's code into the route's first load. Heights at the 1440 px reference.

/** /projects/[id]: the header and the details card. */
export const PROJECT_DETAIL_SHAPE: readonly Section[] = [{ kind: "header", h: 50 }, { kind: "panels", panels: [[12, 220]] }];
/** /projects/new and /projects/[id]/edit: the header and the form card. */
export const PROJECT_FORM_SHAPE: readonly Section[] = [{ kind: "header", h: 50 }, { kind: "panels", panels: [[12, 470]] }];
