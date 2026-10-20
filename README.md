# Starterkit

Template for internal web apps: a Next.js 16 app with sign-in (password, two-factor, Google/Apple, LDAP), roles and
permissions, user management, an activity log and a sign-in log, and a design system, backed by an API on Bun and
PostgreSQL (`apps/api`). A new project copies this repository and changes it; nothing here is published as a library.

## Run it

Needs Bun 1.4.3, Node 24 and a PostgreSQL server.

```sh
bun install
DATABASE_URL='postgresql://user:password@localhost:5432/starterkit' bun run setup   # once: env files, database, seeds
bun run dev                # web http://localhost:3000 and API http://127.0.0.1:4000 together
```

Sign in with an account below (`bun run setup` seeds them; `bun run db:reset` brings the seed data back). Without
`SESSION_SECRET` every restart of the web signs everyone out (development picks a random secret per process).

## Seed accounts

Every account signs in with its email or its username. Password: `Password123!`, except the LDAP account.

| Email | Role | Notes |
|---|---|---|
| `superadmin@example.com` | Superadmin | Every permission; the role is locked. |
| `admin@example.com` | Admin | Everything except roles and permissions. |
| `viewer@example.com` | Viewer | `user.view` and `audit.view` only: no Roles or Permissions in the menu. |
| `twofa@example.com` | Admin | Two-factor on. TOTP secret `JBSWY3DPEHPK3PXP` (add it to an authenticator app). Recovery codes, each works once: `aaaa-1111`, `bbbb-2222`, `cccc-3333`, `dddd-4444`, `eeee-5555`, `ffff-6666`, `gggg-7777`, `hhhh-8888`. |
| `inactive@example.com` | Viewer | Inactive: sign-in says the account is inactive. |
| `ldap@example.com` | Viewer | LDAP account: choose LDAP on the sign-in page, directory password `LdapPass123!`. |
| `google@example.com` | Viewer | Connected to Google: "Continue with Google" signs in as this user. |
| `apple@example.com` | Viewer | Connected to Apple: "Continue with Apple" signs in as this user. |

The other 42 users (`<name>.<n>@example.com`) are generated with the same password, about 20 % Admin and 10 % inactive.

In development (`OAUTH_MOCK=true` in `apps/api/.env` and `apps/web/.env.local`, `LDAP_MOCK` and `MAIL_TRANSPORT=log`
in `apps/api/.env`):

- Google and Apple sign-in is mocked: the same redirects and state checks as a real provider, with a fake authorize
  step that approves at once; like a real provider sign-in, it skips the two-factor step. Without the mock and without
  a provider's keys (`GOOGLE_*`, `APPLE_*` in `apps/api/.env.example`), its button says it isn't set up.
- "Forgot password?" and "Send an invitation link" send no email: the API logs the mail.
- An LDAP user created in the UI has no entry in the mock directory, so it can't sign in; only `ldap@example.com` can.
- These credentials exist only in the demo seed (`apps/api/src/db/seed/demo.ts`). Never reuse them.

## Configuration

Server environment only; there is no `NEXT_PUBLIC_*` setting.

| Variable | Default | Meaning |
|---|---|---|
| `SESSION_SECRET` | random per process (development) | Seals the session cookie; at least 32 characters; required in production. |
| `SESSION_TTL_HOURS` | `12` | Cookie lifetime, 1 to 24 hours (the API ends sessions by its own `SESSION_TTL_HOURS` and `SESSION_IDLE_MINUTES`). |
| `API_BASE_URL` | `http://127.0.0.1:4000` (development) | The API; required in production. |
| `INTERNAL_API_TOKEN` | none | Shared with the API (`apps/api/.env`), at least 32 characters; required. |
| `COOKIE_SECURE` | `false` | `true` behind HTTPS: `Secure` cookie and `Strict-Transport-Security`. |
| `TRUSTED_PROXY` | `false` | `true` only behind a proxy that appends `X-Forwarded-For` and sets `X-Forwarded-Host`/`-Proto`; otherwise those headers are ignored. |
| `LOG_LEVEL` | `info` | pino log level. |
| `OAUTH_MOCK` | `false` | `true` serves the fake Google/Apple authorize step (the API needs `OAUTH_MOCK=true` too); development and E2E only, refused with `NODE_ENV=production` and `COOKIE_SECURE=true`. |

## Repository

