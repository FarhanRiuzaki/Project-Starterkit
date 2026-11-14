/**
 * The design system's eight pages, in sidebar order: `label` is the sidebar's, `title` the page's h1 and document
 * title, `summary` its line on the Overview page. Each page is `app/(main)/ds/…/page.tsx` + `pages/<id>.tsx`.
 */
export const DS_PAGES = [
  { id: "overview", href: "/ds", label: "Overview", title: "Design system", summary: "The component catalog and the way to every other page." },
  { id: "foundations", href: "/ds/foundations", label: "Foundations", title: "Foundations", summary: "Brand, surfaces, color, the type scale and the icon library." },
  { id: "components", href: "/ds/components", label: "Components", title: "Components", summary: "Buttons, inputs, chips, tabs, meters, menus, dialogs and navigation." },
  { id: "forms", href: "/ds/forms", label: "Forms", title: "Forms", summary: "Form controls, calendars and time, form layouts, validation and flows." },
  { id: "feedback", href: "/ds/feedback", label: "Feedback", title: "Feedback", summary: "Dialogs, drawers, popovers, the command palette and toasts." },
  { id: "data", href: "/ds/data", label: "Data display", title: "Data display", summary: "Headline numbers, charts, tables with their states, and data compositions." },
  { id: "visuals", href: "/ds/visuals", label: "Illustrations", title: "Illustrations", summary: "Illustrations, motion scenes and blocks from affectUI." },
  { id: "motion", href: "/ds/motion", label: "Motion", title: "Motion", summary: "Motion tokens, replayable patterns and the reduced-motion rules." },
] as const;

export type DsPageId = (typeof DS_PAGES)[number]["id"];

/** The page that holds each catalog section's anchor (`#ds-<section>`). */
export const SECTION_PAGE = {
  primitives: "components", navigation: "components", forms: "forms", time: "forms", compositions: "forms", overlays: "feedback",
  tables: "data", data: "data", icons: "foundations", foundations: "foundations",
} as const satisfies Record<string, DsPageId>;

export type DsSection = keyof typeof SECTION_PAGE;

/** The page that shows each affectUI group, after its own sections. */
export const AFFECT_PAGE = {
  actions: "components", inputs: "forms", feedback: "feedback", content: "data", visuals: "visuals",
} as const satisfies Record<string, DsPageId>;

export type AffectGroupId = keyof typeof AFFECT_PAGE;

/** Where a catalog section's live example is: its page and anchor. */
export const sectionHref = (section: DsSection) => `/ds/${SECTION_PAGE[section]}#ds-${section}`;
