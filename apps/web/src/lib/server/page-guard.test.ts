import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.INTERNAL_API_TOKEN = "i".repeat(40);
});
const jar = vi.hoisted(() => new Map<string, string>());
const path = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(path.value ? { "x-pathname": path.value } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw new Error(`redirect:${to}`); },
  notFound: () => { throw new Error("not-found"); },
}));

import type { PermissionName } from "@starterkit/shared/permissions";
import { fakeApi, pathOf, sealCookie, TEST_CSRF, TEST_TOKEN } from "@/test/session";
import { guardedTitle, requirePagePermission } from "./page-guard";

const user = { id: "0199f0a0-0000-7000-8000-000000000001", name: "Viewer User", username: "viewer", email: "viewer@example.com" };
/** The API's /v1/auth/context: `perms` for TEST_TOKEN, 401 for any other bearer. */
const contextApi = (perms: PermissionName[]) => fakeApi((r) => (r.headers.get("authorization") === `Bearer ${TEST_TOKEN}`
  ? Response.json({ user, permissions: perms })
  : Response.json({ error: { code: "unauthenticated", message: "Sign in to continue." } }, { status: 401 })));

beforeEach(() => {
  jar.clear();
  path.value = null;
});
afterEach(() => vi.unstubAllGlobals());

describe("requirePagePermission", () => {
  it("no session → sign-in that returns to the requested internal path, without asking the API", async () => {
    const seen = contextApi([]);
    path.value = "/users?page=2";
    await expect(requirePagePermission("user.view")).rejects.toThrow("redirect:/login?next=%2Fusers%3Fpage%3D2");
    await sealCookie(jar, { challenge: "pending" }); // a sign-in waiting for its second factor is not signed in
    await expect(requirePagePermission(null)).rejects.toThrow(/^redirect:/);
    expect(seen).toEqual([]);
  });

  it("external, traversal or missing paths fall back to plain /login", async () => {
    for (const p of ["//evil.com", "/\\evil", "/a/..//evil", null]) {
      path.value = p;
      await expect(requirePagePermission(null), String(p)).rejects.toThrow(/^redirect:\/login$/);
    }
  });

  it("a session the API no longer knows (ended, expired, user deactivated: 401) → sign-in", async () => {
    contextApi(["user.view"]);
    await sealCookie(jar, { token: "ended", csrf: TEST_CSRF });
    await expect(requirePagePermission(null)).rejects.toThrow(/^redirect:/);
  });

  it("the API down → an error, not the sign-in page", async () => {
    fakeApi(() => Response.json({ error: { code: "internal", message: "x" } }, { status: 500 }));
    await sealCookie(jar);
    await expect(requirePagePermission(null)).rejects.toThrow("auth context answered 500");
  });

  it("missing permission → not found", async () => {
    contextApi(["user.view", "audit.view"]);
    await sealCookie(jar);
    await expect(requirePagePermission("role.create")).rejects.toThrow("not-found");
  });

  it("allowed: the API's user and permissions, the cookie's csrf token; one context call with the session token", async () => {
    const seen = contextApi(["user.view", "audit.view"]);
    await sealCookie(jar);
    expect(await requirePagePermission("user.view")).toEqual({ user, perms: ["user.view", "audit.view"], csrf: TEST_CSRF });
    expect(seen.map(pathOf)).toEqual(["/v1/auth/context"]);
  });
});

describe("guardedTitle", () => {
  it("names the page only for a viewer who may open it", async () => {
    contextApi(["user.view", "audit.view"]);
    await sealCookie(jar);
    path.value = "/roles";
    expect(await guardedTitle("Roles")).toEqual({ title: "Page not found" });
    path.value = "/users/x/edit";
    expect(await guardedTitle("Edit user")).toEqual({ title: "Page not found" });
    path.value = "/users?page=2";
    expect(await guardedTitle("Users")).toEqual({ title: "Users" });
    contextApi(["role.view"]);
    path.value = "/roles";
    expect(await guardedTitle("Roles")).toEqual({ title: "Roles" });
  });
});
