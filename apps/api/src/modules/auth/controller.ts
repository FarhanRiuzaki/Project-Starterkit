// /v1/auth/*: port of apps/web/src/app/api/auth/{login,2fa,logout,forgot,reset}. The web keeps the cookie, CSRF and
// same-origin checks; here a full sign-in answers `token` and a pending second factor answers `challenge`. These routes
// answer before a session exists, so only `context` is guarded; the others read their body first.
import { Elysia } from "elysia";
import { AuthContextDto, ForgotPasswordBody, LoginBody, ResetPasswordBody, TwoFactorBody } from "@starterkit/shared/contracts/auth";
import { PERMISSIONS } from "@starterkit/shared/permissions";
import { body } from "../../kernel/parse";
import { bearer, guard } from "./guard";
import { forgot, login, logout, reset, secondFactor } from "./service";

/** The routes of /v1/auth (the Google/Apple round trip and `/v1/auth/providers` are the oauth module's). */
export const authController = () =>
  new Elysia()
    .use(guard)
    .post("/v1/auth/login", async (c) => login(await body(c, LoginBody), c.client))
    .post("/v1/auth/2fa", async (c) => {
      const b = await body(c, TwoFactorBody);
      return secondFactor(c.request.headers.get("x-auth-challenge"), b, c.client);
    })
    /** Ends the bearer's session and/or deletes the `X-Auth-Challenge` challenge. Always `{ ok: true }`. */
    .post("/v1/auth/logout", async ({ request, client }) => {
      await logout(bearer(request.headers.get("authorization")), request.headers.get("x-auth-challenge"), client);
      return { ok: true };
    })
    .post("/v1/auth/forgot", async (c) => {
      await forgot((await body(c, ForgotPasswordBody)).email, c.client);
      return { ok: true };
    })
    .post("/v1/auth/reset", async (c) => {
      await reset(await body(c, ResetPasswordBody), c.client);
      return { ok: true };
    })
    /** The signed-in user and their permissions in catalog order (API-internal: the web's page guards). */
    .get("/v1/auth/context", ({ ctx }) => AuthContextDto.parse({ user: ctx.user, permissions: PERMISSIONS.filter((p) => ctx.perms.has(p)) }), { guard: null });
