// The Google/Apple round trip: state rows, sign-in by a linked identity, linking an identity to the signed-in user.
import { and, count, eq, ne, sql } from "drizzle-orm";
import { ConnectionProvider } from "@starterkit/shared/contracts/me";
import { afterSignIn } from "@starterkit/ui/lib/safe-path";
import type { z } from "zod";
import { hashToken, randomToken, safeEqual } from "../../kernel/crypto";
import { db, type Tx } from "../../kernel/db";
import { ApiError, tooManyAttempts } from "../../kernel/errors";
import type { Client } from "../../kernel/plugins/context";
import { recordActivity } from "../audit";
import { type AuthUser, completeSignIn, endSession, isLiveSession, logAuth, oauthStartLimits, retryText, userById } from "../auth";
import { authorizeUrl, identityOf, type OAuthCallbackBody, type OAuthStartBody, providerEnabled } from "./providers";
import { oauthStates, userIdentities } from "./schema";

const OAUTH_EXPIRED = "The sign-in with the provider expired or started in another browser. Start again.";
const NOT_CONNECTED = "This account isn't connected to a user here. Sign in another way, then connect it under Security.";

/** The provider of the path when it can sign in (mock or configured); else 404. */
export function oauthProvider(name: string): ConnectionProvider {
  const p = ConnectionProvider.safeParse(name);
  if (!p.success || !providerEnabled(p.data)) throw new ApiError("not_found", "This sign-in provider isn't available.");
  return p.data;
}

/**
 * Start a provider sign-in (`login`) or a link to the signed-in user `auth` (`link`): a state row (state stored hashed,
 * the browser binding's hash, PKCE verifier, nonce, who links, `next`, the browser's session; 10 minutes) and the URL
 * the browser goes to next. The browser's session (any mode) is stored so that ending it deletes the state, and a
 * sign-in ends it. 20 starts per client IP and 300 in all per minute, then 429.
 */
export async function start(p: ConnectionProvider, b: z.infer<typeof OAuthStartBody>, auth: AuthUser | null, client: Client): Promise<{ url: string }> {
  const waits = await Promise.all([oauthStartLimits.ip.hit(client.ip), oauthStartLimits.breaker.hit("all")]);
  const wait = Math.max(0, ...waits.map((w) => w ?? 0));
  if (wait > 0) throw tooManyAttempts(wait, retryText(wait));
  const s = { state: randomToken(), verifier: randomToken(), nonce: randomToken() };
  // ponytail: rows of abandoned sign-ins stay until their 10 minutes pass and the janitor removes them.
  await db.insert(oauthStates).values({
    stateHash: hashToken(s.state), provider: p, mode: b.mode, userId: b.mode === "link" ? auth!.user.id : null, sessionId: auth?.sid ?? null,
    bindingHash: Buffer.from(b.bindingHash, "base64url"), codeVerifier: s.verifier, nonce: s.nonce, next: b.mode === "login" ? afterSignIn(b.next) : null,
    expiresAt: sql`now() + interval '10 minutes'`,
  });
  return { url: authorizeUrl(p, s) };
}

const identity = (p: ConnectionProvider, subject: string) => and(eq(userIdentities.provider, p), eq(userIdentities.subject, subject));

/**
 * Spends the state of `stateHash` (single use: deleted on first sight, live or not, outside any later transaction) and
 * answers its row with whether it was still live.
 */
async function spendState(stateHash: Buffer) {
  const [s] = await db.delete(oauthStates).where(eq(oauthStates.stateHash, stateHash)).returning({
    provider: oauthStates.provider, mode: oauthStates.mode, userId: oauthStates.userId, sessionId: oauthStates.sessionId,
    bindingHash: oauthStates.bindingHash, codeVerifier: oauthStates.codeVerifier, nonce: oauthStates.nonce, next: oauthStates.next,
    live: sql<boolean>`${oauthStates.expiresAt} > now()`,
  });
  return s;
}

/**
 * Finish a provider round trip. The state is spent on first use (also when expired, for another provider or with
 * another browser's binding: all 401). Login: only an identity already linked signs in (no new users, no match by
 * email); the provider counts as the second factor; the browser's earlier session ends; answers `{ next, token }`.
 * Link: only while the session that started it is live; the identity joins its user (one `me.connect` entry; already
 * linked = no entry; linked to someone else = 409); answers `{ next }`.
 */
export async function callback(p: ConnectionProvider, b: z.infer<typeof OAuthCallbackBody>, client: Client): Promise<{ next: string; token?: string }> {
  const s = await spendState(hashToken(b.state));
  if (!s?.live || s.provider !== p || !safeEqual(hashToken(b.binding).toString("hex"), Buffer.from(s.bindingHash).toString("hex"))) {
    throw new ApiError("unauthenticated", OAUTH_EXPIRED);
  }
  const id = await identityOf(p, b.code, { verifier: s.codeVerifier, nonce: s.nonce, userId: s.userId });
  if (s.mode === "link") {
    // The session that started the link is still live and still this user's (sign-out or revoke deletes the state too).
    const live = !!s.sessionId && !!s.userId && (await isLiveSession(s.sessionId, s.userId));
    const user = live ? await userById(s.userId!) : null;
    if (!user?.isActive) throw new ApiError("unauthenticated");
    await db.transaction(async (tx) => {
      const added = await tx.insert(userIdentities).values({ userId: user.id, provider: p, subject: id.subject, email: id.email })
        .onConflictDoNothing().returning({ userId: userIdentities.userId });
      if (added.length) return recordActivity(tx, { user }, { action: "me.connect", target: { type: "user", id: user.id, label: user.name }, after: { provider: p } });
      // Not added: this identity is someone else's (409), or the user already has this provider (nothing to do).
      const [owner] = await tx.select({ userId: userIdentities.userId }).from(userIdentities).where(identity(p, id.subject));
      if (owner && owner.userId !== user.id) throw new ApiError("duplicate", "This account is already connected to another user.");
    });
    return { next: `/me/security?connected=${p}` };
  }
  const [linked] = await db.select({ userId: userIdentities.userId }).from(userIdentities).where(identity(p, id.subject));
  const user = linked ? await userById(linked.userId) : null;
  const login = user?.email ?? id.email ?? id.subject;
  if (!user?.isActive) {
    await logAuth(db, client, "login_failed", p, login, user?.id ?? null);
    throw user ? new ApiError("account_inactive") : new ApiError("invalid_credentials", NOT_CONNECTED);
  }
  const token = await db.transaction(async (tx) => {
    // One browser, one session: the session the browser had at start ends (its cookie can't reach the web here).
    if (s.sessionId) await endSession(s.sessionId, tx);
    const t = await completeSignIn(tx, user, p, client);
    await logAuth(tx, client, "login_success", p, user.email, user.id);
    return t;
  });
  return { next: s.next ?? "/", token };
}

/** How many identities of other providers the user has (read under the caller's lock on the user). */
export async function otherIdentities(tx: Tx, userId: string, provider: ConnectionProvider): Promise<number> {
  const [r] = await tx.select({ n: count() }).from(userIdentities).where(and(eq(userIdentities.userId, userId), ne(userIdentities.provider, provider)));
  return r!.n;
}

/** Removes the user's identity of `provider`; false when none was linked. */
export async function unlinkIdentity(tx: Tx, userId: string, provider: ConnectionProvider): Promise<boolean> {
  const gone = await tx.delete(userIdentities).where(and(eq(userIdentities.userId, userId), eq(userIdentities.provider, provider)))
    .returning({ userId: userIdentities.userId });
  return gone.length > 0;
}
