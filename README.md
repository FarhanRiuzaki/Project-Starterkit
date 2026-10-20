# Starterkit

The SunnyGo starterkit: a template for internal web apps and admin products. It ships sign-in (password, two-factor,
Google/Apple, LDAP), users, roles and permissions, an activity log and a sign-in log, a responsive design system
(phone, tablet, desktop) in the SunnyGo brand, and an API on Bun and PostgreSQL. A new project copies this repository
and changes it; nothing here is published as a library.

| Part | Stack |
|---|---|
| `apps/web` | Next.js 16.3 (App Router) on Node 24, React 19, TanStack Query 5, Tailwind 4; a BFF: the browser talks only to it |
| `apps/api` | Bun 1.4.3, Elysia 1.4.30, Drizzle ORM 0.45.4 (driver `bun-sql`), zod 4; a modular monolith |
| Database | PostgreSQL (18 in compose and CI) |
| `packages/shared` | zod contracts, permission catalog, paging, audit vocabulary, log redaction, `BRAND` |
| `packages/ui` | design-system tokens, primitives, motion, `ds` components, charts |
| Tests | `bun test` (API, against a real PostgreSQL), Vitest (web and packages), Playwright (3 viewports) |

## Quick start

Needs Bun 1.4.3, Node 24 and a PostgreSQL server you can create databases on.

```sh
bun install
DATABASE_URL='postgresql://user:password@localhost:5432/starterkit' bun run setup
bun run dev     # web http://localhost:3000, API http://127.0.0.1:4000
```

`bun run setup` (`scripts/setup.ts`) prints file names and steps, never a value. It:

1. writes `apps/api/.env` when missing: `DATABASE_URL`, a random `INTERNAL_API_TOKEN` and `DATA_ENCRYPTION_KEY`, and
   `SEED_SUPERADMIN_*` from the environment (empty when unset);
2. writes `apps/web/.env.local` when missing: `API_BASE_URL=http://127.0.0.1:4000`, the same `INTERNAL_API_TOKEN`, a
   random `SESSION_SECRET`;
3. creates the database when missing, applies the migrations, and runs `db:seed` and `db:seed:demo`.

Both files are written with mode 0600 and are gitignored; an existing file is kept as it is. `--database-url <url>`
works too, but `bun run` echoes the command line, password included.

