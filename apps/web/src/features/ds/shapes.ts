import type { Section } from "@/components/route-skeleton";
import type { DsPageId } from "./pages";

// Loading shapes of the design system pages: imported by each route's loading.tsx and by the page itself (BodyLoading,
// while its body chunk loads), kept apart so a loading.tsx never pulls a page's code into the route's first load.
// Heights at the 1440 px reference.

const HEADER: Section = { kind: "header", h: 50 };

/** What stands under each page's header until its body is there. /ds/data: under its first screen (the table title and the table). */
export const DS_BODY_SHAPE: Record<DsPageId, readonly Section[]> = {
  overview: [{ kind: "panels", panels: [[12, 260]] }, { kind: "panels", panels: [[12, 330]] }],
  foundations: [{ kind: "bar", h: 20 }, { kind: "panels", panels: [[12, 170]] }, { kind: "panels", panels: [[6, 300], [6, 300]] }],
  components: [{ kind: "panels", panels: [[6, 420], [6, 420]] }, { kind: "panels", panels: [[6, 330], [6, 330]] }],
  forms: [{ kind: "panels", panels: [[12, 330]] }, { kind: "panels", panels: [[12, 420]] }],
  feedback: [{ kind: "panels", panels: [[12, 150]] }, { kind: "bar", h: 20 }, { kind: "panels", panels: [[12, 540]] }],
  data: [{ kind: "bar", h: 20 }, { kind: "panels", panels: [[12, 640]] }],
  visuals: [{ kind: "bar", h: 20 }, { kind: "panels", panels: [[12, 540]] }],
  motion: [{ kind: "bar", h: 64 }, { kind: "panels", panels: [[12, 420]] }, { kind: "panels", panels: [[12, 640]] }],
};

/** Each route's loading shape: the header and the body's shape. /ds/data: its first screen (the notice, then the headline numbers with the chart grid as one block). */
export const DS_SHAPE: Record<DsPageId, readonly Section[]> = {
  overview: [HEADER, ...DS_BODY_SHAPE.overview],
  foundations: [HEADER, ...DS_BODY_SHAPE.foundations],
  components: [HEADER, ...DS_BODY_SHAPE.components],
  forms: [HEADER, ...DS_BODY_SHAPE.forms],
  feedback: [HEADER, ...DS_BODY_SHAPE.feedback],
  data: [HEADER, { kind: "bar", h: 40 }, { kind: "panels", panels: [[12, 794]] }],
  visuals: [HEADER, ...DS_BODY_SHAPE.visuals],
  motion: [HEADER, ...DS_BODY_SHAPE.motion],
};
