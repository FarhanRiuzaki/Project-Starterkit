// /v1/auth/oauth/{provider}/{start,callback}: the API's half of the Google/Apple flow (the web keeps the browser
// binding cookie and the redirects). Both answer before a session exists, so neither is guarded: the body is read
// first, then (start, link mode) the bearer's session, then the provider.
import { Elysia } from "elysia";
import { body } from "../../kernel/parse";
import { context } from "../../kernel/plugins/context";
import { authenticate, bearer, resolveSession } from "../auth";
import { OAuthCallbackBody, OAuthStartBody } from "./providers";
import { callback, oauthProvider, start } from "./service";

/** The routes of the provider round trip. */
export const oauthController = () =>
  new Elysia()
    .use(context)
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