To sign in with the demo LDAP, Google and Apple accounts, turn the development mocks on (setup doesn't), then restart
`bun run dev`:

```sh
# apps/api/.env
OAUTH_MOCK=true
LDAP_MOCK=true
# apps/web/.env.local
OAUTH_MOCK=true
```

### Demo accounts

`bun run db:seed:demo` (`apps/api/src/db/seed/demo.ts`, refused in production) creates them; `bun run db:reset` brings
them back. Every account signs in with its email or its username. Password `Password123!`, except the LDAP account.

| Email | Role | Notes |
|---|---|---|
| `superadmin@example.com` | Superadmin | Every permission; the role is locked. |
| `admin@example.com` | Admin | Everything except roles and permissions. |
| `viewer@example.com` | Viewer | `user.view` and `audit.view` only: no Roles or Permissions in the menu. |
| `twofa@example.com` | Admin | Two-factor on. TOTP secret `JBSWY3DPEHPK3PXP`. Recovery codes, each works once: `aaaa-1111`, `bbbb-2222`, `cccc-3333`, `dddd-4444`, `eeee-5555`, `ffff-6666`, `gggg-7777`, `hhhh-8888`. |
| `inactive@example.com` | Viewer | Inactive: sign-in says the account is inactive. |
| `ldap@example.com` | Viewer | Directory account (username `ldap`): choose LDAP on the sign-in page, password `LdapPass123!`; needs `LDAP_MOCK=true`. |
| `google@example.com` | Viewer | Connected to Google: "Continue with Google" signs in as this user; needs `OAUTH_MOCK=true`. |
| `apple@example.com` | Viewer | Connected to Apple: "Continue with Apple" signs in as this user; needs `OAUTH_MOCK=true`. |

The demo seed also adds 42 generated users (`<name>.<n>@example.com`, same password, about 20 % Admin and 10 %
inactive), 200 activity entries and 300 sign-in log entries. These credentials exist only in the demo seed; never reuse
them.

With `MAIL_TRANSPORT=log` (the default), "Forgot password?" and "Send an invitation link" send no email: the API writes
a log line without the address or the text. An LDAP user created in the UI has no entry in the mock directory, so only
`ldap` can sign in through it.

### Your own Superadmin

`bun run db:seed` (also run by setup) creates one Superadmin from `SEED_SUPERADMIN_NAME`, `SEED_SUPERADMIN_EMAIL`,
`SEED_SUPERADMIN_USERNAME` and `SEED_SUPERADMIN_PASSWORD` in `apps/api/.env` (all four or none). It is idempotent: a user
with that email already there is left as it is; a different user holding that username is an error. In production the
password must be 12 to 128 characters; elsewhere a shorter one is accepted with a warning.

## Architecture

```
 browser
    │  same-origin /api/* only (cookie sk_session; x-csrf-token on mutations)
    ▼
 apps/web  (Next.js BFF, :3000)
    │  security headers + nonce CSP, sealed cookie, CSRF, same-origin, 64 KB body cap, path shape check
    │  app/api/[...path] → lib/server/forward.ts; app/api/auth/* set or clear the cookie
    │  pages: page guard (GET /v1/auth/context) + server prefetch of the URLs the screens fetch
    ▼  HTTP /v1/*: X-Internal-Token, Authorization: Bearer <session token>, X-Client-Ip/-Ua, X-Request-Id
 apps/api  (Bun + Elysia, :4000, 127.0.0.1 by default)
    │  kernel plugins: error mapping, request context + access log, 64 KB body cap, internal token (deny by default)
    │  modules: health, auth, oauth, me, rbac, users, audit, dashboard (controller → service → Drizzle)
    ▼  Drizzle over a bun-sql pool (5 s statement timeout)
 PostgreSQL
    users, roles, sessions, rate limits, OAuth states, audit (append-only); all shared state lives here, no Redis
```

The web holds no domain logic and no database driver; the API decides permissions on every request. The API contract
(endpoints, permissions, JSON Schemas, error codes, paging) is [`docs/api/README.md`](docs/api/README.md).

## Repository

```
apps/web/                 Next.js 16 App Router app (BFF)
  src/app/                pages: (auth) sign-in screens, (main) the signed-in shell; api/[...path] the catch-all, api/auth/* the cookie routes
  src/features/<module>/  screens per module (users, rbac, audit, me, auth, dashboard, ds); never import each other
  src/components/         shell and shared app components
  src/lib/shared/         pure web code: nav and page permissions, table state, query keys
  src/lib/server/         API client (backend.ts), catch-all (forward.ts), session cookie, CSRF, page guard, prefetch, config, logger
  src/lib/client/         browser API client, auth context, table query hook
  tests/e2e/              Playwright specs (desktop, tablet, mobile projects)
  scripts/                bundle-budget.mjs, emit-api-schemas.ts
apps/api/
  src/kernel/             config, db, errors, locks, log, mailer, pagination, parse, crypto, plugins/
  src/modules/<module>/   index.ts (public API), controller.ts, service.ts, schema.ts, rules.ts, tests/{unit,integration}
  src/modules/index.ts    the module registry
  src/db/                 migrate.ts, janitor.ts, seed/{system,demo,cli}.ts
  drizzle/                migrations (drizzle-kit output + custom SQL)
  test/                   helpers/, architecture/ (boundaries, conformance), db/, app.test.ts
packages/shared/src/      contracts, permissions, paging, audit vocabulary, log redaction, brand
packages/ui/src/          tokens and styles, ui primitives, motion, ds components, charts
docs/standards/           UI standard, design system, copy guide
docs/api/                 API contract: endpoint table and JSON Schemas
scripts/                  setup.ts, compose-app-role.sh
```

## Scripts

| Command | What it does |
|---|---|
| `bun run setup` | Env files (when missing), database, migrations, both seeds (see Quick start). |
| `bun run dev` | `apps/web` on :3000 and `apps/api` on :4000 together. |
| `bun run db:migrate` | Applies pending `apps/api/drizzle/*.sql` as `MIGRATION_DATABASE_URL` (else `DATABASE_URL`). |
| `bun run db:seed` | Permission catalog, roles Superadmin/Admin/Viewer, the `SEED_SUPERADMIN_*` user. Idempotent. |
| `bun run db:seed:demo` | Demo accounts and data. Refused with `NODE_ENV=production`. |
| `bun run db:reset` | Drops the schema, migrates, runs both seeds. Refused with `NODE_ENV=production`. |
| `bun run check` | Typecheck, lint (no warnings allowed) and every workspace's tests; the API's run against `<database>_test`, created and migrated on first run. Must pass before every commit. |
| `bun run --filter @starterkit/api test:unit` / `test:integration` | API unit tests (no database) / integration and architecture tests. |
| `bun run test:changed` | Tests touched by the files changed since the last commit. |
| `bun run build` | Production build of `apps/web` (`NEXT_DIST_DIR=.next-e2e` builds into `apps/web/.next-e2e`). |
| `bun run e2e` | Resets and demo-seeds `<database>_e2e`, starts the API on :4123 and a production web build (`apps/web/.next-e2e`) on :3123, and runs Playwright on the desktop (1440 × 900), tablet (834 × 1112) and mobile (390 × 844, touch) projects. `E2E_DATABASE_URL` picks another database (its name must end in `_e2e`); `E2E_REUSE=1` reuses servers already on `E2E_PORT` and `E2E_API_PORT`; artifacts go to `.superpowers/scratch/`. |
| `bun run budget` | First-load JS per route after a build: at most 250 kB gzip each (`NEXT_DIST_DIR=.next-e2e` reads the E2E build). |
| `bun run api:schemas` | Regenerates `docs/api/schemas/` and the activity action table from the zod contracts. |
| `cd apps/api && bunx drizzle-kit generate` | The next migration from every module's `schema.ts` (then strip `"public".`, see `apps/api/drizzle.config.ts`). |

Playwright uses the Chromium it already has. `/ds` screenshot baselines are per project and platform
(`ds-light-desktop-darwin.png`), so a Linux CI runner looks for `…-linux.png` and fails until it has its own. Make them
on that platform (for CI: in the same Linux image the runner uses) with `bunx playwright test ds --update-snapshots`
inside `apps/web`, review them by eye, and commit them next to the others.

## Configuration

Every setting is server environment; there is no `NEXT_PUBLIC_*` setting. Empty counts as unset in both apps. A missing
or invalid value stops the process with an error that names the key, never the value. Every key, with placeholders:
[`apps/api/.env.example`](apps/api/.env.example), [`apps/web/.env.example`](apps/web/.env.example),
[`.env.compose.example`](.env.compose.example); the config tests fail when a key is missing from its example file.

### API (`apps/api/.env`, schema `apps/api/src/kernel/config.ts`)

| Key | Required in production | Default | Meaning |
|---|---|---|---|
| `NODE_ENV` | `production` | `development` | `development`, `test` or `production`; production turns on the checks in this column. The API image sets it. |
| `DATABASE_URL` | yes | – | The app's connection (in production a role with SELECT/INSERT/UPDATE/DELETE only). |
| `MIGRATION_DATABASE_URL` | recommended | `DATABASE_URL` | The schema owner, for `db:migrate`, `db:seed` and `db:reset`. |
| `DB_POOL_MAX` | no | `10` | Pool size, 1 to 100. |
| `INTERNAL_API_TOKEN` | yes | – | At least 32 characters, the same value as the web's; every request but `GET /healthz` and `/readyz` must send it. |
| `DATA_ENCRYPTION_KEY` | yes | – | Base64 of exactly 32 bytes (`openssl rand -base64 32`); encrypts TOTP secrets. |
| `API_HOST` | no | `127.0.0.1` | Listen address (the image sets `0.0.0.0` inside its network). |
| `API_PORT` | no | `4000` | Listen port. |
| `SESSION_TTL_HOURS` | no | `12` | A session ends this long after sign-in, 1 to 24. |
| `SESSION_IDLE_MINUTES` | no | `120` | A session ends after this long without a request, 5 to 1440. |
| `APP_URL` | set it | `http://localhost:3000` | The web's public origin: links in emails and the OAuth redirect URIs. Not enforced, but the links are wrong without it. |
| `MAIL_TRANSPORT` | `smtp` | `log` | `log` writes a log line instead of sending (development, tests). |
| `SMTP_URL` | with `smtp` | – | `smtps://user:pass@host:465` (TLS from the first byte) or `smtp://user:pass@host:587?requireTLS=true` (STARTTLS, refused when the server doesn't offer it); production refuses plain `smtp://`. |
| `MAIL_FROM` | with `smtp` | – | Sender, e.g. `SunnyGo <noreply@example.com>`. |
| `AUDIT_RETENTION_DAYS` | no | `365` | Activity and sign-in log entries older than this are deleted by the janitor, 30 to 3650. |
| `LOG_LEVEL` | no | `info` | pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`. |
| `OAUTH_MOCK` | must be `false` | `false` | Fake Google/Apple authorize step (the web needs it too). |
| `LDAP_MOCK` | must be `false` | `false` | Mock directory with the demo `ldap` account only. |
| `LDAP_URL` | no | – | `ldap://` or `ldaps://`; turns directory sign-in on. Production needs `ldaps://` or `LDAP_STARTTLS=true`. |
| `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` | no | – | Service account the search binds as (no bind when unset). |
| `LDAP_BASE_DN` | with `LDAP_URL` | – | Where the user search starts. |
| `LDAP_USER_FILTER` | no | `(uid={username})` | Search filter; must contain `{username}` (escaped before use). |
| `LDAP_STARTTLS` | with `ldap://` | `false` | Upgrade an `ldap://` connection with StartTLS first. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | – | Google sign-in; both or neither. |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | no | – | Sign in with Apple; all four or none. The key is the `.p8` PKCS#8 PEM; line breaks may be written as `\n`. |
| `SEED_SUPERADMIN_NAME` / `_EMAIL` / `_USERNAME` / `_PASSWORD` | no | – | Read by `db:seed` only: the first Superadmin; all four or none; password 12 to 128 characters in production. |

### Web (`apps/web/.env.local`, schema `apps/web/src/lib/server/config.ts`)

| Key | Required in production | Default | Meaning |
|---|---|---|---|
| `INTERNAL_API_TOKEN` | yes (always) | – | Same value as the API's, at least 32 characters. |
| `SESSION_SECRET` | yes | random per process (development) | Seals the session cookie, at least 32 characters. Without it every restart signs everyone out. |
| `API_BASE_URL` | yes | `http://127.0.0.1:4000` | The API, `http(s)` only; never reaches the browser. |
| `APP_URL` | yes | `http://localhost:3000` | Public origin of the site (`metadataBase`: absolute `og:image` and icon URLs). |
| `SESSION_TTL_HOURS` | no | `12` | Cookie lifetime, 1 to 24 hours (the API ends sessions by its own settings). |
| `COOKIE_SECURE` | `true` behind HTTPS | `false` | `Secure` cookies and `Strict-Transport-Security`. |
| `TRUSTED_PROXY` | no | `false` | `true` only behind a proxy that appends `X-Forwarded-For` and sets `X-Forwarded-Host`/`-Proto`; otherwise those headers are ignored. |
| `LOG_LEVEL` | no | `info` | pino level. |
| `OAUTH_MOCK` | must be `false` | `false` | Fake Google/Apple authorize page (the API needs it too); refused in production with `COOKIE_SECURE=true`. |
| `NEXT_DIST_DIR` | build time only | `.next` | Build output folder (`.next-e2e` for the E2E build). |

### Compose (`.env.compose`, read by `docker-compose.yml`)

| Key | Required | Default | Goes to | Meaning |
|---|---|---|---|---|
| `POSTGRES_PASSWORD` | yes | – | postgres | Password of the superuser `postgres`, owner of the schema. |
| `APP_DB_PASSWORD` | yes | – | postgres | Password of `starterkit_app`, created when the volume is new (`scripts/compose-app-role.sh`). |
| `DATABASE_URL` | yes | – | api, migrate | `postgresql://starterkit_app:<APP_DB_PASSWORD>@postgres:5432/starterkit`. |
| `MIGRATION_DATABASE_URL` | yes | – | migrate | `postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/starterkit`. |
| `INTERNAL_API_TOKEN` | yes | – | api, web | At least 32 characters. |
| `DATA_ENCRYPTION_KEY` | yes | – | api | Base64 of 32 bytes. |
| `SESSION_SECRET` | yes | – | web | At least 32 characters. |
| `APP_URL` | yes | – (api alone: `http://localhost:3001`) | api, web | Public origin users open. |
| `MAIL_TRANSPORT` | no | `smtp` | api | Production requires `smtp`. |
| `SMTP_URL`, `MAIL_FROM` | yes | – | api | As in the API table. |
| `COOKIE_SECURE` | no | `false` | web | `true` once served over HTTPS. |
| `TRUSTED_PROXY` | no | – | web | `true` behind a proxy that sets `X-Forwarded-*`. |
| `LDAP_*`, `GOOGLE_*`, `APPLE_*` | no | – | api | As in the API table; empty = off. |
| `SEED_SUPERADMIN_*` | no | – | migrate | For `run --rm migrate bun run db:seed`. |

Random values: `openssl rand -hex 32` (hex needs no URL-encoding inside the database URLs and holds no `$`, which compose
would read as a variable); `DATA_ENCRYPTION_KEY` is `openssl rand -base64 32`.

## Deploy with compose

`docker-compose.yml` runs the stack as it runs in production: PostgreSQL 18, a one-shot `migrate` service, the API
(reachable only inside the compose network, no published port) and the web on http://localhost:3001.

```sh
cp .env.compose.example .env.compose        # replace every change-me, fill every empty secret
docker compose --env-file .env.compose up -d --build
docker compose --env-file .env.compose run --rm migrate bun run db:seed   # first Superadmin (SEED_SUPERADMIN_*)
docker compose --env-file .env.compose down                               # `down -v` also drops the database volume
```

- Every compose command needs `--env-file .env.compose`: values are interpolated into each service's own
  `environment:` allow-list, so a service sees only the keys it names (the API never holds the schema owner's URL or the
  session secret; the web never holds a database URL or the encryption key). A required key that is unset or empty
  stops compose.
- Two database roles: `migrate` connects as the schema owner and exits after applying pending migrations; the API starts
  after it (`service_completed_successfully`) and connects as `starterkit_app`, which may SELECT, INSERT, UPDATE and
  DELETE on the tables and nothing else. `scripts/compose-app-role.sh` creates that role when the volume is new; on a
  database you run yourself, run the same as the schema owner before the first migration:

  ```sql
  create role starterkit_app login password '…';
  grant usage on schema public to starterkit_app;
  alter default privileges in schema public grant select, insert, update, delete on tables to starterkit_app;
  ```

  Tables that already exist need `grant select, insert, update, delete on all tables in schema public to starterkit_app;`.
- Images: `apps/api/Dockerfile` (`oven/bun:1.4.3`, user `bun`, `HEALTHCHECK` on `/healthz`) and `apps/web/Dockerfile`
  (built with Bun on `node:24-slim`, Next standalone, user `node`, `HEALTHCHECK` on `/login`). Neither image carries
  tests or env files (`.dockerignore`).
- The API answers `SIGTERM` by stopping the janitor and waiting up to 10 s for requests in flight before it closes the
  pool. `/healthz` (process up) and `/readyz` (database answers within 2 s, else 503) need no token.
- TLS ends in front of the web (a proxy or load balancer); then set `COOKIE_SECURE=true`, and `TRUSTED_PROXY=true` when
  that proxy sets `X-Forwarded-*`.
- CI (`.github/workflows/ci.yml`): gitleaks, `bun run check`, E2E on a production build and the bundle budget, on every
  push and pull request, with a PostgreSQL 18 service. The repository has no remote yet, so it has never run on GitHub.

## Operations

- **Janitor.** Every API process runs it at start and every 5 minutes; `pg_try_advisory_lock` lets one instance work at a
  time. It deletes ended sessions (expired or idle), expired 2FA challenges, reset/invitation links and OAuth states,
  rate-limit rows older than an hour, backoff rows quiet for 15 minutes, and audit entries past retention, and logs the
  count per table (`apps/api/src/db/janitor.ts`).
- **Audit retention.** `activity` and `auth_log` are append-only (a trigger refuses UPDATE). Entries older than
  `AUDIT_RETENTION_DAYS` (default 365) are deleted 10,000 rows per table per run (at most 2.88 M a day), so lowering the
  retention on a large log drains over several runs. Copy them elsewhere first if you must keep them longer.
- **Backups.** Nothing here backs up the database. Run `pg_dump` (or your platform's snapshots) on a cadence you choose;
  that choice is the operator's. The rate-limit tables are UNLOGGED and come back empty after a crash, by design.
- **Key rotation.** `INTERNAL_API_TOKEN` and `SESSION_SECRET` change by restarting both apps with the new value
  (a new `SESSION_SECRET` signs everyone out). `DATA_ENCRYPTION_KEY` can't be rotated yet: a new key makes every stored
  TOTP secret unreadable, so two-factor users can't sign in. The ciphertext is versioned (`v1:` prefix,
  `apps/api/src/kernel/crypto.ts`), so a second key version can be added without changing the stored format.
- **Logs.** Both apps log JSON to stdout with the same redaction (`packages/shared/src/log-redact.ts`); each API request
  writes one access line (method, route pattern, status, ms, request id; never the query). A failed query logs its
  SQLSTATE, constraint and table, never the SQL or its values.
- **Limits.** Sign-in, forgot-password, re-authentication and OAuth-start limits are shared through PostgreSQL by every
  API process (numbers in [`docs/api/README.md`](docs/api/README.md)); move them to Redis only if they become a
  bottleneck.

## Sign-in methods

### Google and Apple

A provider is on when all of its keys are set (`GOOGLE_*`, `APPLE_*` in `apps/api/.env`); otherwise its button says it
isn't set up. Register these redirect URIs with the provider, `APP_URL` being the web's public origin:

```
<APP_URL>/api/auth/oauth/google/callback
<APP_URL>/api/auth/oauth/apple/callback
```

- Google: an OAuth client of type "Web application"; `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Apple: a Services ID (`APPLE_CLIENT_ID`), your Team ID, and a Sign in with Apple key (`APPLE_KEY_ID`, its `.p8` in
  `APPLE_PRIVATE_KEY`). Apple posts its answer to the callback (`form_post`), so over HTTPS the binding cookie is
  `SameSite=None; Secure`.
- Only an identity already connected signs in: a user connects Google or Apple on `/me/security` while signed in. No
  account is created and none is matched by email.
- Development and E2E use the mock (`OAUTH_MOCK=true` in both apps): the same redirects, state and binding checks, with a
  fake authorize step that approves at once. The API refuses it in production; the web refuses it in production over HTTPS (`COOKIE_SECURE=true`).

### LDAP

Set `LDAP_URL`, `LDAP_BASE_DN` and usually `LDAP_BIND_DN`/`LDAP_BIND_PASSWORD`. A user marked LDAP signs in by choosing
LDAP on the sign-in page: the API searches `LDAP_BASE_DN` with `LDAP_USER_FILTER` (exactly one entry must match), then
binds as that entry with the typed password; 5 s in all. Production needs `ldaps://` or `LDAP_STARTTLS=true`.

Every LDAP sign-in queries the directory, also for a login that isn't an LDAP user of the app, so the answer takes the
same time either way and doesn't reveal which accounts exist. The cost: a directory account that isn't an app user can
see failed binds, and a directory with an account-lockout policy may lock it. The sign-in rate limits (5 per minute per
username, then backoff) bound how fast that can happen.

### Email (SMTP)

Production requires `MAIL_TRANSPORT=smtp` with TLS: `smtps://…:465` (TLS from the first byte) or
`smtp://…:587?requireTLS=true` (STARTTLS; the send fails when the server doesn't offer it). Plain `smtp://` would send
reset links in clear text whenever STARTTLS is missing, so production refuses it. Mail goes out after the change
commits and never delays the answer; a failure is logged with the masked address and the error code. There is no
outbox: a failed mail is not retried.

## Known limits

- Responsive behaviour is tested on Chromium emulation only (desktop, tablet and phone viewports): no WebKit project and
  no real iPhone or iPad (Safari's keyboard over fixed layers, real safe-area insets).
- Real Google, Apple and LDAP sign-in are tested against fakes only (token endpoint, JWKS, directory); a run against the
  real providers needs real credentials.
- The compose stack and the images have not been run end to end: the Docker daemon was off while they were built. Their
  parts were checked by hand (`docker compose config`, the image layouts rebuilt and started outside Docker).
- The API image carries about 289 MB of `node_modules` (measured on a hand-built copy), mostly `@starterkit/ui`'s
  runtime dependencies that come with the workspace; a `bun build` bundle is the upgrade path (`apps/api/Dockerfile`).
- `DATA_ENCRYPTION_KEY` can't be rotated yet (see Operations).

## Standards

- [`AGENTS.md`](AGENTS.md): the working rules for people and AI agents, each with the test or file that enforces it,
  including how to add a module (§13).
- [`docs/standards/`](docs/standards): UI standard, design system, copy guide.
- [`docs/api/README.md`](docs/api/README.md): the API contract.
- [`docs/superpowers/specs/`](docs/superpowers/specs): the design specs of each phase (front end, backend, responsive).
