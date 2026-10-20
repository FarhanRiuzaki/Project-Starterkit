// id_token verification against a local key set (no network): signature, issuer, audience, iat, expiry and nonce.
import { describe, expect, it } from "bun:test";
import { createLocalJWKSet, exportJWK, exportSPKI, generateKeyPair, type JWTPayload, SignJWT } from "jose";
import { verifyIdToken } from "../../providers";

const KID = "test-key";
const keys = await generateKeyPair("RS256");
const otherKeys = await generateKeyPair("RS256");
const ISS = { google: "https://accounts.google.com", apple: "https://appleid.apple.com" } as const;
const AUD = { google: "google-client-id", apple: "com.example.app" } as const;

/** An id_token as the provider would sign it; `claims` override the defaults, `key` signs instead of the trusted key. */
const idToken = (p: "google" | "apple", claims: JWTPayload, o: { key?: CryptoKey; exp?: number | string; kid?: string; noIat?: boolean } = {}) => {
  const jwt = new SignJWT({ email: `${claims.sub}@example.org`, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: o.kid ?? KID })
    .setIssuer(claims.iss ?? ISS[p]).setAudience(claims.aud ?? AUD[p]).setExpirationTime(o.exp ?? "5m");
  return (o.noIat ? jwt : jwt.setIssuedAt()).sign(o.key ?? keys.privateKey);
};

describe("verifyIdToken", () => {
  const jwks = async () => createLocalJWKSet({ keys: [{ ...(await exportJWK(keys.publicKey)), kid: KID, alg: "RS256" }] });
  const verify = async (p: "google" | "apple", token: string, nonce = "n1") => verifyIdToken(p, token, { clientId: AUD[p], nonce, keys: await jwks() });
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
