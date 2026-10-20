import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.INTERNAL_API_TOKEN = "i".repeat(40);
});
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));

import { PENDING_2FA_TTL_MS, pendingChallenge } from "@/lib/server/session";
import { sealCookie } from "@/test/session";
import TwoFactorPage from "./page";

const open = (next?: string) => TwoFactorPage({ searchParams: Promise.resolve(next ? { next } : {}) });

beforeEach(() => jar.clear());

describe("/login/2fa page guard", () => {
  it("pendingChallenge: a challenge under 10 minutes old; older, undated or missing is none", () => {
    const now = Date.now();
    expect(pendingChallenge({ challenge: "c", challengeAt: now - PENDING_2FA_TTL_MS }, now)).toBe("c");
    expect(pendingChallenge({ challenge: "c", challengeAt: now - PENDING_2FA_TTL_MS - 1 }, now)).toBeNull();
    expect(pendingChallenge({ challenge: "c" }, now)).toBeNull();
    expect(pendingChallenge({ token: "t", csrf: "x" }, now)).toBeNull();
  });

  it("renders the form for a live challenge; no or an expired challenge goes to sign-in, keeping a safe next", async () => {
    await sealCookie(jar, { challenge: "c", challengeAt: Date.now() });
    await expect(open("/users")).resolves.toBeTruthy();
    await sealCookie(jar, { challenge: "c", challengeAt: Date.now() - PENDING_2FA_TTL_MS - 1000 });
    await expect(open("/users")).rejects.toThrow("redirect:/login?next=%2Fusers");
    jar.clear();
    await expect(open("//evil.com")).rejects.toThrow(/^redirect:\/login$/);
  });
});
