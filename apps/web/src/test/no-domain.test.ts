import { describe, expect, it } from "vitest";
import { read, scan, UI_SRC, WEB_SRC } from "./scan";

const BANNED = /jumpserver|\bjms\b|squid|egress|prometheus|\bloki\b|bifrost|bilik|tibsdev|bankmega|workspace|\bkoko\b|megacode/i;
const SELF = /no-domain\.test\.ts$/;

describe("domain guard", () => {
  it("no source-app domain word in apps/web/src or packages/ui/src", () => {
    const hits = scan([WEB_SRC, UI_SRC], /\.(ts|tsx|css|md)$/, true).filter((f) => !SELF.test(f) && BANNED.test(read(f)));
    expect(hits).toEqual([]);
  });
  it("packages/ui never imports apps/ or @/", () => {
    const hits = scan([UI_SRC], /\.(ts|tsx)$/, true).filter((f) => /from\s+["'](@\/|[./]*apps\/)/.test(read(f)));
    expect(hits).toEqual([]);
  });
});
