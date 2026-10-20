// Google and Apple sign-in: authorization code (+ PKCE for Google), state and nonce, the id_token verified against the
// provider's signing keys. Under OAUTH_MOCK the same state rows and redirects run against the web's fake authorize
// page, and the code "mock" stands for a fixed identity per account.
import { Apple, Google } from "arctic";
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import { z } from "zod";
import type { ConnectionProvider } from "@starterkit/shared/contracts/me";
import { maskText } from "@starterkit/shared/log-redact";
import { APPLE_KEYS, type Config, config, GOOGLE_KEYS } from "../config";
import { ApiError } from "../http/errors";
import { log } from "../log";
import { safeEqual } from "./crypto";

/** `POST /v1/auth/oauth/{provider}/start`: `bindingHash` = SHA-256 (base64url) of the browser's binding cookie. */
export const OAuthStartBody = z.object({
  mode: z.enum(["login", "link"]),
  next: z.string().max(2048).optional(),
  bindingHash: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

/** `POST /v1/auth/oauth/{provider}/callback`: what the provider sent back, and the browser's binding cookie. */
export const OAuthCallbackBody = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(1).max(256),
  binding: z.string().min(1).max(256),
});

/** The providers' signing keys (fetched and cached by jose on first use); tests put a local key set here. */
export const providerKeys: Record<ConnectionProvider, JWTVerifyGetKey> = {
  google: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
  apple: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
};
const ISSUER: Record<ConnectionProvider, string[]> = { google: ["https://accounts.google.com", "accounts.google.com"], apple: ["https://appleid.apple.com"] };

/** Every key of the provider is set (config refuses a provider with only some of its keys). */
const configured = (p: ConnectionProvider, c: Config) => (p === "google" ? GOOGLE_KEYS : APPLE_KEYS).every((k) => c[k]);

/** The provider can sign in: the mock is on, or its keys are set. */
export const providerEnabled = (p: ConnectionProvider, c: Config = config()): boolean => c.OAUTH_MOCK || configured(p, c);

/** The `.p8` PEM as PKCS#8 bytes (headers, whitespace and literal `\n` dropped). */
const pkcs8 = (pem: string) => new Uint8Array(Buffer.from(pem.replace(/-----[^-]+-----|\\n|\s/g, ""), "base64"));

function client(p: ConnectionProvider, c: Config): Google | Apple {
  const redirect = `${c.APP_URL}/api/auth/oauth/${p}/callback`;
  return p === "google"
    ? new Google(c.GOOGLE_CLIENT_ID!, c.GOOGLE_CLIENT_SECRET!, redirect)
    : new Apple(c.APPLE_CLIENT_ID!, c.APPLE_TEAM_ID!, c.APPLE_KEY_ID!, pkcs8(c.APPLE_PRIVATE_KEY!), redirect);
}

/**
 * Where the browser goes to sign in: the provider's authorize page (Google: `openid email` with PKCE S256; Apple:
 * `name email`, answer posted back as a form; both with `nonce`), or the web's mock page under OAUTH_MOCK.
 */
export function authorizeUrl(p: ConnectionProvider, s: { state: string; verifier: string; nonce: string }, c: Config = config()): string {
  if (c.OAUTH_MOCK) return `/api/auth/oauth/${p}/mock-authorize?${new URLSearchParams({ state: s.state })}`;
  const cl = client(p, c);
  // ponytail: arctic 3.7's Apple client has no PKCE; state + nonce + the browser binding guard the Apple code.
  const url = cl instanceof Google ? cl.createAuthorizationURL(s.state, s.verifier, ["openid", "email"]) : cl.createAuthorizationURL(s.state, ["name", "email"]);
  url.searchParams.set("nonce", s.nonce);
  if (p === "apple") url.searchParams.set("response_mode", "form_post");
  return url.href;
}

/**
 * The id_token's subject and email once its signature (the provider's keys, RS256 only), issuer, audience (our client
 * id), `iat`, expiry (60 s of clock skew) and nonce check out; else throws.
 */
export async function verifyIdToken(p: ConnectionProvider, idToken: string, o: { clientId: string; nonce: string; keys?: JWTVerifyGetKey }): Promise<{ subject: string; email: string | null }> {
  const { payload } = await jwtVerify(idToken, o.keys ?? providerKeys[p], {
    issuer: ISSUER[p], audience: o.clientId, algorithms: ["RS256"], clockTolerance: 60, requiredClaims: ["sub", "iat", "exp", "nonce"],
  });
  if (typeof payload.nonce !== "string" || !safeEqual(payload.nonce, o.nonce)) throw new Error("id_token nonce mismatch");
  return { subject: payload.sub!, email: typeof payload.email === "string" ? payload.email : null };
}

const NOT_CONFIRMED = "The provider didn't confirm the sign-in. Start again.";

/**
 * The provider's account for an authorization code: the code exchanged (with the stored PKCE verifier) and the
 * id_token verified against the stored nonce. Mock: only the code "mock", subject `mock-<provider>-demo` (login) or
 * `mock-<provider>-<userId>` (link). A refused code or token is 401 `invalid_credentials`, the reason in the log only.
 */
export async function identityOf(p: ConnectionProvider, code: string, s: { verifier: string; nonce: string; userId: string | null }, c: Config = config()): Promise<{ subject: string; email: string | null }> {
  if (c.OAUTH_MOCK) {
    if (code !== "mock") throw new ApiError("invalid_credentials", NOT_CONFIRMED);
    return { subject: `mock-${p}-${s.userId ?? "demo"}`, email: null };
  }
  try {
    const cl = client(p, c);
    const tokens = cl instanceof Google ? await cl.validateAuthorizationCode(code, s.verifier) : await cl.validateAuthorizationCode(code);
    return await verifyIdToken(p, tokens.idToken(), { clientId: p === "google" ? c.GOOGLE_CLIENT_ID! : c.APPLE_CLIENT_ID!, nonce: s.nonce });
  } catch (e) {
    log.warn({ provider: p, err: e instanceof Error ? { name: e.name, message: maskText(e.message) } : { name: typeof e } }, "oauth code refused");
    throw new ApiError("invalid_credentials", NOT_CONFIRMED);
  }
}
