import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => (process.env.SESSION_SECRET = "s".repeat(40)));
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

import { db, resetDb } from "./mock/db";
import { signInAs, TEST_CSRF } from "@/test/session";
import { requirePagePermission } from "./page-guard";

const signIn = (username: string) => signInAs(jar, username);

beforeEach(() => {
  resetDb();
  jar.clear();
  path.value = null;
});

describe("requirePagePermission", () => {
  it("no session → sign-in that returns to the requested internal path", async () => {
    path.value = "/users?page=2";
    await expect(requirePagePermission("user.view")).rejects.toThrow("redirect:/login?next=%2Fusers%3Fpage%3D2");
  });

  it("external, traversal or missing paths fall back to plain /login", async () => {
    for (const p of ["//evil.com", "/\\evil", "/a/..//evil", null]) {
      path.value = p;
      await expect(requirePagePermission(null), String(p)).rejects.toThrow(/^redirect:\/login$/);
    }
  });

  it("terminated session or deactivated user → sign-in", async () => {
    const { sid } = await signIn("admin");
    db().sessions.delete(sid);
    await expect(requirePagePermission(null)).rejects.toThrow(/^redirect:/);
    const { user } = await signIn("admin");
    user.isActive = false;
    await expect(requirePagePermission(null)).rejects.toThrow(/^redirect:/);
  });

  it("missing permission → not found", async () => {
    await signIn("viewer");
    await expect(requirePagePermission("role.create")).rejects.toThrow("not-found");
  });

  it("allowed: user DTO without credentials, permissions, csrf token", async () => {
    const { user } = await signIn("viewer");
    const r = await requirePagePermission("user.view");
    expect(r.user.id).toBe(user.id);
    expect(r.user).not.toHaveProperty("passwordHash");
    expect(r.user).not.toHaveProperty("totpSecret");
    expect(r.user).not.toHaveProperty("recoveryCodes");
    expect(r.perms).toContain("user.view");
    expect(r.perms).not.toContain("user.edit");
    expect(r.csrf).toBe(TEST_CSRF);
  });
});
