# Starterkit

Template for internal web apps: a Next.js 16 app with sign-in (password, two-factor, Google/Apple, LDAP), roles and
permissions, user management, an activity log and a sign-in log, and a design system, all running on an in-memory
mock API. A new project copies this repository and changes it; nothing here is published as a library.

## Run it

Needs Bun 1.4.3 and Node 24.

```sh
bun install
bun run dev                # http://localhost:3000
PORT=3200 bun run dev      # any other port
```

Sign in with an account below. The mock store lives in server memory: a restart brings back the seed data, and
without `SESSION_SECRET` every restart also signs everyone out (development picks a random secret per process).

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

How the mock behaves:

- Google and Apple sign-in is mocked: no provider round trip, and it skips the two-factor step.
- "Forgot password?" and "Send an invitation link" send no email: the link appears in the server log
  (`mock email: password reset link` / `mock email: invitation link`).
- An LDAP user created in the UI has no entry in the mock directory, so it can't sign in; only `ldap@example.com` can.
- These credentials exist only in the mock seed (`apps/web/src/lib/server/mock/seed.ts`). Never reuse them.

## Configuration

Server environment only; there is no `NEXT_PUBLIC_*` setting.

| Variable | Default | Meaning |
|---|---|---|
| `SESSION_SECRET` | random per process (development) | Seals the session cookie; at least 32 characters; required in production. |
| `SESSION_TTL_HOURS` | `12` | Session lifetime, 1 to 24 hours. |
| `SESSION_IDLE_MINUTES` | `120` | A session with no request for this long ends, 5 to 1440 minutes. |
| `COOKIE_SECURE` | `false` | `true` behind HTTPS: `Secure` cookie and `Strict-Transport-Security`. |
| `TRUSTED_PROXY` | `false` | `true` only behind a proxy that appends `X-Forwarded-For` and sets `X-Forwarded-Host`/`-Proto`; otherwise those headers are ignored. |
| `LOG_LEVEL` | `info` | pino log level. |

## Repository

```
apps/web/                 Next.js 16 App Router app
  src/app/                pages; (auth) sign-in screens, (main) the signed-in shell; api/ the mock route handlers
  src/features/<domain>/  screens per domain (users, rbac, audit, me, auth, dashboard, ds); never import each other
  src/components/         shell and shared app components
  src/lib/shared/         pure code shared by browser and server: zod contracts, permissions, nav, table state
  src/lib/server/         session, CSRF, guards, rate limits, logger, mock store
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
| `bun run dev` | Development server for `apps/web`. |
| `bun run check` | Typecheck, lint (no warnings allowed) and unit tests. Must pass before every commit. |
| `bun run test:changed` | Unit tests touched by the files changed since the last commit. |
| `bun run build` | Production build of `apps/web`. |
| `bun run budget` | First-load JS per route after a build: at most 250 kB gzip each. |
| `bun run e2e` | Builds and starts the app on port 3123, then runs the Playwright specs (sign-in, permissions, accessibility, motion, no flicker, `/ds` screenshots). `E2E_REUSE=1` reuses a server already on `E2E_PORT`; artifacts go to `.superpowers/scratch/`. |
| `bun run api:schemas` | Regenerates `docs/api/schemas/` from the zod contracts. |

Playwright uses the Chromium it already has; `/ds` screenshot baselines are per platform (`*-darwin.png`); make them
on a new platform with `bunx playwright test ds --update-snapshots` inside `apps/web` and review them.

## Standards

- [`AGENTS.md`](AGENTS.md): the working rules for people and AI agents, each with the test or file that enforces it.
- [`docs/standards/`](docs/standards): UI standard, design system, copy guide.
- [`docs/superpowers/specs/2026-10-19-fe-starterkit-design.md`](docs/superpowers/specs/2026-10-19-fe-starterkit-design.md): the design spec.

## Backend phase

The next phase adds a backend (Bun and PostgreSQL) in place of the mock store. The browser keeps calling only the
Next server's `/api/*`; route handlers then forward to the backend at `API_BASE_URL` (server environment only), and
session, CSRF and permission checks stay in Next. The backend must answer the contract in
[`docs/api/README.md`](docs/api/README.md): every endpoint, its permission, request and answer schemas
(`docs/api/schemas/`), error codes, paging rules and the CSRF and same-origin rules.
