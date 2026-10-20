import { describe, expect, it } from "vitest";
import { importsIn, read, scan, SHARED_SRC, UI_SRC, WEB_SRC } from "./scan";

const BANNED = /jumpserver|\bjms\b|squid|egress|prometheus|\bloki\b|bifrost|bilik|tibsdev|bankmega|workspace|\bkoko\b|megacode/i;
const SELF = /no-domain\.test\.ts$/;

/** A specifier that reaches into the app: the `@/` alias or a path through apps/. */
const intoApp = (spec: string) => spec.startsWith("@/") || /(^|\/)apps\//.test(spec);
/** Files of packages/ui whose imports (static, side-effect or dynamic) reach into the app. */
const uiImportViolations = (files: { f: string; src: string }[]) => files.filter(({ src }) => importsIn(src).some(intoApp)).map(({ f }) => f);

describe("domain guard", () => {
  it("no source-app domain word in apps/web/src, packages/ui/src or packages/shared/src", () => {
    const hits = scan([WEB_SRC, UI_SRC, SHARED_SRC], /\.(ts|tsx|css|md)$/, true).filter((f) => !SELF.test(f) && BANNED.test(read(f)));
    expect(hits).toEqual([]);
  });
  it("packages/ui never imports apps/ or @/", () => {
    expect(uiImportViolations(scan([UI_SRC], /\.(ts|tsx)$/, true).map((f) => ({ f, src: read(f) })))).toEqual([]);
  });
  it("guard fixtures: static, side-effect and dynamic imports into the app are caught; package-relative ones pass", () => {
    expect(uiImportViolations([
      { f: "a", src: `import { x } from "@/lib/shared/x";` },
      { f: "b", src: `import "../../../apps/web/src/app/globals.css";` },
      { f: "c", src: `const m = await import("@/features/users/x");` },
      { f: "d", src: `export * from "../../apps/web/src/y";` },
      { f: "ok", src: `import { cn } from "../lib/cn"; import("./sonner"); // import "@/x"` },
    ])).toEqual(["a", "b", "c", "d"]);
  });
});
