import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMPONENT_INVENTORY } from "./component-inventory";
import { AFFECT_PAGE, DS_PAGES, type DsPageId, SECTION_PAGE, sectionHref } from "./pages";

const HERE = import.meta.dirname;
const APP = path.resolve(HERE, "../../app/(main)/ds");
const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8") : "");
/** A page's own source: its screen and, when it has one, its body. */
const source = (id: DsPageId) => read(path.join(HERE, "pages", `${id}.tsx`)) + read(path.join(HERE, "pages", `${id}-body.tsx`));
const routeDir = (href: string) => path.join(APP, href.slice("/ds".length));
/** A page's source with the section files it imports from this folder (`../form-section` …). */
const withSections = (id: DsPageId) => source(id) + [...source(id).matchAll(/from "\.\.\/([\w-]+)"/g)].map((m) => read(path.join(HERE, `${m[1]}.tsx`))).join("");

describe("design system pages", () => {
  it("are these eight routes, in sidebar order", () => {
    expect(DS_PAGES.map((p) => [p.href, p.label, p.title])).toEqual([
      ["/ds", "Overview", "Design system"], ["/ds/foundations", "Foundations", "Foundations"], ["/ds/components", "Components", "Components"],
      ["/ds/forms", "Forms", "Forms"], ["/ds/feedback", "Feedback", "Feedback"], ["/ds/data", "Data display", "Data display"],
      ["/ds/visuals", "Illustrations", "Illustrations"], ["/ds/motion", "Motion", "Motion"],
    ]);
  });

  it("each has a page.tsx and a loading.tsx titled like its screen's header, and no other route folder exists", () => {
    for (const p of DS_PAGES) {
      expect(read(path.join(routeDir(p.href), "page.tsx")), p.href).toContain(`title: "${p.title}"`);
      expect(read(path.join(routeDir(p.href), "page.tsx")), p.href).toContain(`@/features/ds/pages/${p.id}"`);
      expect(read(path.join(routeDir(p.href), "loading.tsx")), p.href).toContain("RouteSkeleton");
      expect(source(p.id), p.id).toContain(`<PageHeader title="${p.title}"`);
    }
    const folders = readdirSync(APP, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `/ds/${e.name}`);
    expect(folders.sort()).toEqual(DS_PAGES.slice(1).map((p) => p.href).sort());
  });

  it("every catalog section's anchor is on the page its Example link opens", () => {
    const sections = [...new Set(COMPONENT_INVENTORY.map((c) => c.section))];
    expect(sections.sort()).toEqual(Object.keys(SECTION_PAGE).sort());
    for (const s of sections) {
      const page = DS_PAGES.find((p) => p.id === SECTION_PAGE[s]);
      expect(page, s).toBeDefined();
      expect(sectionHref(s)).toBe(`${page!.href}#ds-${s}`);
      // The anchor is in that page's source and in no other page's.
      expect(DS_PAGES.filter((p) => source(p.id).includes(`id="ds-${s}"`)).map((p) => p.id), s).toEqual([page!.id]);
    }
  });

  it("a component some page renders is rendered by the page its Example link opens", () => {
    const shows = Object.fromEntries(DS_PAGES.map((p) => [p.id, withSections(p.id)]));
    // The components an entry's `api` names ("FilterLayout / FilterSearch", "DataTable columns"); "<Select" is not "<SelectTrigger".
    const on = (api: string, id: DsPageId) => (api.match(/\b[A-Z][A-Za-z]+\b/g) ?? []).some((n) => new RegExp(`<${n}\\b`).test(shows[id]!));
    const shown = COMPONENT_INVENTORY.filter((c) => DS_PAGES.some((p) => on(c.api, p.id)));
    expect(shown.length).toBeGreaterThan(90);
    expect(shown.filter((c) => !on(c.api, SECTION_PAGE[c.section])).map((c) => `${c.name}: ${sectionHref(c.section)}`)).toEqual([]);
  });

  it("each of the five affectUI groups is rendered by exactly one page, the one AFFECT_PAGE names", () => {
    expect(Object.keys(AFFECT_PAGE)).toEqual(["actions", "inputs", "feedback", "content", "visuals"]);
    for (const [group, page] of Object.entries(AFFECT_PAGE)) {
      expect(DS_PAGES.filter((p) => source(p.id).includes(`<AffectGroup id="${group}"`)).map((p) => p.id), group).toEqual([page]);
    }
    expect(DS_PAGES.flatMap((p) => source(p.id).match(/<AffectGroup id="/g) ?? [])).toHaveLength(5);
  });
});
