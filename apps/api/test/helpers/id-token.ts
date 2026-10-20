// id_tokens as Google or Apple would sign them, with a local key pair (no network): the oauth tests' provider side.
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload, type JWTVerifyGetKey, SignJWT } from "jose";

export const KID = "test-key";
/** The key pair the tests' providers sign with. */
export const keys = await generateKeyPair("RS256");
export const ISS = { google: "https://accounts.google.com", apple: "https://appleid.apple.com" } as const;
/** Our client id at each provider (the id_token audience). */
export const AUD = { google: "google-client-id", apple: "com.example.app" } as const;

/** The provider's key set as jose would fetch it: the public half of `keys`. */
export const trustedKeys = async (): Promise<JWTVerifyGetKey> => createLocalJWKSet({ keys: [{ ...(await exportJWK(keys.publicKey)), kid: KID, alg: "RS256" }] });

/** An id_token as the provider would sign it; `claims` override the defaults, `key` signs instead of the trusted key. */
export const idToken = (p: "google" | "apple", claims: JWTPayload, o: { key?: CryptoKey; exp?: number | string; kid?: string; noIat?: boolean } = {}) => {
  const jwt = new SignJWT({ email: `${claims.sub}@example.org`, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: o.kid ?? KID })
    .setIssuer(claims.iss ?? ISS[p]).setAudience(claims.aud ?? AUD[p]).setExpirationTime(o.exp ?? "5m");
  return (o.noIat ? jwt : jwt.setIssuedAt()).sign(o.key ?? keys.privateKey);
};
