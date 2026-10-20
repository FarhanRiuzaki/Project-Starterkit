import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(path.join(import.meta.dirname, "fonts.ts"), "utf8");
const PKG = JSON.parse(readFileSync(path.join(import.meta.dirname, "../../package.json"), "utf8")) as { dependencies: Record<string, string> };

describe("self-hosted fonts", () => {
  const srcs = [...SRC.matchAll(/src:\s*"([^"]+)"/g)].map((m) => m[1]!);

  it("every next/font/local src resolves from apps/web (the build would fail on a missing file)", () => {
    expect(srcs).toHaveLength(2);
    expect(srcs.filter((s) => !existsSync(path.resolve(import.meta.dirname, s)))).toEqual([]);
  });

  it("each comes from a package this app pins itself (never a transitive or hoisted copy)", () => {
    const pkgs = srcs.map((s) => /node_modules\/(@[^/]+\/[^/]+)\//.exec(s)?.[1]);
    expect(pkgs.every((p) => !!p && /^\d+\.\d+\.\d+$/.test(PKG.dependencies[p!] ?? ""))).toBe(true);
  });
});
