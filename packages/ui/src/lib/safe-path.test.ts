import { describe, expect, it } from "vitest";
import { afterSignIn, safeInternalPath, signInHref } from "./safe-path";

describe("safeInternalPath", () => {
  it("menerima path internal", () => {
    expect(safeInternalPath("/audit?id=A-1")).toBe("/audit?id=A-1");
  });
  it("menolak yang lain", () => {
    for (const h of ["//evil.example", "/\\evil", "javascript:alert(1)", "https://x.y/", "", "audit", "/a\nb", "/a\tb"]) {
      expect(safeInternalPath(h)).toBeNull();
    }
  });
});

describe("sign-in deep link (?next=)", () => {
  it("returns to the internal page that sent the viewer to sign in", () => {
    expect(signInHref("/items/test2?tab=internet")).toBe("/login?next=%2Fitems%2Ftest2%3Ftab%3Dinternet");
    expect(afterSignIn("/items/test2?tab=internet")).toBe("/items/test2?tab=internet");
  });
  it("never leaves the console or loops back to sign-in", () => {
    for (const bad of ["//evil.example", "https://evil.example/", "/\\evil", "javascript:alert(1)", "/login", "/login?next=/x", "/api/fleet", "", null, undefined]) {
      expect(afterSignIn(bad)).toBe("/");
    }
    expect(signInHref("/")).toBe("/login");
    expect(signInHref("//evil.example")).toBe("/login");
    expect(afterSignIn("/loginx")).toBe("/loginx");
  });
});

describe("safeInternalPath normalises", () => {
  it("resolves dot segments and returns path + query", () => {
    expect(safeInternalPath("/items/./test2/../test3?tab=ai")).toBe("/items/test3?tab=ai");
    expect(safeInternalPath("/a/%2e%2e/b")).toBe("/b");
  });
  it("rejects anything that normalises to a protocol-relative URL", () => {
    for (const h of ["/a/..//evil.example", "/.//evil.example", "/%2e%2e//evil.example"]) expect(safeInternalPath(h)).toBeNull();
    expect(afterSignIn("/a/..//evil.example")).toBe("/");
  });
});
