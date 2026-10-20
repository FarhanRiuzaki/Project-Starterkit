// /v1/auth/oauth/{provider}/{start,callback} and /v1/auth/providers: the API's half of the Google/Apple flow (the web
// keeps the browser binding cookie and the redirects). They answer before a session exists, so none is guarded: start
// and callback read the body first, then (start, link mode) the bearer's session, then the provider.
import { Elysia } from "elysia";
import { body } from "../../kernel/parse";
import { context } from "../../kernel/plugins/context";
import { authenticate, bearer, resolveSession } from "../auth";
import { OAuthCallbackBody, OAuthStartBody, providerEnabled } from "./providers";
import { callback, oauthProvider, start } from "./service";

/** The routes of the provider round trip, and which providers can sign in. */
export const oauthController = () =>
  new Elysia()
    .use(context)
    /** Which providers can sign in (API-internal: the web hides or blocks the other buttons). */
    .get("/v1/auth/providers", () => ({ google: providerEnabled("google"), apple: providerEnabled("apple") }))
    /** Link mode needs a signed-in user (401); login mode stores the browser's session when it has one. */
    .post("/v1/auth/oauth/:provider/start", async (c) => {
      const b = await body(c, OAuthStartBody);
      const token = bearer(c.request.headers.get("authorization"));
      const auth = b.mode === "link" ? await authenticate(token, null) : token ? await resolveSession(token) : null;
      return start(oauthProvider(c.params.provider), b, auth, c.client);
    })
    .post("/v1/auth/oauth/:provider/callback", async (c) => {
      const b = await body(c, OAuthCallbackBody);
      return callback(oauthProvider(c.params.provider), b, c.client);
    });