```
apps/web/                 Next.js 16 App Router app
  src/app/                pages; (auth) sign-in screens, (main) the signed-in shell; api/ the catch-all to the API and the auth routes
  src/features/<domain>/  screens per domain (users, rbac, audit, me, auth, dashboard, ds); never import each other
  src/components/         shell and shared app components
  src/lib/shared/         pure web-only code: nav, table state, queries (contracts and permissions: packages/shared)
  src/lib/server/         session cookie, CSRF, page guard, prefetch, API client (backend.ts), logger
  src/lib/client/         API client, auth context, table query hook
  tests/e2e/              Playwright specs
  scripts/                bundle-budget.mjs, emit-api-schemas.ts
packages/ui/src/          design system, source only: tokens and styles, ui primitives, motion, ds components, charts
docs/standards/           UI standard, design system, copy guide
docs/api/                 API contract for the backend: endpoint table and JSON Schemas
```

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Development servers for `apps/web` (:3000) and `apps/api` (:4000) together. |
| `bun run setup` | Env files, database, migrations and seeds for the API (see Backend setup). |
| `bun run db:migrate` | Applies pending `apps/api/drizzle/*.sql` (made by `bunx drizzle-kit generate` in `apps/api` from each module's `schema.ts`, plus custom SQL). |
| `bun run check` | Typecheck, lint (no warnings allowed) and unit tests. Must pass before every commit. |
| `bun run test:changed` | Unit tests touched by the files changed since the last commit. |
| `bun run build` | Production build of `apps/web`. |
| `bun run budget` | First-load JS per route after a build: at most 250 kB gzip each (`NEXT_DIST_DIR=.next-e2e` reads the E2E build). |
| `bun run e2e` | Resets and seeds the `<database>_e2e` database, starts the API on port 4123 and a production build of the web (in `apps/web/.next-e2e`) on port 3123, then runs the Playwright specs (sign-in, permissions, accessibility, motion, no flicker, `/ds` screenshots). `E2E_DATABASE_URL` picks another database (its name must end in `_e2e`); `E2E_REUSE=1` reuses servers already on `E2E_PORT` and `E2E_API_PORT`; artifacts go to `.superpowers/scratch/`. |
| `bun run api:schemas` | Regenerates `docs/api/schemas/` from the zod contracts. |

Playwright uses the Chromium it already has. `/ds` screenshot baselines are per platform: the file name ends in the
platform (`ds-light-darwin.png`), so a Linux CI runner looks for `ds-light-linux.png` and fails until it has its own.
Make them on that platform (for CI: in the same Linux image the runner uses) with
`bunx playwright test ds --update-snapshots` inside `apps/web`, review them by eye, and commit them next to the others.

## Standards

- [`AGENTS.md`](AGENTS.md): the working rules for people and AI agents, each with the test or file that enforces it.
- [`docs/standards/`](docs/standards): UI standard, design system, copy guide.
- [`docs/superpowers/specs/2026-10-19-fe-starterkit-design.md`](docs/superpowers/specs/2026-10-19-fe-starterkit-design.md): the design spec.

## Backend setup

The API (`apps/api`, Bun + Elysia + Drizzle on PostgreSQL); the web forwards every `/api/x` call to it at `/v1/x`.
It is a modular monolith: `src/kernel/` (config, db, errors, plugins), `src/modules/<module>/` (`index.ts` public API,
`controller.ts` routes, `service.ts` logic on Drizzle, `schema.ts` tables, `rules.ts` pure rules, `tests/`) mounted by
the registry `src/modules/index.ts`, and `src/db/` (migration runner, seeds).
With a local PostgreSQL server:

```sh
DATABASE_URL='postgresql://user:password@localhost:5432/starterkit' bun run setup
bun run --filter @starterkit/api dev    # http://127.0.0.1:4000/healthz
cd apps/api && bun test                 # uses <database>_test, created and migrated on first run
```

`setup` writes `apps/api/.env` (random `INTERNAL_API_TOKEN` and `DATA_ENCRYPTION_KEY`) and `apps/web/.env.local`
(`API_BASE_URL`, the same `INTERNAL_API_TOKEN`, `SESSION_SECRET`) only when they are missing, creates the database,
and migrates. `--database-url <url>` works too, but `bun run` echoes the command line, password included.
`SEED_SUPERADMIN_NAME/EMAIL/USERNAME/PASSWORD` set in the environment go into `apps/api/.env`. Every API setting:
`apps/api/.env.example`. Both env files are gitignored.

## Backend phase

The next phase adds a backend (Bun and PostgreSQL) in place of the mock store. The browser keeps calling only the
Next server's `/api/*`; route handlers then forward to the backend at `API_BASE_URL` (server environment only), and
session, CSRF and permission checks stay in Next. The backend must answer the contract in
[`docs/api/README.md`](docs/api/README.md): every endpoint, its permission, request and answer schemas
(`docs/api/schemas/`), error codes, paging rules and the CSRF and same-origin rules.
