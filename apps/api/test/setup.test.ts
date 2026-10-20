// `bun run setup` (scripts/setup.ts): the env files it writes for a new development checkout.
import { describe, expect, it } from "bun:test";
import { apiEnvText, webEnvText } from "../../../scripts/setup";

describe("bun run setup", () => {
  it("new development env files turn the mock Google/Apple and directory sign-in on", () => {
    const api = apiEnvText("postgresql://u:p@localhost:5432/app", "tok", {});
    expect(api).toMatch(/^OAUTH_MOCK=true$/m);
    expect(api).toMatch(/^LDAP_MOCK=true$/m);
    expect(webEnvText("tok", {})).toMatch(/^OAUTH_MOCK=true$/m);
  });

  it("never with NODE_ENV=production (the API and the web refuse the mocks there)", () => {
    const prod = { NODE_ENV: "production" };
    expect(apiEnvText("postgresql://u:p@localhost:5432/app", "tok", prod)).not.toMatch(/_MOCK/);
    expect(webEnvText("tok", prod)).not.toMatch(/_MOCK/);
  });
});
