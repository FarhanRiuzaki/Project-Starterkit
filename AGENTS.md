# AGENTS.md

Rules for every contributor, human or AI. One rule per line, each with the file or test that enforces it. Rules come from
the code, tests and docs of this repository; do not add a rule here that no code, test or doc backs. Short test names
(`users.test.ts`) mean the file under the module or folder the rule names; full paths are given where it is ambiguous.

## 1. Repo map and layers

- `packages/shared/src` (`@starterkit/shared`) = zod contracts (`contracts/*`), paging, the permission catalog, audit vocabulary, log redaction and `BRAND`; the web and the API both import it. Source-only.
- `packages/ui/src/{ui,motion,styles,lib,ds,charts}` = primitives, motion, tokens, helpers, design-system components and charts. Source-only, transpiled by Next; the API imports only `@starterkit/ui/lib/*`.
- `apps/web/src/{app,components,features,lib/{shared,server,client},test}` = the Next.js 16 App Router app, a BFF: it holds the session cookie, CSRF and same-origin checks and forwards every data call to the API.
- `apps/web/src/app/api/[...path]/route.ts` = the catch-all: `/api/x` → the API's `/v1/x` (`lib/server/forward.ts`); `app/api/auth/{login,2fa,logout,forgot,reset,oauth/[provider]{,/callback,/mock-authorize}}` set or clear the cookie themselves. No other `route.ts` exists. (`apps/web/src/test/architecture.test.ts` "route.ts files are exactly the catch-all and the auth routes")
- `apps/web/src/lib/server/` = `backend.ts` (the one API client: internal token, bearer, client headers, 10 s, `relay`), `forward.ts` (catch-all), `session.ts` (sealed cookie, `authContext` from `GET /v1/auth/context`), `page-guard.ts` (`requirePagePermission`, `guardedTitle`), `prefetch.tsx` (`Prefetch`, `reads`), `csrf.ts`, `api.ts` (`sameOrigin`, `clientIp`, `json`), `config.ts`, `logger.ts`, `oauth.ts`.
- `apps/api/src` = Bun + Elysia + Drizzle on PostgreSQL, a modular monolith: `index.ts` (boot, janitor, shutdown), `app.ts` (`createApp()`: kernel plugins + module registry), `kernel/` (config, db, errors, locks, log, mailer, pagination, parse, crypto, `plugins/{context,internal-auth,body-limit,error}`), `modules/index.ts` (the registry), `modules/<m>/{index,controller,service,schema,rules}.ts`, `db/{migrate,janitor}.ts` and `db/seed/{system,demo,cli}.ts`.
- `apps/api/drizzle/` = SQL migrations (`NNNN_*.sql` from drizzle-kit plus custom SQL; `meta/` is drizzle-kit's); `apps/api/drizzle.config.ts` reads `src/modules/*/schema.ts`.
- API tests: `apps/api/src/modules/<m>/tests/{unit,integration}/`, `apps/api/src/kernel/tests/{unit,integration}/`, `apps/api/test/{helpers,architecture,db}/` and `apps/api/test/app.test.ts`; never beside a source file. (`apps/api/test/architecture/boundaries.test.ts` "no test file sits beside the source")
- Modules today: `health`, `auth`, `oauth`, `me`, `rbac`, `users`, `audit`, `dashboard` in the API (`apps/api/src/modules/index.ts`); `auth`, `dashboard`, `users`, `rbac`, `audit`, `me`, `ds` in the web (`apps/web/src/features/`). One module = one API folder + one web feature folder.
- Web layers import downward only: `ui`/`motion` → `ds` → `charts` → `components/shell` → `features/*`. (`apps/web/src/test/architecture.test.ts`)
- A feature never imports a sibling feature. (`architecture.test.ts`)
- `apps/web/src` holds no Bun runtime, database driver or API code (`bun`, `bun:*`, `pg`, `@starterkit/api`, paths into `apps/api`). (`architecture.test.ts` "no Bun runtime, database driver or API code in apps/web/src")
- `packages/ui/src/**` never imports from `apps/` or the `@/` alias; use relative paths inside the package. (`apps/web/src/test/no-domain.test.ts`)
- `page.tsx` stays thin: it guards (`requirePagePermission`), names itself (`guardedTitle`) and wraps its feature screen in `<Prefetch reads={[…]}>`, which asks the API on the server for the same `/api/...` URL the screen's React Query hook fetches, under the hook's key (`lib/shared/queries.ts`); the browser then calls `/api/...` → catch-all → API. (`apps/web/src/lib/server/prefetch.test.ts`)
- Client code (`"use client"`) never imports `lib/server`. (`architecture.test.ts`)
- `lib/shared` is pure: no React, Next, `lib/server` or components. (`architecture.test.ts`)
- `packages/shared/src/**` is pure: no React, Next, `apps/`, `@/`; the only workspace import is `@starterkit/ui/lib/*`. (`architecture.test.ts`, `no-domain.test.ts`)
- Only `charts` imports `recharts`; only `packages/ui/src/motion/framer.tsx` imports `motion`; only `packages/ui/src/ui/icons.ts` imports `@hugeicons/core-free-icons`; no `lucide-react`. (`architecture.test.ts`, `packages/ui/src/motion/layer.test.ts`)
- Radix DropdownMenu and Popover are imported only in their `*-impl` file; nothing imports it statically. The phone navigation drawer (`ui/drawer.tsx`) loads its Radix dialog the same way (`drawer-impl.tsx`). (`packages/ui/src/ui/deferred-overlay.test.ts`, `drawer.test.ts`)
- Only `lib/cn.ts` imports the raw class-merge package. (`packages/ui/src/lib/cn.test.ts`)
- No source-app domain words in `apps/web/src`, `packages/ui/src` and `packages/shared/src`; the list lives only in the test. (`apps/web/src/test/no-domain.test.ts`)

## 2. Commands

Package manager and API runtime: Bun 1.4.3; Next runs on Node 24; PostgreSQL 18 in compose and CI.

- `bun install` installs (`--frozen-lockfile` in CI and Docker; `bunfig.toml` pins exact versions).
- `bun run setup` (`scripts/setup.ts`) writes `apps/api/.env` and `apps/web/.env.local` when missing (random `INTERNAL_API_TOKEN`, `DATA_ENCRYPTION_KEY`, `SESSION_SECRET`; `DATABASE_URL` from `--database-url` or the environment; `OAUTH_MOCK=true`, and `LDAP_MOCK=true` in the API's, unless `NODE_ENV=production`), creates the database, migrates and runs both seeds. (`apps/api/test/setup.test.ts`)
- `bun run dev` serves `apps/web` (:3000) and `apps/api` (:4000) together.
- `bun run db:migrate` applies pending migrations; `db:seed` writes the catalog, system roles and the `SEED_SUPERADMIN_*` user (the first Superadmin is created once; later runs leave users alone: skipped while an active Superadmin exists, `apps/api/test/db/seed.test.ts` "bootstrap only"); `db:seed:demo` adds the demo data (refused in production); `db:reset` drops the schema, migrates and runs both (refused in production).
- `bun run db:generate` (`apps/api/src/db/generate.ts`) writes the next `drizzle/NNNN_*.sql` from every `schema.ts` with drizzle-kit and strips `"public".` from its foreign keys; `cd apps/api && bun run db:generate -- --custom --name=<name>` makes an empty file for SQL drizzle-kit can't express.
- `bun run check` = typecheck + lint (`--max-warnings 0`) + every workspace's tests (the API's run against `<database>_test`, created and migrated on first run by `apps/api/test/helpers/preload.ts`). Must pass before every commit.
- API tests: `bun run --filter @starterkit/api test:unit` (`tests/unit` folders, no database), `test:integration` (`tests/integration` folders and `apps/api/test/`), or `cd apps/api && bun test <path>` for one file.
- Web and packages: `bun run --filter @starterkit/web test -- <name>` runs one test file; `bun run test:changed` runs, per workspace, the tests touched since the last commit; `bunx vitest related <files>` inside a package runs the tests that import those files.
- `bun run api:schemas` regenerates `docs/api/schemas/` and the activity action table in `docs/api/README.md` from the zod contracts.
- `NEXT_DIST_DIR=.next-e2e bun run build` builds the web into `apps/web/.next-e2e` (leaves a running dev server's `.next` alone).
- `bun run e2e` resets and demo-seeds `<database>_e2e`, starts the API on :4123 and a production web build on :3123, and runs Playwright on three projects (`desktop`, `tablet`, `mobile`; `apps/web/playwright.config.ts`); `E2E_REUSE=1` reuses servers already on those ports.
- `NEXT_DIST_DIR=.next-e2e bun run budget` checks first-load JS per route of that build (≤ 250 kB gzip).
- `docker compose --env-file .env.compose up -d --build` runs postgres + migrate (migrations, then the system seed) + api + web on http://localhost:3001; every compose command takes `--env-file .env.compose` (`docker-compose.yml` header, `.env.compose.example`).
- Commit messages are conventional (`feat(api): …`) and end with the `Co-Authored-By` line the task asks for.

## 3. Security

Web (BFF):

- Send CSP with a per-request nonce plus the fixed headers from `securityHeaders()`: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`, a `Permissions-Policy` that denies device APIs. (`apps/web/src/security-headers.ts`, `proxy.ts`, `proxy.test.ts`)
- Send `Strict-Transport-Security: max-age=31536000; includeSubDomains` only when `COOKIE_SECURE=true`. (`security-headers.ts`)
- The session cookie `sk_session` is sealed (iron-session, `SESSION_SECRET`), `httpOnly`, `sameSite: "strict"`, `secure` when `COOKIE_SECURE`, `path: "/"`. (`apps/web/src/lib/server/session.ts`, `api.test.ts` "session cookie")
- The cookie holds only `{ token, csrf }` (a full session) or `{ challenge, challengeAt }` (password passed, second factor due, 10 minutes); the user and permissions come from the API on every request (`authContext` → `GET /v1/auth/context`, memoized per request). (`session.ts`, `apps/web/src/lib/server/page-guard.test.ts`, `apps/web/src/app/(auth)/login/2fa/page.test.ts`)
- With a full session, every POST/PATCH/PUT/DELETE through the catch-all needs `x-csrf-token` equal to the cookie's token (constant-time); otherwise 403 `csrf` and the API is never called. (`apps/web/src/lib/server/{forward,csrf}.ts`, `forward.test.ts`, `csrf.test.ts`)
- `/api/auth/*` POSTs must be same-origin (`Sec-Fetch-Site: same-origin`/`none`, or `Origin` equal to `APP_URL`'s origin, never the request URL's, which is the bind address in the standalone server; `X-Forwarded-Host`/`-Proto` count only with `TRUSTED_PROXY=true`); sign-out with a full session needs `x-csrf-token` too. (`sameOrigin` in `apps/web/src/lib/server/api.ts`, `apps/web/src/app/api/auth/auth-routes.test.ts`, `api.test.ts` "sameOrigin")
- The catch-all forwards only a decoded path of `/api/` + `[a-z0-9/_-]` outside `/api/auth/` (no dot segment, encoded or not); anything else is 404. (`v1Path` in `backend.ts`, `forward.test.ts` "`/api/../v1` and `%2e%2e` paths are 404")
- Request headers to the API are built, never copied: `X-Internal-Token`, `Authorization: Bearer <session token>` (only for a full session), `X-Client-Ip`, `X-Client-Ua`, `X-Request-Id`, `Content-Type`; the browser's cookie, authorization, internal token, challenge and host never reach the API. (`backend.ts`, `forward.test.ts` "browser cookie, authorization, x-internal-token and host never reach the API as sent")
- Answers pass back only `content-type`, `content-disposition`, `retry-after` and `cache-control`. (`relay` in `backend.ts`, `forward.test.ts` "CSV passes through with Content-Disposition")
- A request body over 64 KB is 400 before it reaches the API, read chunk by chunk whatever `Content-Length` says. (`bodyOf` in `forward.ts`, `forward.test.ts` "a 70 KB body is 400", `auth-routes.test.ts` "a body over 64 KB")
- An API 401 for a full session clears the cookie; an API that doesn't answer is the fixed 500 `internal` with the cause in the log only. (`forward.ts`, `backend.ts`, `forward.test.ts`, `backend.test.ts`)
- The backend client sends a GET once more on a connection error, never a mutation, and gives up after 10 s. (`backend.ts`, `backend.test.ts`)
- Ignore `X-Forwarded-For` unless `TRUSTED_PROXY=true`, then take its right-most hop; without it the client IP is "unknown". (`clientIp` in `api.ts`, `api.test.ts` "clientIp")
- Redirect only to internal paths: reject `//x`, `/\x`, control characters, and anything that normalizes to a protocol-relative URL; never land on `/login` or `/api`. (`packages/ui/src/lib/safe-path.ts`, `safe-path.test.ts`, `auth-routes.test.ts` "next=//evil.com lands on /")
- The browser calls only same-origin `/api/*`: every `fetch(`/`api(` literal in client code starts with `/api/`, and no `NEXT_PUBLIC_*API*`/`*URL*` variable exists; `API_BASE_URL` is server env only. `api()` throws at runtime unless the path starts with `/api/`; a raw `fetch(` with a non-literal argument is covered only by CSP `connect-src 'self'`. (`apps/web/src/lib/client/api.ts`, `security-headers.ts`, `architecture.test.ts`)
- Never use `dangerouslySetInnerHTML`. (`architecture.test.ts`)

API (`apps/api`):

- Every request needs `X-Internal-Token` equal to `INTERNAL_API_TOKEN` (≥ 32 characters, constant-time), checked before routing, deny by default; the only exception is a GET whose raw path is exactly `/healthz` or `/readyz`. Encoded, doubled, upper-case or dot-segment spellings need the token. (`apps/api/src/kernel/plugins/internal-auth.ts`, `apps/api/test/app.test.ts`)
- The API listens on `127.0.0.1` unless `API_HOST` says otherwise; in production it sits on a private network only (compose publishes no API port). (`apps/api/src/kernel/config.ts`, `docker-compose.yml`)
- A body over 64 KB is 400, also without `Content-Length` (counted while read). (`kernel/plugins/body-limit.ts`, `kernel/parse.ts`, `kernel/tests/integration/plugins.test.ts`, `test/app.test.ts`)
- Sessions live in the API: a 32-byte random token, only its SHA-256 stored; they end `SESSION_TTL_HOURS` (12) after sign-in or `SESSION_IDLE_MINUTES` (120) without a request; an ended session resolves null and its row is deleted; `last_seen_at` is written at most once a minute. (`apps/api/src/modules/auth/sessions.ts`, `modules/auth/tests/integration/sessions.test.ts`)
- Permissions are computed per request from the user's current roles: a role change, a permission removed or a deactivation applies on the next request. (`sessions.test.ts` "a role change applies on the next resolve", "an inactive user resolves null")
- No live session → 401 `unauthenticated`; a missing permission → 403 `forbidden` before the handler runs or reads data. (`modules/auth/guard.ts`, `modules/auth/tests/integration/guard.test.ts`)
- Passwords are argon2id (`Bun.password`); an unknown login runs one dummy verify, so it costs the same as a wrong password. (`modules/auth/password.ts`, `auth.test.ts` "unknown login and wrong password both run one argon2 verify")
- Unknown user, wrong password and an LDAP user on the password method answer the same `invalid_credentials`; `forgot` answers the same and sends nothing for an unknown, LDAP or throttled email. (`modules/auth/tests/integration/auth.test.ts`)
- LDAP sign-in always queries the directory, also for an unknown login or a password user (timing parity), so directory accounts that aren't app users can see bind attempts and may be locked out by the directory's own policy; the sign-in rate limits bound it. (`modules/auth/service.ts`, `auth.test.ts` "method ldap costs one directory check for an unknown login, a password user and an LDAP user")
- The LDAP filter escapes `*()\` and NUL; production needs `ldaps://` or `LDAP_STARTTLS=true`; the whole directory call has a timeout; a failure logs the error's name and code only, never the login. (`modules/auth/ldap.ts`, `modules/auth/tests/unit/ldap.test.ts`)
- TOTP secrets are encrypted with AES-256-GCM under `DATA_ENCRYPTION_KEY` with a `v1:` version prefix; a used TOTP step can't sign in again; recovery codes are argon2id hashes, each spent once, also under concurrent use. (`apps/api/src/kernel/crypto.ts`, `kernel/tests/unit/crypto.test.ts`, `auth.test.ts` "a TOTP code that completed a sign-in cannot be used again", "one recovery code on two challenges in parallel")
- Reset and invitation links: 32 random bytes, SHA-256 stored, one per user, single use, 30 minutes / 72 hours; a reset ends the user's sessions and is refused for an inactive user; a password change, an admin reset, a deactivation and an email change spend them. (`modules/auth/service.ts`, `auth.test.ts` "password reset", `users.test.ts` "deactivating (PATCH, /status, bulk) and an email change spend…", `me.test.ts` "an email change spends…")
- Google/Apple sign-in: authorization code with state (stored hashed, single use, 10 minutes), PKCE (Google), nonce, and the id_token verified against the provider's keys (issuer, audience, expiry, nonce; `alg none` and HS256 refused); the state is bound to the browser by the `sk_oauth` cookie's hash. (`apps/api/src/modules/oauth/{providers,service}.ts`, `modules/oauth/tests/integration/oauth.test.ts`, `modules/oauth/tests/unit/id-token.test.ts`)
- OAuth signs in only an identity already connected: no new user, no match by email; a link needs the session that started it to be live at the callback, sign-out clears `sk_oauth`, and a sign-in through a provider ends the browser's earlier session. (`oauth.test.ts` "linking (mode link)", "login with an unlinked identity is invalid_credentials and creates no user", `auth-routes.test.ts` "logout also clears sk_oauth")
- `OAUTH_MOCK` and `LDAP_MOCK` are refused in production (the web refuses `OAUTH_MOCK` with `COOKIE_SECURE=true`). (`kernel/config.ts`, `kernel/tests/unit/config.test.ts`, `apps/web/src/lib/server/config.test.ts`)
- Re-authenticate before a credential or sign-in identity change: password change, turning 2FA off and a new email on `PATCH /v1/me` take the current password (directory password for LDAP; a recovery code for a Google/Apple-only account turning 2FA off) through `reauth()`, whose attempt is reserved as a failure in one statement (`passwordFails.reserve`, 5 free per user), so parallel guesses can't all pass. Connecting Google or Apple needs a session that proved the user within 10 minutes (`sessions.reauth_at`: the sign-in, or `POST /v1/me/reauth` through `reauth()`), else the link start is 403. (`modules/auth/service.ts`, `modules/me/tests/integration/me.test.ts` "password guess throttle under concurrency", "POST /api/me/reauth", `auth.test.ts` "reauth", `oauth.test.ts` "link needs the session to have proved the user within 10 minutes")
- Rate limits live in PostgreSQL (`rate_limits`, `login_backoff`, UNLOGGED) with one atomic upsert per hit, shared by every API process: sign-in 10/min per IP, 300/min fleet-wide, 5/min per username, then backoff per username (3 free failures, then 1 s, 2 s, 4 s … 60 s, cleared after 15 quiet minutes or a success); forgot 10/min per IP, 3 per 15 minutes per email and 300/min fleet-wide; OAuth starts 20/min per IP. A per-IP limit is skipped for the IP "unknown" (no `TRUSTED_PROXY`), so it never becomes site-wide. (`modules/auth/limits.ts` `hitIp`, `modules/auth/tests/integration/limits.test.ts`, `auth.test.ts` "forgot-password throttle" (with "fleet-wide breaker"), `oauth.test.ts` "the 21st start", "an unknown client IP")
- A lower-ranked actor can't act on a user who holds a permission the actor lacks (actor rank), and no one grants, removes or carries a permission they don't hold (escalation); both are read inside the transaction after the row lock. (`modules/users/rules.ts`, `modules/rbac/rules.ts`, `users.test.ts` "actor rank: …", "role grants (no privilege escalation)", `rbac.test.ts` "the actor's permissions are read inside the transaction")
- A path id that is not a UUID is 404 `not_found` without a query. (`kernel/parse.ts` `idParam`, `kernel/tests/integration/parse.test.ts`)
- Unknown exceptions answer 500 `internal` with a fixed message, never the thrown text. (`kernel/errors.ts`, `test/app.test.ts` "a thrown Error answers 500 internal with the fixed message and never its text")
- Logs redact `password, passwordHash, token, cookie, code, csrf, otpauth, otpauthUri, uri, secret, totpSecret, recoveryCodes, formToken, phone, email` (top level and one level down) and mask `otpauth://` and `secret=` inside strings, in both apps. (`packages/shared/src/log-redact.ts`, `apps/web/src/lib/server/logger.ts`, `apps/api/src/kernel/log.ts`, `apps/web/src/lib/server/logger-redact.test.ts`)
- A failed query is logged as the driver's error: name, masked message, SQLSTATE, constraint and table; never Drizzle's message (it holds the SQL and every parameter), `detail` or `hint` (they quote row values). (`unexpected` in `kernel/errors.ts`, `kernel/tests/unit/errors.test.ts`, `test/app.test.ts` "a real unique violation")
- The access log has method, route pattern, status, ms and request id, never the query string. (`kernel/plugins/context.ts`, `kernel/tests/integration/plugins.test.ts` "one access log line per request")
- A mail failure logs the masked address and the error's name and code, never the address, the text or the server's reply. (`apps/api/src/kernel/mailer.ts`, `kernel/tests/unit/mailer.test.ts`)
- Production mail goes through SMTP over TLS: `smtps://`, or `smtp://` with `?requireTLS=true` (STARTTLS that fails when the server doesn't offer it). (`kernel/config.ts`, `config.test.ts` "production refuses SMTP without TLS")
- Config is validated at boot; an error names each bad key and why, never a value; production needs `APP_URL`. (`kernel/config.ts`, `config.test.ts` "rejects a missing DATABASE_URL and names the key only", "production requires APP_URL")
- Compose gives each service only the keys it lists (`environment:` allow-lists interpolated from `--env-file .env.compose`): the API never gets the schema owner's URL or the session secret, the web never gets a database URL or the encryption key. (`docker-compose.yml`)
- The API connects as a role with SELECT/INSERT/UPDATE/DELETE only; migrations run as the schema owner (`MIGRATION_DATABASE_URL`). (`scripts/compose-app-role.sh`, `apps/api/src/db/migrate.ts`)
- Neutralize CSV cells: prefix `'` when a cell starts with `=`, `+`, `-`, `@` (after optional spaces) or tab/CR. (`packages/ui/src/lib/csv.ts`, `csv.test.ts`, `modules/audit/tests/integration/audit.test.ts` "CSV")
- Commit no secret: env files are gitignored except `*.example`; `gitleaks` scans the tree and CI scans every push. (`.gitignore`, `.gitleaks.toml`, `.github/workflows/ci.yml`)

## 4. Hardening and pentest checklist

A change that touches routes, guards, redirects, sessions or exports needs a test for each applicable case before merge.
API cases live in `apps/api/src/modules/<m>/tests/integration/` and `apps/api/test/`; cross-module rules in
`apps/api/test/architecture/`.

- Internal token: a /v1 request without it, with a wrong one of the same length, or on an encoded/doubled/dot-segment path is 401; routes stay hidden. (`apps/api/test/app.test.ts`)
- Path traversal and URL normalization: `/a/../b`, `%2e%2e`, `%2F` and case variants parse to the page they name or 404. (`apps/web/src/proxy.test.ts`, `page-guard.test.ts`, `safe-path.test.ts`, `forward.test.ts`)
- Open redirect: `//evil.com`, `/\evil`, `%2F%2Fevil`, `/a/..//evil` land on an internal path or `/`, in the web and the API. (`safe-path.test.ts`, `auth.test.ts` "login honours next only for internal paths", `oauth.test.ts` "OAuth honours next only for internal paths")
- IDOR: a user requesting an id that belongs to someone else gets 403 or 404, never the record. (`users.test.ts` "a session of someone else or an unknown one is 404", `me.test.ts` "someone else's or unknown is 404")
- Actor rank: a lower-ranked actor (Admin) gets 403 `forbidden` on every action against a higher-ranked user (Superadmin), single and bulk, and nothing changes. (`users.test.ts` "actor rank: no acting on a user who holds a permission the actor lacks")
- Privilege escalation: granting, removing or carrying a permission the actor lacks is 403, on roles and on user role grants. (`rbac.test.ts` "no escalation", `users.test.ts` "role grants (no privilege escalation)")
- 403 before read: with a missing permission the handler never runs. (`guard.test.ts` "missing permission 403 forbidden before the handler runs", `conformance.test.ts` (b))
- Check order: an out-of-enum or out-of-range query value is 400 before the session is read; a body's 400 comes after the guard and before the 404. (`guard.test.ts` "guard in the contract's check order", `users.test.ts` "rejects … with 400 before guard", `conformance.test.ts` (e), (f))
- CSRF: a mutation without or with a wrong `x-csrf-token` is 403 `csrf` and never reaches the API. (`forward.test.ts`, `csrf.test.ts`, `auth-routes.test.ts` "logout needs the CSRF token")
- Cross-site sign-in: `/api/auth/*` POSTs from another origin are 403. (`auth-routes.test.ts` "POSTs from another origin are 403 forbidden and never reach the API")
- Permission removed or user deactivated mid-session takes effect on the next request. (`sessions.test.ts`, `rbac.test.ts` "removing a permission takes effect on the holder's next request")
- Concurrency: two admins removing the last two active Superadmins, two grants racing a revoke, two catalog writes past 500 names: exactly one wins. (`users.test.ts` "concurrent last superadmin", `rbac.test.ts` "concurrent POSTs can't pass 500 names", "concurrent revoke is not undone by a stale save")
- Rate limit and backoff: per-IP bucket, fleet breaker, per-username cap, concurrent attempts reserved atomically. (`limits.test.ts`, `me.test.ts` "parallel wrong guesses reserve the budget")
- OAuth: state single use, wrong binding, expired state, another provider's state, a wrong nonce, an unlinked identity, a link whose session ended. (`oauth.test.ts`, `id-token.test.ts`)
- Every route is in the docs' endpoint table with its permission, and every row is a route. (`apps/api/test/architecture/conformance.test.ts` (a))
- Deep pages and big tables: `page=1000&pageSize=100` on 200k activity rows answers within the statement timeout with `totalCapped`. (`audit.test.ts` "capped count on 200k rows")
- CSV formula injection, including leading space, tab and CR. (`csv.test.ts`, `audit.test.ts`)
- Secrets absent from log lines, error messages, child bindings, printf arguments and database errors. (`logger-redact.test.ts`, `errors.test.ts`, `mailer.test.ts`)
- Error bodies never contain the thrown message; the database down answers `/readyz` 503 and routes 500. (`app.test.ts`, `modules/health/tests/integration/health.test.ts`)

## 5. Dependencies

- Pin exact versions (no `^`, no `~`); match the versions in the plan header. (`package.json` files, `bunfig.toml` `exact = true`, `bun.lock`)
- Do not add a dependency for what a few lines can do; any new dependency is pinned exact too.

## 6. Tokens and color

- Use color, radius, shadow and type-scale tokens only; hex literals exist only inside `:root` and `.dark`. (`packages/ui/src/styles/tokens.css`, `packages/ui/src/styles/tokens.test.ts`)
- No literal color (`#…`, `rgb(`, `hsl(`, `oklch(`) and no arbitrary pixel class (`-[12px]`) in `.tsx`. (`architecture.test.ts`)
- Surfaces step bg → sheet → tray → card; shadows only on floating layers. Full rules: `docs/standards/design-system.md` §0, §3.
- Status colors are for the five health states only; chart colors `chart-1…6` for series only. (`design-system.md` §3.1, §3.3)

## 7. UI standard

- Follow `docs/standards/ui-standard.md`: page anatomy (§1), grid (§2), the five states per data region (§3), data display (§4), interaction (§5).
- Responsive: phone 360–767 px (reference 390; top bar + navigation drawer), tablet 768–1279 (reference 834; 64 px rail), desktop ≥ 1280 (reference 1440); breakpoints `md` and `xl`, decided in CSS, never `matchMedia` in render. No horizontal page scroll from 360 px; a wide component scrolls inside its card. Below 768 a `Dialog` is a bottom sheet (one variant in `ui/dialog.tsx`). Targets drawn 28 px minimum, 32 px default; under `pointer: coarse` a 44 × 44 px hit area (`base.css`) and inputs at ≥ 16 px; hover-only affordances have a touch path in CSS (row actions shown, `RelativeTime` second line, `BlockedButton` caption, menu button on a touch tablet, a read-only matrix cell's reason on press). Below 768 a `DataTable` is stacked cards (every `Column` has a `mobile` role, one `title`), sorted by the "Sort by" select, with compact pagination; toolbar filters other than the search sit in `ToolbarFilters` (the "Filters" sheet); one DOM for every width, switched in CSS. Below 768 a dialog around a text field passes `phone="top"` (command palette). Safe-area insets on the phone chrome. (`apps/web/tests/e2e/{responsive,responsive-data}.spec.ts` on the desktop, tablet and mobile projects, `packages/ui/src/ui/{drawer,dialog}.test.ts`, `packages/ui/src/ds/{data-table,data-table-dom,toolbar}.test.ts`, `docs/standards/design-system.md` §0)
- Same metric, same label, unit, format and icon on every page; numbers only through `format.ts`.
- Status uses `StatusChip` plus the card's legend, never color alone. Shareable state (filters, tab, range, page) lives in the URL. Query keys start with the owning module (`users`, `rbac`, `me`, `audit`, `dashboard`), built only in `apps/web/src/lib/shared/queries.ts`. (`queries.test.ts`)
- Every list is server-side: the API's list GET pages through `pageQuery` with a whitelisted `sort` (`sortParam`), the screen uses `useTableQuery` + `DataTable` server mode (sortable headers, page-size select, numbered pagination); page size 15 | 25 | 50 | 100 (default 15), page ≤ 1000 (deeper is 400), `totalCapped` shows "N+"; page, size, sort, search and filters live in the URL (any change but the page goes to page 1, Back undoes it). (`packages/shared/src/contracts/common.ts`, `apps/api/test/architecture/conformance.test.ts` (d), `apps/web/src/lib/shared/table-state.test.ts`)
- Status legends live in the card that shows the statuses: `Panel legend={…}` renders the "Status legend" info button in the card header; never a page-level, toolbar or inline legend. (`architecture.test.ts` "StatusLegend is rendered only by Panel", `packages/ui/src/ds/status-legend.test.ts`)
- Every data region has five states (loading in the content's shape, empty saying when data appears, error with retry, stale notice over kept data, data); every async action shows pending on its trigger, announces its result (toast or `role=status`), keeps a recoverable error and returns focus sensibly. (`docs/standards/ui-standard.md` §3)
- Destructive actions confirm through `ConfirmActionDialog` with their impact; an action blocked by a rule is a `BlockedButton` with the reason; everything works by keyboard with a visible focus ring; 404 and forbidden always offer a way back. (`docs/standards/ui-standard.md` §5, `docs/standards/copy-guide.md`)
- One pattern per need in every module (`PageHeader`, server `DataTable`, `Field`, `ConfirmActionDialog`, `BlockedButton`, result toast, one data hook per feature); API handlers run the §12 order; UI words only from the copy-guide glossary; a new module copies an existing one (§13). (`apps/api/test/architecture/conformance.test.ts`, `docs/standards/ui-standard.md`)
- A page that fails while rendering shows its error inside the shell (`app/(main)/error.tsx`; sign-in pages and the signed-in layout: `app/error.tsx`; `global-error.tsx` only for the root layout), with "Try again" (Next's `retry`), or "Reload page" when a code chunk failed to load (a newer deploy); code loaded on demand (lazy charts, `LazyMount`) sits in a `ChunkBoundary`, so a failed chunk takes down only its panel. (`apps/web/src/components/page-error.test.ts`, `packages/ui/src/ds/chunk-boundary.test.ts`)
- Extend the standard and the `/ds` gallery before inventing a one-off component.
- `PageHeader` is rendered by the route's feature component (loading, error and not-found states included), never by `page.tsx`. (`features/*`)
- A detail screen whose record answers 404 shows `DetailNotFound` (no retry, a link to the list); detail queries use `retryUnlessNotFound`. (`apps/web/src/components/detail-not-found.tsx`, `lib/client/api.ts`)
- Loading, one way per case: a route change → its `loading.tsx` (`RouteSkeleton`); a detail screen without data yet → the same sections via `LoadingShape` + `useDelayedFlag` (shape constant exported by the feature, imported by `loading.tsx`); a list → `DataTable` `loading` from `useTableQuery` (paging keeps rows, busy dim); a small part of a loaded page → `Reveal`. (`apps/web/src/components/route-skeleton.tsx`)
- Action results: success → `toast`; a button action's failure → `toast.error`; a form keeps its failure inline (`role="alert"`) beside the submit; a confirm dialog shows its failure inside the dialog. Every async trigger shows pending (spinner + `aria-busy`/disabled).
- Product name only through `BRAND` (`packages/shared/src/brand.ts`): page titles pass their own title (the root layout adds the name), error `source`, the logo's accessible name. The logo is the outline SVG in `apps/web/src/components/brand/` (letters `--brand-ink`, sun `--brand-sun`), placed through the `ds` `Brand` slot; never retype it in a font. Favicon and social image: `apps/web/src/app/{icon.svg,favicon.ico,apple-icon.png,opengraph-image.png}`. (`architecture.test.ts` "product name", `components/brand/brand.test.ts`)
- A page the role can't open answers a real 404 on a document load and names itself nowhere (title via `guardedTitle`, breadcrumb); its permission comes from `pagePerm` and `page.tsx` guards with the same. (`apps/web/src/lib/shared/nav.ts`, `lib/server/page-guard.ts`, `architecture.test.ts`, `tests/e2e/permissions.spec.ts`)

## 8. Motion

- Motion durations and easings come from tokens, never literals: `instant 0.1`, `fast 0.15`, `pop 0.18`, `enter 0.22`, `page 0.26`, `exit 0.16`, `slow 0.28`, `tween 0.6`, `flash 1.2` s. (`packages/ui/src/motion/tokens.ts`, `tokens.test.ts`)
- Stagger is 35 ms per item, at most 8 items, 6 px shift. No stagger or `layout` on tables or lists with more than 20 siblings. (`tokens.ts`, `design-system.md` §7.7)
- Animate `transform` and `opacity` only; `will-change` never in static CSS. Exceptions are listed in `design-system.md` §7.8 (R3, R9).
- Honor `prefers-reduced-motion`: opacity only, no translate, scale, spring, stroke-draw, number tween or shimmer sweep. (`packages/ui/src/motion/reduced-motion.ts`, `globals-css.test.ts`)
- Do not use `motion-safe:animate-pop` or `motion-safe:animate-swap`; the utility already has its reduced fade. (`architecture.test.ts`)
- No literal duration, delay, easing or spring anywhere in `apps/web/src` or `packages/ui/src` (Tailwind `duration-150`, `{ duration: 0.2 }`, `ease: [` or `ease: "linear"`, `cubic-bezier(`, `stiffness:`/`bounce:`, `200ms` in CSS) outside `packages/ui/src/motion/tokens.ts` and CSS custom-property definitions, and no arithmetic on a token with a number (`DUR.slow + 0.32`); use `duration-(--dur-*)`, `DUR`, `EASE`, `SPRING_*`, `CHART_STAGGER`/`barDelay`, `var(--stagger)`. Every `--dur-*`/`--ease-*` has a `DUR`/`EASE` key and the other way round. (`architecture.test.ts` "motion timings come from tokens", `packages/ui/src/motion/tokens.test.ts`)
- App motion is wired once: `(main)/layout.tsx` wraps the page slot in `MotionLayer` + `PageTransitionRoot`, `(main)/template.tsx` renders `PageTransition`. (`architecture.test.ts` "app motion is wired once")
- Card grids and KPI trays stagger on first data reveal (`Stagger`/`StaggerItem`, `stagger-children`); numbers tween (`NumberTween`, `StatTile tween`); indicators use the shared indicator; overlays open and close with the tokens in `OVERLAY_MOTION`. The `/ds` Motion section is the inventory and prints those tokens. (`packages/ui/src/ui/overlay-motion.test.ts`, `apps/web/src/features/ds/motion-section.test.ts`)
- No flicker: a page renders filled on first paint, with no `/api` request after hydration (its first data is server-prefetched through `Prefetch`, see §1); every skeleton, busy dim and `aria-busy` goes through `useDelayedFlag` with the `LOADING` tokens (hidden for the first 150 ms, then at least 300 ms), route `loading.tsx` shapes included (`RouteSkeleton`: until then a client navigation keeps a static copy of the previous page, never a blank; held by `PageTransition`); paging, sorting and filtering keep the previous rows on screen with the busy dim (`placeholderData`), never a skeleton; a page past the end shows the loading shape, not an empty state; layout shift stays under 0.01. (`apps/web/tests/e2e/no-flicker.spec.ts`, `packages/ui/src/motion/use-delayed-flag.test.ts`, `apps/web/src/lib/shared/table-state.test.ts` "tableView")
- A refetch never replays an enter animation, only the new-row flash. (`packages/ui/src/motion/use-new-keys.test.ts`, `packages/ui/src/ds/data-table.test.ts` "highlightNew")
- Exits are faster than enters. The Framer layer loads after idle, outside first-load JS. (`design-system.md` §7.8 R1)

## 9. Performance

- First-load JS gzip stays at or under 250 kB per route; check with `bun run budget` (`apps/web/scripts/bundle-budget.mjs`, default `--budget 250`).
- Wrap below-the-fold charts in `LazyMount`; lazy-load Radix overlays through `deferred-overlay`; load heavy tables with `next/dynamic` when a route nears the budget.
- Show toasts with `toast` from `@starterkit/ui/ui/toast` (loads sonner on the first toast); only `ui/sonner.tsx` and `ui/toast.ts` import `sonner`, and `ui/sonner` only through `import()`. A dialog that opens on click and carries a heavy dependency mounts through `next/dynamic` (`TwoFactorSetup`, `EntryDialog`). (`architecture.test.ts`)
- Do not use `next/image`; icons are inline SVG via `packages/ui/src/ui/icon.tsx`. (Not machine-enforced yet.)
- Client code imports zod contracts and `zod` as types only, so zod never ships in a route's first load. (`architecture.test.ts` "client code imports zod contracts and zod as types only")

## 10. Copy

- All UI text is English, sentence case, no exclamation marks, no emoji. Full rules and glossary: `docs/standards/copy-guide.md`.
- Use glossary terms exactly: user, role, permission, session, activity log, sign-in log, sign in / sign out, one-time code.
- Buttons are verb + object ("Create user"); never "OK", "Yes", "Submit". Errors say what happened, why, and what to do.
- Every disabled action explains why; every empty state says when data appears.
- Avoid: sorry, oops, simply, just, easily, successfully, utilize, in order to, N/A.

## 11. Tests and definition of done

- Write the failing test first for logic, guards and contracts. A guard ships with fixtures that prove it fails on a violation (`apps/web/src/test/architecture.test.ts` "architecture checkers (fixtures)", `apps/api/test/architecture/*.test.ts` "fixture: …").
- Web and packages keep a test next to its module (`*.test.ts`); the API keeps tests in the module's `tests/{unit,integration}/` (unit = no database or HTTP), `kernel/tests/` or `apps/api/test/`. (`apps/api/test/architecture/boundaries.test.ts` "no test file sits beside the source")
- API integration tests run against `<database>_test` through `app.handle` (`apps/api/test/helpers/app.ts`: `call`, `resetData`, `signIn`; `test/helpers/db.ts`: `holdTx`, `lockWaiters` for lock-wait races). Bun 1.4.3: catch a rejected query with `.catch((e) => e)`, never `expect(…).rejects`.
- While working, run only the related tests (`bun test <path>` in `apps/api`, `bunx vitest related <files>` or `bun run test:changed` elsewhere); run the full `bun run check` before the task's final commit, and always in final verification.
- Playwright and other browser artifacts (screenshots, traces, logs) go under `.superpowers/scratch/` (gitignored), never outside the repo.
- Playwright runs three projects (`apps/web/playwright.config.ts`): `desktop` 1440 × 900 runs every spec, `tablet` 834 × 1112 runs `responsive.spec.ts`, `responsive-data.spec.ts` and `a11y.spec.ts`, `mobile` 390 × 844 (touch, `isMobile`) runs those, `no-flicker.spec.ts` (its sidebar navigations skip on the phone), `ds.spec.ts` (the phone baselines, CSS pixels) and `reauth.spec.ts` (the password sheet before connecting an account). Chromium emulation only: no WebKit, no real device. Screenshot baselines carry the project name (`ds-light-desktop-darwin.png`).
- Done = `bun run check` passes + the related E2E passes + no banned word (§1) in `apps/web/src`, `packages/ui/src` and `packages/shared/src`.
- A new route, guard or redirect adds its §4 cases.
- A new color, motion value or icon goes through tokens/`icons.ts` first, then the `/ds` gallery.

## 12. Backend (`apps/api`)

### Contract

The API contract is the zod schemas in `packages/shared/src/contracts/*`, published as JSON Schema in `docs/api/schemas/`
with the endpoint table in `docs/api/README.md`. After changing a contract or a route, run `bun run api:schemas` and
update the table; `apps/web/src/test/api-contract.test.ts` fails on schema drift and
`apps/api/test/architecture/conformance.test.ts` (a) on a route missing from the table or a row without a route.

- API paths mirror web paths: `/api/<x>` ↔ `/v1/<x>`, same method, query and body. (`v1Path` in `apps/web/src/lib/server/backend.ts`)
- Error body: `{ "error": { "code": string, "message": string } }`; codes and statuses are fixed in `ERROR_STATUS`: `unauthenticated` 401, `forbidden` 403, `csrf` 403, `not_found` 404, `bad_request` 400, `duplicate` 409, `rate_limited` 429, `invalid_credentials` 401 (400 when a signed-in user's current password is wrong), `account_inactive` 403, `invalid_code` 400, `superadmin_locked` 409, `last_superadmin` 409, `self_action` 409, `role_in_use` 409, `ldap_password` 409, `already_enabled` 409, `only_sign_in_method` 409, `internal` 500. (`packages/shared/src/contracts/common.ts`, `apps/api/src/kernel/errors.ts`)
- Rate-limited responses (429) send `Retry-After` in seconds (seconds left in the window). (`tooManyAttempts` in `kernel/errors.ts`, `auth.test.ts` "6th failed attempt")
- Paging query: `page` 1–1000 (deeper is 400), `pageSize` 15, 25, 50 or 100 (default 15), `q`, `sort` (`field` or `-field`, whitelisted per endpoint with `sortParam`); answer `{ items, total, page, pageSize, totalCapped? }`. No endpoint answers an unbounded array. (`packages/shared/src/contracts/common.ts`, `paging.ts`)
- Bulk answer: `{ done: string[]; skipped: { id, code }[] }`; only `done` rows reach the activity log. (`users.test.ts` "bulk deactivate with self and a Superadmin skips both with codes, logs only done ids")
- Answers send `Cache-Control: no-store`. (`kernel/errors.ts`, `kernel/plugins/context.ts`, `test/app.test.ts`)
- Permissions: `user.{view,create,edit,delete}`, `role.{view,create,edit,delete}`, `permission.{view,create}`, `audit.view`; catalog in `packages/shared/src/permissions.ts`; a module's other actions imply its `view` (`withViews`). (`rbac.test.ts` "a module's view comes with its other actions")

### Route order and helpers

- Every handler in `modules/<m>/controller.ts` runs: query 400 (the route's `query` schema, validated by Elysia before the guard) → `guard` 401/403 → `body(c, Schema)` 400 → `idParam`/404 → rules (actor rank first) → change → `recordActivity(tx, …)` in the same transaction → answer. (`apps/api/test/architecture/conformance.test.ts` (b), (e), (f); `modules/auth/tests/integration/guard.test.ts` "guard in the contract's check order"; `users.test.ts` "order: parse (400) → guard → existence (404) → rules")
- `guard` is the auth module's Elysia macro (`apps/api/src/modules/auth/guard.ts`): a route declares `{ guard: "<permission>" }` or `{ guard: null }` (any live session) and its handler gets `ctx` (user, session id, permissions, client, request id). (`conformance.test.ts` (b))
- Only the bulk route checks its permission in the handler (it depends on the body): `{ guard: null }`, allowlisted, before any service call. (`conformance.test.ts` "fixture (b): an in-handler permission check passes only when allowlisted")
- Controllers chain only `.use(guard)` and route methods, with route options `query` and `guard` only and the handler inline; no lifecycle hook (`derive`, `beforeHandle` …) that could run before the guard. (`conformance.test.ts` "fixture (b): no guard option, an unknown route option, a lifecycle hook, a handler not inline")
- Every list GET pages through `pageQuery` (`apps/api/src/kernel/pagination.ts`: count capped at `COUNT_CAP` 100,000 → `totalCapped`, ties broken by id, sort keys through `sortSql`'s whitelist, `likeEscape` before `ilike`); a CSV branch calls a `…Csv` function capped at `CSV_MAX_ROWS` (10,000). (`conformance.test.ts` (d), `kernel/tests/{unit,integration}/pagination.test.ts`)
- A change writes its activity entry with `recordActivity(tx, ctx, { action, target, before?, after? })` (audit's public API) inside its own `db.transaction`; `recordActivity` takes `InTx` (`kernel/db.ts`), so passing `db` fails typecheck, and a function that records activity writes only through its transaction handle. A change that changes nothing writes no entry. An auth step that changes no record of the log's kind (`POST /v1/me/reauth`) is named in `NO_ACTIVITY`, which fails on a stale entry. (`conformance.test.ts` (c), `modules/audit/tests/integration/record.test.ts` "recordActivity takes a transaction handle only")
- Activity snapshots drop a record's own credential fields and mask any field named like `password|secret|token|recovery`. (`modules/audit/rules.ts`, `modules/audit/tests/unit/rules.test.ts`, `record.test.ts`)
- The sign-in controllers (`auth`, `oauth`) are exempt from (b)–(f) by file name; the exemption list fails on a stale entry. (`conformance.test.ts` (g))
- Throw `ApiError(code, message?)` or a helper of `kernel/errors.ts` (`notFound`, `currentSession`, `tooManyAttempts`); a zod error becomes 400, anything else the fixed 500. (`kernel/errors.ts`, `kernel/plugins/error.ts`, `test/app.test.ts`)
- Read the body only through `body(c, Schema)` (malformed JSON, a non-JSON type or a schema miss → 400) and path ids only through `idParam` (non-UUID → 404). (`kernel/parse.ts`, `kernel/tests/{unit,integration}/parse.test.ts`)

### Data

- Every query goes through Drizzle (`db` in `apps/api/src/kernel/db.ts`, the query builder or the relational API); no hand-written `select … from`, `insert into`, `update … set` or `delete from` in `src/` outside the migration runner. Drizzle's `sql` only inside builder expressions for PostgreSQL functions without a builder form (advisory locks, `now()`/intervals, `array_agg`, `greatest`, `at time zone`). (`apps/api/test/architecture/boundaries.test.ts` "no hand-written SQL statement in src/ outside the migration runner")
- Values reach PostgreSQL only as bound parameters; identifiers and sort columns only from whitelists. (`sortSql` in `kernel/pagination.ts`, `kernel/tests/unit/pagination.test.ts` "refuses a key outside the whitelist")
- A table is declared in its module's `schema.ts`; `bun run db:generate` writes the migration, `cd apps/api && bun run db:generate -- --custom --name=<name>` an empty file for what drizzle-kit can't express (trigram indexes, UNLOGGED tables, triggers: `drizzle/0001_custom.sql`). (`apps/api/src/db/generate.ts`, `apps/api/drizzle.config.ts`)
- No `"public".` in a migration (`db:generate` strips it from foreign keys), so it runs in whatever schema is first on the search path. (`apps/api/test/db/migrate.test.ts` "no migration names the public schema")
- Migrations are forward-only; never edit or delete an applied file, add the next one. The runner applies each pending file once, in its own transaction, under an advisory lock, and refuses to start when an applied file's SHA-256 changed. (`apps/api/src/db/migrate.ts`, `migrate.test.ts` "a changed applied file throws", "two concurrent migrate() calls apply each file once")
- Every pool connection has `statement_timeout` 5 s and `idle_in_transaction_session_timeout` 10 s. (`kernel/db.ts`, `kernel/tests/integration/db.test.ts`)
- An invariant two requests could both pass is checked inside the transaction under a named advisory lock: `xactLock(tx, "superadmin")` before any change that can lower the number of active Superadmins, `xactLock(tx, "catalog")` before a catalog write. Every lock key lives in `LOCKS` (`apps/api/src/kernel/locks.ts`). (`users.test.ts` "concurrent last superadmin", `rbac.test.ts` "concurrent POSTs can't pass 500 names", `kernel/tests/unit/locks.test.ts`)
- Authorization that depends on rows another request can change is read after the lock: lock the row (`.for("update")`), then read the actor's permissions with `actorPermissions(tx, …)` and the target's rank inside the transaction, never from `ctx.perms` read before. (`users.test.ts` "a PATCH that was waiting on the user's row lock can't act on a user who now outranks the actor", `rbac.test.ts` "a PATCH that was waiting on the role lock can't add a permission revoked from the actor meanwhile")
- Audit rows are append-only (an UPDATE raises, trigger in `drizzle/0001_custom.sql`); only the janitor deletes them, past `AUDIT_RETENTION_DAYS`, 10,000 rows per table per run. (`test/db/migrate.test.ts`, `test/db/janitor.test.ts`)
- The janitor runs in every API process every 5 minutes under `pg_try_advisory_lock(LOCKS.janitor)`, so one instance works at a time; each owning module purges its own ended rows (`purgeAuth`, `purgeOAuth`, `purgeAudit`). (`apps/api/src/db/janitor.ts`, `test/db/janitor.test.ts`)
- Shared state lives in PostgreSQL, not in process memory (rate limits, backoff, sessions, OAuth states); there is no Redis or broker. (`modules/auth/limits.ts`, `limits.test.ts` "20 concurrent hits on a limit of 10 allow exactly 10")
- Mail is sent after the commit and never blocks the answer (`sendMail` is fire-and-forget; a failure is logged). (`kernel/mailer.ts`, its callers in `modules/{auth,users}/service.ts`)

### Modules and boundaries

- A module is `apps/api/src/modules/<m>/`: `index.ts` (its public API: the controller factory and what other modules may use), `controller.ts` (routes), `service.ts` (logic and Drizzle), `schema.ts` (its tables), `rules.ts` (pure rules, unit-tested), `tests/{unit,integration}/`; it is mounted by one `.use(<m>Controller())` in `modules/index.ts`.
- Another module is used only through its `index.ts`, never its `service.ts`, `schema.ts`, `rules.ts` or `controller.ts`; the one exception is a `schema.ts` importing another module's `schema.ts` for a foreign key. (`boundaries.test.ts` "a module is used only through its index.ts")
- `kernel/` never imports `modules/`, and neither imports `db/` (the runner, janitor and seeds sit above both; tests may read seed values). (`boundaries.test.ts` "kernel/ never imports modules/, and neither imports db/")
- Every table is owned by exactly one module's `schema.ts`, and the database holds no table without an owner; another module writes it only through the owner's exported functions and reads or joins it through the table the owner's `index.ts` exports. Ownership today: `auth` sessions, auth_challenges, user_tokens, rate_limits, login_backoff; `oauth` oauth_states, user_identities; `users` users, recovery_codes; `rbac` roles, permissions, role_permissions, user_roles; `audit` activity, auth_log. (`boundaries.test.ts` "every table is owned by exactly one module, the database's tables included")
- Module indexes may import each other (auth ↔ users, auth ↔ rbac, auth ↔ oauth, audit ↔ users); never use another module's export at module load; controllers are factories. (`boundaries.test.ts` "every module index and app.ts loads alone and builds its controllers", which loads each `modules/*/index.ts` and `app.ts` alone in a fresh `bun` process)
- `src/` imports by name only (no namespace import, default import of a local file, `export *` or `import()`), so the conformance call graph sees every call. (`conformance.test.ts` "src/ imports only by name")
- No event bus: a cross-module effect that must be atomic (the activity entry, a role grant) is a synchronous call through the owner's index in the same transaction.

## 13. How to add a module

A new module (say `projects`) copies the shape of an existing one end to end; `rbac` has every file of that shape.

API (`apps/api`):

1. Create `src/modules/projects/` with `schema.ts` (its tables; a foreign key may import another module's `schema.ts`), `service.ts` (Drizzle only, §12 Data), `rules.ts` (pure rules), `controller.ts` (`export const projectsController = () => new Elysia().use(guard).get(…, { query, guard })…`, §12 route order) and `index.ts` (export the controller and only what other modules need).
2. Register it: one `.use(projectsController())` line in `src/modules/index.ts`.
3. Migration: `bun run db:generate` (strips `"public".`), add custom SQL with `cd apps/api && bun run db:generate -- --custom --name=projects` when needed, then `bun run db:migrate`. Never edit an applied file.
4. Permissions: add the module and its actions to `MODULES` and `PermissionName` in `packages/shared/src/permissions.ts`; `bun run db:seed` adds the new names to the catalog and Superadmin (existing Admin/Viewer roles keep their own set; grant through the roles screen).
5. Contracts: zod schemas in `packages/shared/src/contracts/projects.ts`, sort keys in `packages/shared/src/paging.ts`, activity actions in `ACTION_LABEL` (`packages/shared/src/audit.ts`); import the contracts file in `apps/web/scripts/emit-api-schemas.ts` (and give each new action its before/after shape there).
6. Docs: one row per route in the endpoint table of `docs/api/README.md` (with permission, request, answer, errors), then `bun run api:schemas`. The conformance and contract tests fail until both match.
7. Tests: `src/modules/projects/tests/unit/` for `rules.ts`, `tests/integration/` for every route (guard, 400 before guard, 404, rules, activity entry, the §4 cases that apply); `bun test src/modules/projects`, then `bun run check` (the boundaries and conformance tests cover the rest).

Web (`apps/web`):

1. Screens and one data hook in `src/features/projects/` (`use-projects.ts`); never import a sibling feature. No new `route.ts`: the catch-all already forwards `/api/projects/*` to `/v1/projects/*`.
2. Query keys and table definitions in `src/lib/shared/queries.ts` (first element `"projects"`), and a prefetch read in `reads` (`src/lib/server/prefetch.tsx`).
3. Pages under `src/app/(main)/projects/`: `page.tsx` (`requirePagePermission(perm)`, `generateMetadata = () => guardedTitle(…)`, `<Prefetch reads={[reads.projects(…)]}>` around the feature screen) and `loading.tsx` (`RouteSkeleton` with the page's sections).
4. Navigation: an entry in `NAV` with its `perm` (`src/lib/shared/nav.ts`), and a `pagePerm` rule for sub-pages that need a finer permission; `page.tsx` guards with the same. (`architecture.test.ts` "each signed-in page guards with the permission pagePerm gives its path")
5. Tables: `useTableQuery` + server `DataTable`; every `Column` has a `mobile` role (`title` exactly once, `meta`, `hidden`, `lead`), filters other than the search in `ToolbarFilters`. (`packages/ui/src/ds/data-table.tsx`, `docs/standards/ui-standard.md` §4)
6. E2E: permissions and flows in `tests/e2e/permissions.spec.ts` (or a new spec), the new pages in `responsive.spec.ts` / `responsive-data.spec.ts` and `a11y.spec.ts` so they run on the desktop, tablet and mobile projects; then `bun run e2e` and `bun run budget`.
