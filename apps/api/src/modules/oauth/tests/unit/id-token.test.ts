// id_token verification against a local key set (no network): signature, issuer, audience, iat, expiry and nonce.
import { describe, expect, it } from "bun:test";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { AUD, ISS, idToken, KID, keys, trustedKeys } from "../../../../../test/helpers/id-token";
import { verifyIdToken } from "../../providers";

const otherKeys = await generateKeyPair("RS256");

describe("verifyIdToken", () => {
  const verify = async (p: "google" | "apple", token: string, nonce = "n1") => verifyIdToken(p, token, { clientId: AUD[p], nonce, keys: await trustedKeys() });
  const fails = (p: Promise<unknown>) => p.then(() => "accepted", () => "rejected");

  it("accepts the provider's token: subject and email", async () => {
    expect(await verify("google", await idToken("google", { sub: "s1", nonce: "n1" }))).toEqual({ subject: "s1", email: "s1@example.org" });
    expect(await verify("google", await idToken("google", { sub: "s1", nonce: "n1", iss: "accounts.google.com" }))).toMatchObject({ subject: "s1" });
    expect(await verify("apple", await idToken("apple", { sub: "a1", nonce: "n1" }))).toMatchObject({ subject: "a1" });
  });

  it("id_token with a wrong nonce/audience/issuer is rejected", async () => {
    expect(await fails(verify("google", await idToken("google", { sub: "s1", nonce: "other" })))).toBe("rejected");
    expect(await fails(verify("google", await idToken("google", { sub: "s1" })))).toBe("rejected"); // no nonce at all
    expect(await fails(verify("google", await idToken("google", { sub: "s1", nonce: "n1", aud: "another-client" })))).toBe("rejected");
    expect(await fails(verify("google", await idToken("google", { sub: "s1", nonce: "n1", iss: "https://evil.example" })))).toBe("rejected");
    expect(await fails(verify("apple", await idToken("google", { sub: "s1", nonce: "n1", aud: AUD.apple })))).toBe("rejected"); // Google's issuer for Apple
  });

  it("alg none, HS256 keyed with the public key, an unknown kid and a missing iat are rejected", async () => {
    const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: ISS.google, aud: AUD.google, sub: "s1", nonce: "n1", iat: now, exp: now + 300 };
    expect(await fails(verify("google", `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.`))).toBe("rejected");
    const pem = new TextEncoder().encode(await exportSPKI(keys.publicKey));
    const hs = await new SignJWT(claims).setProtectedHeader({ alg: "HS256", kid: KID }).sign(pem);
    expect(await fails(verify("google", hs))).toBe("rejected");
    expect(await fails(verify("google", await idToken("google", { sub: "s1", nonce: "n1" }, { kid: "unknown-key" })))).toBe("rejected");
    expect(await fails(verify("google", await idToken("google", { sub: "s1", nonce: "n1" }, { noIat: true })))).toBe("rejected");
  });

  it("an expired token (beyond 60 s of clock skew) or one signed by another key is rejected", async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await fails(verify("google", await idToken("google", { sub: "s1", nonce: "n1" }, { exp: now - 90 })))).toBe("rejected");
    expect(await fails(verify("google", await idToken("google", { sub: "s1", nonce: "n1" }, { exp: now - 30 })))).toBe("accepted");
    expect(await fails(verify("google", await idToken("google", { sub: "s1", nonce: "n1" }, { key: otherKeys.privateKey })))).toBe("rejected");
  });
});
