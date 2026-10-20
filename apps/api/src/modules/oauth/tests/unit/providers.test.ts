import { describe, expect, it } from "bun:test";
import { config } from "../../../../kernel/config";
import { authorizeUrl, providerEnabled } from "../../providers";
import { oauthProvider } from "../../service";

const off = { ...config(), OAUTH_MOCK: false };

describe("providers", () => {
  it("providerEnabled: the mock enables both; else only a provider with all of its keys", () => {
    expect(providerEnabled("google", { ...off, OAUTH_MOCK: true })).toBe(true);
    expect(providerEnabled("google", off)).toBe(false);
    expect(providerEnabled("google", { ...off, GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" })).toBe(true);
    expect(providerEnabled("apple", { ...off, APPLE_CLIENT_ID: "a", APPLE_TEAM_ID: "t", APPLE_KEY_ID: "k" })).toBe(false);
  });

  it("authorizeUrl under the mock: the web's mock page with the state only", () => {
    expect(authorizeUrl("apple", { state: "s1", verifier: "v", nonce: "n" }, { ...off, OAUTH_MOCK: true })).toBe("/api/auth/oauth/apple/mock-authorize?state=s1");
  });

  it("oauthProvider: an unknown name, another letter case or a provider that can't sign in is 404", () => {
    expect(oauthProvider("google")).toBe("google"); // tests run with OAUTH_MOCK
    for (const name of ["github", "Google", ""]) expect(() => oauthProvider(name), name).toThrow("This sign-in provider isn't available.");
  });
});
