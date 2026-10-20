# Backend Bun + PostgreSQL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FE phase's in-memory mock API with a production-grade Bun + PostgreSQL backend (`apps/api`), turn `apps/web` into a BFF that forwards `/api/*` to it, and delete the mock.

**Architecture:** `browser → apps/web (Next, /api/*: cookie, CSRF, same-origin) → apps/api (Bun + Hono, /v1/*: sessions, RBAC, domain rules) → PostgreSQL (Bun.sql, plain SQL migrations)`. Contracts (zod) move to `packages/shared` and are used by both apps. The mock (`apps/web/src/lib/server/**` domain code + its route tests) is the behavioral reference: every rule it enforces and every test it has is ported to the API.

**Tech Stack:** Bun 1.4.3, Hono 4.13.13, Bun.sql (built-in PostgreSQL client), PostgreSQL 18, zod 4.6.5, pino 10.3.1, arctic 3.7.0, jose 6.2.12, ldapts 9.2.0, nodemailer 10.1.7; Next.js 16.3.8 (web, unchanged), vitest 5.0.3 (web/shared), `bun test` (api), Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-10-20-be-bun-postgres-design.md`. Also binding: `AGENTS.md` (repo rules), `docs/api/README.md` (the API contract, every rule in it), `docs/superpowers/specs/2026-10-19-fe-starterkit-design.md` (FE standards that stay absolute).

## Global Constraints

- Repo: `/Users/riuzaki/Private Space/Sunny Go/PROJECT-APPS/project-starterkit-monorepo`, branch `feat/be-bun-postgres`. Never touch `PROJECT-APPS/bilik-studio` or `PROJECT-APPS/starterkit-laravel`.
- Pin every dependency exactly (no `^`/`~`): hono `4.13.13`, arctic `3.7.0`, jose `6.2.12`, ldapts `9.2.0`, nodemailer `10.1.7`, `@types/nodemailer` `8.0.2`, `@types/bun` `1.4.3`, pino `10.3.1`, zod `4.6.5`, typescript `6.0.3`. Add nothing else without a ledger ruling.
- Secrets: the owner's DB URL (`postgresql://postgres:<password>@localhost:5432/project-starterkit-monorepo`) and seeder credentials (name `Farhan Riuzaki`, email `riuzakif@gmail.com`, username `riuzaki`, password `<password>`) go only into gitignored env files (`apps/api/.env`); `.env.example` files carry placeholders. `.gitignore` already ignores `.env*` except `.env.example`. gitleaks must stay clean.
- Databases (local only; destructive ops allowed only on these): dev `project-starterkit-monorepo`, unit tests `project-starterkit-monorepo_test`, E2E `project-starterkit-monorepo_e2e`. Server `postgresql://postgres:<password>@localhost:5432/`.
- Ports: never use or kill `:3000` (owner's dev server). API dev `4000`; E2E web `3123`, E2E API `4123`.
- Do not run `playwright install`. Browser/test artifacts only under `.superpowers/scratch/`.
- Contract is frozen: error codes, statuses, messages, DTO shapes, query rules and the check order from `docs/api/README.md` (parse query → session → CSRF → permission → parse body → 404 → rules (actor rank first) → change → activity entry). A task changes a contract only where this plan says so.
- API paths mirror web paths: `/api/<x>` ↔ `/v1/<x>`.
- Style: match the existing `apps/web/src/lib/server` style (one-line JSDoc on exports, `ponytail:` comments on deliberate ceilings, no single-use abstractions). SQL: parameters only; identifiers and sort columns from whitelists only.
- Tests: while working run only related tests (`bun test <path>` in `apps/api`, `bunx vitest related <files>` in web/shared); run `bun run check` (root) before the task's final commit. Every task ends green.
- Commit messages: conventional (`feat(api): …`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Two admins at once demoting/deactivating/deleting the last two active Superadmins: exactly one succeeds, the other gets 409 `last_superadmin` (Task 6 test "concurrent last superadmin").
- A path id that is not a UUID (`/v1/users/abc`, `/v1/roles/1`) answers 404 `not_found`, never 500 from PostgreSQL's uuid cast (Task 3 `idParam` test, used by every `{id}` route).
- PostgreSQL down or slow: `/readyz` 503, routes answer 500 `internal` with the fixed message, the thrown text never reaches the body or the log line's `message` unredacted (Task 2 test "db down").
- Deep pages and big tables: `page=1000&pageSize=100` on a 200k-row `activity` answers within the statement timeout with `totalCapped: true` (Task 8 test "capped count on 200k rows").
- Timing and enumeration: unknown login and wrong password take the same path (dummy argon2 verify); `forgot` answers identically and sends nothing for unknown/throttled emails (Task 4 tests).

---

### Task 1: `@starterkit/shared` package

Move the code both apps need out of `apps/web` into a source-only workspace package.

**Files:**
- Create: `packages/shared/{package.json,tsconfig.json,vitest.config.ts}`
- Move (git mv, tests move with their module): `apps/web/src/lib/shared/contracts/*` → `packages/shared/src/contracts/*`; `apps/web/src/lib/shared/{paging,permissions,audit}.ts` (+ tests) → `packages/shared/src/`; any other `lib/shared` file the moved files import.
- Create: `packages/shared/src/log-redact.ts` — the pure parts of `apps/web/src/lib/server/logger.ts` (redact key list, `maskText`, the pino `redact` paths / formatters config). `logger.ts` imports them.
- Modify: every importer in `apps/web` (≈76 files) to `@starterkit/shared/<path>`; `apps/web/package.json` (+`"@starterkit/shared": "workspace:*"`), `apps/web/next.config.ts` (`transpilePackages`), `apps/web/scripts/emit-api-schemas.ts`, `apps/web/src/test/*.test.ts` scans that name `lib/shared` paths, `AGENTS.md` path mentions, root `package.json` (nothing else).

**Interfaces:**
- Produces: `@starterkit/shared/contracts/{common,auth,users,rbac,me,audit,dashboard}`, `@starterkit/shared/{paging,permissions,audit,log-redact}`. `package.json`: `"name": "@starterkit/shared"`, `"type": "module"`, `"exports": { "./*": "./src/*.ts" }`, scripts `typecheck`, `test` (vitest), `test:changed`.

- [ ] **Step 1:** Create the package and `git mv` the files; fix relative imports inside the package (they stay relative).
- [ ] **Step 2:** Rewrite web imports (`@/lib/shared/contracts/x` → `@starterkit/shared/contracts/x`, same for `paging`, `permissions`, `audit`). Files that stay in `apps/web/src/lib/shared` (nav, queries, table-state, brand, prefs, shortcuts, user-status if web-only) keep `@/lib/shared`.
- [ ] **Step 3:** Extend the purity rule: `packages/shared/src/**` imports no React, Next, `apps/**`, `@/`; the only workspace import allowed is `@starterkit/ui/lib/*`. Add the case to `apps/web/src/test/architecture.test.ts` with a fixture proving it fails on a violation. `no-domain.test.ts` scans `packages/shared` too.
- [ ] **Step 4:** `bun run api:schemas` → `git diff --exit-code docs/api` (no drift). `bun run check` green (shared tests now counted under `@starterkit/shared`).
- [ ] **Step 5:** Commit `refactor(shared): contracts, permissions and audit vocabulary in @starterkit/shared`.

### Task 2: API foundation — app, config, logging, database, migrations, test harness

**Files:**
- Create: `apps/api/{package.json,tsconfig.json,.env.example,bunfig.toml}`; `apps/api/src/{index.ts,app.ts,config.ts,log.ts}`; `apps/api/src/http/{errors.ts,middleware.ts}`; `apps/api/src/db/{client.ts,migrate.ts}`; `apps/api/migrations/0001_init.sql`; `apps/api/test/{preload.ts,db.ts}`; `scripts/setup.ts` (root); tests `apps/api/src/{config,app,db/migrate}.test.ts`.
- Modify: root `package.json` scripts: `dev` runs web and api together (`bun run --filter '@starterkit/web' --filter '@starterkit/api' dev`), add `setup`, `db:migrate`, `db:seed`, `db:seed:demo`, `db:reset` (forward to the api package); `eslint.config.mjs` covers `apps/api`; `README.md` gets a short "Backend setup" stub (Task 13 finishes docs).

**Interfaces:**
- `config.ts`: `loadConfig(env: Record<string,string|undefined>): Config` (pure, zod) and `config(): Config` (cached). Keys and defaults: `NODE_ENV` development|test|production (development); `API_HOST` (127.0.0.1); `API_PORT` (4000); `DATABASE_URL` (required); `MIGRATION_DATABASE_URL` (defaults to `DATABASE_URL`); `DB_POOL_MAX` 1–100 (10); `INTERNAL_API_TOKEN` (required, ≥ 32 chars); `DATA_ENCRYPTION_KEY` (required, base64 of exactly 32 bytes); `SESSION_TTL_HOURS` 1–24 (12); `SESSION_IDLE_MINUTES` 5–1440 (120); `APP_URL` (http://localhost:3000; links in emails); `MAIL_TRANSPORT` log|smtp (log; production requires smtp); `SMTP_URL`, `MAIL_FROM` (required when smtp); `AUDIT_RETENTION_DAYS` 30–3650 (365); `LOG_LEVEL` (info); `OAUTH_MOCK`, `LDAP_MOCK` "true"|"false" (false; `true` in production is a startup error). A missing/invalid value throws one error naming every bad key and nothing of its value.
- `log.ts`: `log` (pino, JSON, `@starterkit/shared/log-redact` config), `childLog(bindings)`.
- `http/errors.ts`: `class ApiError extends Error { code: ErrorCode; status: number; headers?: Record<string,string> }` with `new ApiError(code, message?, headers?)` (status from `ERROR_STATUS`, message defaults to the fixed copy for that code — port `PROTECTED`, `badRequest`, `notFound(noun)`, `currentSession`, `crossSite`, `tooManyAttempts` texts from `apps/web/src/lib/server/api.ts`); `errorBody(code, message)`; `onError(err, c): Response` — `$ZodError` → 400 `bad_request`, `ApiError` → its status/code/message/headers, anything else → logged (`err.name`, redacted message) and 500 `internal` with the fixed copy. Every response has `Cache-Control: no-store`.
- `http/middleware.ts`: `requestContext` (reads `X-Request-Id` or makes a UUIDv7; `X-Client-Ip`/`X-Client-Ua` → `c.var.client = { ip, ua }`, defaults `"unknown"`/`""`), `internalAuth` (constant-time compare of `X-Internal-Token` with `INTERNAL_API_TOKEN`; else 401 `unauthenticated`; mounted on `/v1/*`), body limit 64 KB (`hono/body-limit` → 400 `bad_request`), access log line per request (method, route, status, ms, requestId; never query values).
- `app.ts`: `createApp(deps?: { db?: SQL }): Hono` (tests inject a db; default `sql`) mounting middleware, `GET /healthz` → `{ ok: true }`, `GET /readyz` → `{ ok: true }` or 503 `{ ok: false }` when `select 1` fails within 2 s, and the module routers (added by later tasks via `app.route("/v1", …)`), `onError`, `notFound` → 404 `not_found` (noun "page").
- `index.ts`: `Bun.serve({ hostname, port, fetch: app.fetch })`; SIGTERM/SIGINT → stop accepting, wait for in-flight requests up to 10 s, `sql.close()`, exit 0.
- `db/client.ts`: `sql` — `new SQL(config().DATABASE_URL, { max: DB_POOL_MAX })` with `statement_timeout=5000` and `idle_in_transaction_session_timeout=10000` set per connection (connection options or `onconnect`); `type Tx` = the transaction handle type of `sql.begin`; `migrationSql()` for `MIGRATION_DATABASE_URL`.
- `db/migrate.ts`: `migrate(db = migrationSql(), dir = <apps/api/migrations>): Promise<string[]>` — `pg_advisory_lock(<fixed bigint>)`, table `schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now())`, applies pending files in name order, each in its own transaction; an applied file whose SHA-256 changed → throws `migration <name> changed after it was applied`. CLI entry when run directly.
- `migrations/0001_init.sql` — the whole schema (extensions `pg_trgm`, `citext` not used; case-insensitivity via `lower()` unique indexes):
  - `users(id uuid pk, name text, username text, email text, avatar_url text null, is_active bool, is_ldap bool, password_hash text null, totp_secret text null /* encrypted */, pending_totp_secret text null /* encrypted */, totp_last_step bigint null, last_login_at timestamptz null, created_at timestamptz default now(), updated_at timestamptz default now())`; unique `lower(username)`, unique `lower(email)`; GIN trigram on `name`, `username`, `email`; btree `created_at`.
  - `roles(id uuid pk, name text, locked bool default false, created_at)`; unique `lower(name)`.
  - `permissions(name text pk, position int not null)` (catalog order).
  - `role_permissions(role_id → roles on delete cascade, permission text → permissions, pk(role_id, permission))`.
  - `user_roles(user_id → users on delete cascade, role_id → roles on delete restrict, pk(user_id, role_id))`, index `role_id`.
  - `recovery_codes(id uuid pk, user_id → users cascade, code_hash text, used_at timestamptz null)`.
  - `user_identities(user_id → users cascade, provider text check in ('google','apple'), subject text, email text null, created_at, pk(provider, subject), unique(user_id, provider))`.
  - `sessions(id uuid pk, token_hash bytea unique, user_id → users cascade, method text, device text, ip text, created_at, last_seen_at, expires_at)`, index `user_id`, `expires_at`.
  - `auth_challenges(id uuid pk, token_hash bytea unique, user_id → users cascade, method text, next text null, created_at, expires_at)`.
  - `user_tokens(token_hash bytea pk, user_id → users cascade, kind text check in ('reset','invite'), expires_at)`, unique `user_id` (one live link per user).
  - `oauth_states(state_hash bytea pk, provider text, mode text check in ('login','link'), user_id uuid null, binding_hash bytea, code_verifier text, nonce text, next text null, expires_at)`.
  - `activity(id uuid pk, at timestamptz default now(), actor_id uuid null, actor_name text, action text, target_type text, target_id text, target_label text, before jsonb null, after jsonb null)`; indexes `(at desc, id desc)`, `(target_id, at desc)`, `(actor_id)`, `(action, at desc)`.
  - `auth_log(id uuid pk, at timestamptz default now(), event text, login text, user_id uuid null, method text, ip text, device text)`; indexes `(at desc, id desc)`, `(user_id, at desc)`, `(event, at desc)`.
  - `rate_limits(key text pk, count int, window_start timestamptz)` UNLOGGED; `login_backoff(key text pk, failures int, blocked_until timestamptz null, last_failure_at timestamptz)` UNLOGGED.
  - Trigger on `activity` and `auth_log`: `BEFORE UPDATE … RAISE EXCEPTION 'audit rows are append-only'`.
  - Column names, nullability and checks beyond this list: derive from `UserDto`/`UserRecord` (`apps/web/src/lib/server/mock/db.ts`) and the DTOs in `@starterkit/shared/contracts/*`.
- `test/preload.ts` (bunfig `[test] preload`): sets test env (`NODE_ENV=test`, `DATABASE_URL` = the `_test` database, fixed `INTERNAL_API_TOKEN`/`DATA_ENCRYPTION_KEY` test values, `OAUTH_MOCK=true`, `LDAP_MOCK=true`, `MAIL_TRANSPORT=log`), creates the database if missing (connect to `postgres` db, `CREATE DATABASE`), runs `migrate()` once. `test/db.ts`: `truncateAll()` (every table except `schema_migrations`, `RESTART IDENTITY CASCADE`).
- `scripts/setup.ts`: `bun run setup [--database-url <url>]` — writes `apps/api/.env` and `apps/web/.env.local` only when missing (random `INTERNAL_API_TOKEN` shared by both, random `DATA_ENCRYPTION_KEY`, web `SESSION_SECRET`, `API_BASE_URL=http://127.0.0.1:4000`, `DATABASE_URL` from the flag or `DATABASE_URL` env, `SEED_SUPERADMIN_*` placeholders that the owner fills), creates the database if missing, then `db:migrate`, `db:seed`, `db:seed:demo`. Never prints secrets. For this repo, write the owner's values (Global Constraints) into `apps/api/.env` by running setup with them; never commit it.

- [ ] **Step 1: Failing tests** — `config.test.ts`: "rejects a missing DATABASE_URL and names the key only", "rejects a short INTERNAL_API_TOKEN", "rejects a DATA_ENCRYPTION_KEY that is not 32 bytes", "refuses OAUTH_MOCK=true in production", "production requires smtp". `app.test.ts` (via `createApp().request()`): "healthz needs no token", "a /v1 request without X-Internal-Token is 401 unauthenticated", "a wrong token of the same length is 401", "unknown /v1 path is 404 not_found with no-store", "a thrown Error answers 500 internal with the fixed message and never its text" (mount a throwing test route), "a body over 64 KB is 400 bad_request", "db down: readyz 503" (point a fresh `SQL` at a closed port). `db/migrate.test.ts`: "applies 0001 once; a second run applies nothing", "a changed applied file throws", "two concurrent migrate() calls apply each file once".
- [ ] **Step 2:** Run `cd apps/api && bun test` → fails.
- [ ] **Step 3:** Implement the files above.
- [ ] **Step 4:** `bun test` green; `bun run setup` against the owner's dev DB creates env files and migrates (seed scripts arrive in Task 3: setup must skip seeding with a clear message until they exist, or Task 3 wires it). `curl -s localhost:4000/healthz` from `bun run --filter @starterkit/api dev` answers `{"ok":true}`.
- [ ] **Step 5:** Root `bun run check` runs api typecheck/lint/tests too; green. Commit `feat(api): Bun + Hono foundation, config, logging, migrations and test harness`.

### Task 3: Crypto, seeds and the request kernel

Everything a route needs before the first module: secrets handling, seeds, sessions, the guard, paging and audit writing.

**Files:**
- Create: `apps/api/src/auth/{crypto.ts,password.ts,totp.ts,sessions.ts,limits.ts}`; `apps/api/src/http/{guard.ts,parse.ts}`; `apps/api/src/db/page.ts`; `apps/api/src/audit/record.ts`; `apps/api/src/mail/mailer.ts`; `apps/api/src/seed/{system.ts,demo.ts,cli.ts}`; `apps/api/test/{app.ts}`; tests next to each module.

**Interfaces:**
- `auth/crypto.ts`: `randomToken(): string` (32 bytes base64url); `hashToken(t: string): Buffer` (SHA-256); `encryptSecret(plain: string): string` / `decryptSecret(enc: string): string` (AES-256-GCM, 12-byte IV, format `v1:<iv b64url>:<tag b64url>:<ct b64url>`, key from `DATA_ENCRYPTION_KEY`; unknown version or bad tag throws); `safeEqual(a: string, b: string): boolean`.
- `auth/password.ts`: `hashPassword(p): Promise<string>` (`Bun.password.hash`, argon2id, memoryCost 19456, timeCost 2); `verifyPassword(p, hash | null): Promise<boolean>` — a null hash verifies against a module-level dummy hash and returns false (same work).
- `auth/totp.ts`: port `apps/web/src/lib/server/totp.ts` and its tests unchanged; add `newRecoveryCodes(): string[]` (8 codes, 80 bits each, base32 lowercase `xxxx-xxxx-xxxx-xxxx`).
- `auth/sessions.ts`: `createSession(tx, { userId, method, client }): Promise<{ id: string; token: string; expiresAt: string }>`; `resolveSession(token: string): Promise<AuthUser | null>` — one query: live session (not past `expires_at`, `last_seen_at` within idle) joined to an active user and the union of their role permissions; an ended record is deleted; touches `last_seen_at` with `UPDATE … WHERE id = $1 AND last_seen_at < now() - interval '60 seconds'`; `endSession(id)`, `endUserSessions(tx, userId, exceptSessionId?)`. `type AuthUser = { user: UserRow; sid: string; perms: Set<PermissionName> }`. `UserRow` = the users row mapped to camelCase plus `roles: string[]` and `connected`.
- `auth/limits.ts`: PostgreSQL-backed ports of `RateLimiter`, `Backoff`, `loginGate`, `forgotLimits`, `passwordFails`, `retryText` from `apps/web/src/lib/server/ratelimit.ts` with the same numbers and semantics (AGENTS.md §3). `hit(key, limit, windowMs): Promise<number | null>` (null = allowed, else retry-after seconds) as one atomic `INSERT … ON CONFLICT … RETURNING`; backoff in `login_backoff`. Concurrent attempts are serialized by the row (the mock's "reserved synchronously" rule).
- `http/guard.ts`: `guard(c, perm: PermissionName | null): Promise<Ctx>` — `Authorization: Bearer <token>` → `resolveSession` (else throws 401 `unauthenticated`) → `perm` held (else 403 `forbidden`). `type Ctx = AuthUser & { client: { ip: string; ua: string }; requestId: string }`. CSRF is Next's job and does not appear here.
- `http/parse.ts`: `query<T>(c, schema: ZodType<T>): T` (from `c.req.queries()`, first value per key, like the web `parse`); `body<T>(c, schema): Promise<T>` (non-JSON or invalid JSON → 400); `idParam(c, name: string, noun: string): string` (not a UUID → throws 404 `not_found` with `notFound(noun)` copy).
- `db/page.ts`: `COUNT_CAP = 100_000`; `pageQuery<R, T>(o: { select: Fragment; from: Fragment; orderBy: Fragment; query: { page: number; pageSize: number }; map: (row: R) => T }): Promise<Page<T>>` — rows with `LIMIT pageSize OFFSET (page-1)*pageSize`, total from `SELECT count(*) FROM (SELECT 1 <from> LIMIT COUNT_CAP + 1)`; `total > COUNT_CAP` → `{ total: COUNT_CAP, totalCapped: true }`; both queries in parallel. `sortSql(sort: string | undefined, columns: Record<string, string>, fallback: string): Fragment` — `columns` maps a contract sort key to a whitelisted SQL expression; always appends `, id <same direction>` as a tie-break. `likeEscape(q: string): string` (escapes `\ % _`).
- `audit/record.ts`: `recordActivity(tx, ctx: Ctx, e: { action: ActivityAction; target: { type; id; label }; before?: unknown; after?: unknown }): Promise<void>` with the masking of `apps/web/src/lib/server/audit.ts` (`HIDDEN`, `SECRET_KEY`); `recordAuth(db, e: Omit<AuthLogDto, "id" | "at">): Promise<void>`. Port `audit.test.ts`.
- `mail/mailer.ts`: `sendMail(m: { to: string; subject: string; text: string }): void` — fire-and-forget after the caller's transaction (call it after `sql.begin` resolves); transport `log` writes one redacted line (`mail` + `to` masked + `subject`) and, when `NODE_ENV=test`, pushes to `sentMail(): Mail[]` / `clearMail()`. `smtp` arrives in Task 11.
- `seed/system.ts`: `seedSystem(db, env): Promise<void>` — idempotent: catalog `PERMISSIONS` in order, roles Superadmin (locked, every permission), Admin (every `user.*` + `audit.view`), Viewer (`user.view`, `audit.view`) — exactly as `apps/web/src/lib/server/mock/seed.ts`; then the superadmin from `SEED_SUPERADMIN_NAME/EMAIL/USERNAME/PASSWORD` when set (created if the email is unknown, given Superadmin; an existing one is left alone). The password policy (`Password`, min 12) applies when `NODE_ENV=production`; elsewhere a shorter one is accepted with one `warn` log line.
- `seed/demo.ts`: `seedDemo(db): Promise<void>` — port of the rest of `mock/seed.ts` (same deterministic generator, same 8 sign-in accounts and passwords, TOTP secret `JBSWY3DPEHPK3PXP` encrypted, recovery codes `aaaa-1111` … `hhhh-8888` hashed, 50 users, 200 activity, 300 sign-in log entries; `google@`/`apple@example.com` linked to subjects `mock-google-demo`/`mock-apple-demo`). One `hashPassword("Password123!")` reused for every demo user. Refuses when `NODE_ENV=production`.
- `seed/cli.ts`: `system` | `demo` | `reset` (reset = refuse in production, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`, migrate, system, demo). Root scripts from Task 2 point here; `scripts/setup.ts` now seeds.
- `test/app.ts`: `api()` = a `createApp()` instance; `call(method, path, { token?, body?, headers? })` adds the internal token; `resetData()` = `truncateAll()` + `seedSystem` + `seedDemo`; `signIn(login, password = "Password123!")` creates a session directly through `createSession` and returns the token (so tests don't spend sign-in rate limits).

- [ ] **Step 1: Failing tests** — `crypto.test.ts`: "round-trips a secret", "a tampered ciphertext throws", "unknown version throws". `password.test.ts`: "verifies the right password, rejects a wrong one", "null hash returns false after a full verify". `totp.test.ts`: ported. `sessions.test.ts`: "a new session resolves with the user's current permissions", "a role change applies on the next resolve", "an inactive user resolves null", "expired and idle sessions resolve null and their rows are gone", "last_seen_at is written at most once per 60 s". `limits.test.ts`: port every case of `apps/web/src/lib/server/ratelimit.test.ts` (time control through rows, not clocks), plus "20 concurrent hits on a limit of 10 allow exactly 10". `guard.test.ts`: "no bearer 401", "unknown token 401", "missing permission 403 forbidden before the handler runs". `parse.test.ts`: "idParam rejects abc, 1, and a uuid with trailing text as 404". `page.test.ts`: "page past the end has empty items and the real total", "ties broken by id", "caps the count at COUNT_CAP" (insert COUNT_CAP + 5 cheap rows into a temp table). `seed.test.ts`: "system seed twice changes nothing", "demo accounts sign in with Password123!", "production refuses demo". `audit` masking: ported.
- [ ] **Step 2:** `bun test` → fails. **Step 3:** implement. **Step 4:** `bun test` green; `bun run db:reset` then `bun run db:seed` on the dev DB leaves Farhan Riuzaki as an active Superadmin (`psql … -c "select name, email from users join user_roles …"`).
- [ ] **Step 5:** `bun run check` green. Commit `feat(api): crypto, sessions, limits, guard, paging, audit writer and seeds`.

### Task 4: Auth routes and LDAP

**Files:** Create `apps/api/src/auth/{routes.ts,sign-in.ts,ldap.ts}`, tests `apps/api/src/auth/auth.test.ts`, `ldap.test.ts`. Modify `app.ts` (mount).

**Interfaces (all under `/v1/auth`, no `guard` except where noted; same-origin is Next's job):**
- `POST /login` body `LoginBody` → `{ next, token?, challenge? }`: on a full sign-in `{ next, token }` (session created, `login_success`); 2FA due `{ next: "/login/2fa[?next=…]", challenge }` (`auth_challenges` row, 10 min, `password_ok`). Errors and limits exactly as `apps/web/src/app/api/auth/login/route.ts` + `lib/server/sign-in.ts` (`findUser` by username or email, case-insensitive; LDAP users via `method: "ldap"` and the directory; `invalid_credentials` alike for unknown/wrong/method mismatch; `account_inactive`; `rate_limited` + `Retry-After`; `afterSignIn` keeps `next` only when internal — reuse `@starterkit/ui/lib/safe-path`).
- `POST /2fa` header `X-Auth-Challenge: <challenge>` body `TwoFactorBody` → `{ next, token }`; TOTP (replay guard on `totp_last_step`) or a recovery code (spent); the challenge row is deleted on success; errors as the mock route.
- `POST /logout` with bearer (ends the session, `logout` entry) or `X-Auth-Challenge` (deletes the challenge) → `{ ok: true }`; nothing → `{ ok: true }`.
- `POST /forgot` `ForgotPasswordBody` → always `{ ok: true }`; when the email is a local-password user and not throttled: replace their `user_tokens` row (`reset`, 30 min) and `sendMail` with `${APP_URL}/reset-password?token=…`.
- `POST /reset` `ResetPasswordBody` → `{ ok: true }`; token spent even when expired; LDAP user → `invalid_code`; sets the password, ends all sessions, `password_reset` entry. Also accepts `invite` tokens (72 h).
- `GET /context` with bearer → `{ user: UserDto, permissions: PermissionName[] }` (internal, used by Next page guards; add `AuthContextDto` to `@starterkit/shared/contracts/auth`).
- `sign-in.ts`: `deviceOf(ua)`, `findUser(login)`, `reauth(user, proof)` (wrong proof → backoff via `passwordFails`, 400 `invalid_credentials`), `oauthOnly(user)` — ports of `apps/web/src/lib/server/sign-in.ts`.
- `ldap.ts`: `type Directory = { verify(username: string, password: string): Promise<boolean> }`; `directory(): Directory | null` — `LDAP_MOCK=true` → mock with `ldap` → `LdapPass123!` (the demo LDAP account's username); `LDAP_URL` set → real (`ldapts`: bind `LDAP_BIND_DN`/`LDAP_BIND_PASSWORD`, search `LDAP_BASE_DN` with `LDAP_USER_FILTER` (default `(uid={username})`, value escaped per RFC 4515), bind as the found DN; production requires `ldaps://` or `LDAP_STARTTLS=true`; 5 s timeout; any error → false + `warn` log without the password); neither → null (LDAP sign-in answers `invalid_credentials`). Config keys join `config.ts` (optional).

- [ ] **Step 1: Failing tests** — port every `it` in `apps/web/src/app/api/auth/auth-routes.test.ts` (same names) to `auth.test.ts` against `/v1/auth/*`, adapting only the cookie mechanics (token/challenge come back in the body). Add: "unknown login and wrong password both run one argon2 verify" (spy on `Bun.password.verify` call count), "forgot for an unknown, an LDAP and a throttled email sends no mail and answers the same body", "a reset token works once", "context returns permissions in catalog order". `ldap.test.ts`: "filter escapes `*()\\` and NUL", "mock verifies the demo account only", "production with ldap:// and no StartTLS is a config error".
- [ ] **Step 2–4:** fail → implement → green.
- [ ] **Step 5:** `bun run check`; commit `feat(api): sign-in, two-factor, sign-out, password reset and LDAP`.

### Task 5: RBAC routes

**Files:** Create `apps/api/src/rbac/{routes.ts,rules.ts,queries.ts}`, test `rbac.test.ts`; mount in `app.ts`.

**Interfaces:** `GET/POST /v1/roles`, `GET/PATCH/DELETE /v1/roles/{id}`, `GET/POST /v1/permissions`, `GET /v1/users/roles` (role options; lives here, shares `rolePage`'s query). Behavior = `apps/web/src/lib/server/rbac.ts`, `mock/rules.ts` (`checkPermissionGrant`, `checkRoleGrant`, `withViews`), the route files under `apps/web/src/app/api/{roles,permissions,users/roles}` and `docs/api/README.md` (escalation, view auto-include, rename moves holders — free with `user_roles`, case-insensitive names, catalog ≤ 500, `PERMISSION_ROLES_SHOWN`). `userCount` = one `GROUP BY role_id` over `user_roles`. Sort whitelists from `@starterkit/shared/paging`. Activity entries per the README table. `rules.ts` exports the pure rule functions (moved from `mock/rules.ts`, same tests).

- [ ] **Step 1:** Port every `it` of `apps/web/src/app/api/roles/rbac-routes.test.ts` and the RBAC cases of `mock/rules.test.ts`; add "two concurrent PATCH add/remove on one role keep both changes" and "q with % and _ matches literally".
- [ ] **Step 2–4:** fail → implement → green. **Step 5:** `bun run check`; commit `feat(api): roles, permissions and role options`.

### Task 6: Users routes

**Files:** Create `apps/api/src/users/{routes.ts,rules.ts,queries.ts}`, test `users.test.ts`; mount.

**Interfaces:** `GET/POST /v1/users`, `POST /v1/users/bulk`, `GET/PATCH/DELETE /v1/users/{id}`, `POST /v1/users/{id}/reset-password`, `POST /v1/users/{id}/status`, `GET /v1/users/{id}/sessions`, `DELETE /v1/users/{id}/sessions/{sid}`. Behavior = `apps/web/src/lib/server/users.ts`, `mock/rules.ts` (`checkTargetRank`, `checkUserChange`, last superadmin, self action), the route files under `apps/web/src/app/api/users/**` and the README rules (actor rank, escalation, invites 72 h + `sendMail`, deactivate ends sessions, nothing-to-change = no entry, bulk skip codes, `MAX_USER_ROLES`). List search: `name|username|email ILIKE '%' || likeEscape(q) || '%'` (trigram indexes); `role` filter case-insensitive by name; rows carry effective `permissions` (one aggregate, not per-row queries). Detail: last 20 activity entries targeting the user only with `audit.view`. Every rule that reads the Superadmin count runs inside `sql.begin` after `pg_advisory_xact_lock(<fixed key for "superadmins">)`.
- `rules.ts`: the pure rule functions moved from `mock/rules.ts` (+ their tests).

- [ ] **Step 1:** Port every `it` of `apps/web/src/app/api/users/users-routes.test.ts` (actor rank, IDOR, 400-before-guard, bulk, sessions) and the user cases of `rules.test.ts`. Add "concurrent last superadmin": two Superadmins A and B, two parallel requests (A deactivates B, B deactivates A) → exactly one 200 and one 409 `last_superadmin`, one active Superadmin left. Add "q matches email substring", "role filter ignores case", "page 1000 of 15 answers empty items with the real total".
- [ ] **Step 2–4:** fail → implement → green. **Step 5:** `bun run check`; commit `feat(api): user management`.

### Task 7: Me routes

**Files:** Create `apps/api/src/me/routes.ts`, test `me.test.ts`; mount.

**Interfaces:** `GET/PATCH /v1/me`, `POST/PUT/DELETE /v1/me/2fa`, `DELETE /v1/me/connections/{provider}`, `POST /v1/me/password`, `GET /v1/me/sessions`, `DELETE /v1/me/sessions/{id}` (the current session → 409 `self_action`). Behavior = `apps/web/src/app/api/me/**`, `lib/server/sign-in.ts` (`reauth`) and README (email change needs `currentPassword`, OAuth-only rules, password change ends other sessions and spends tokens, recovery codes shown once). TOTP setup secret encrypted into `pending_totp_secret`; enable moves it to `totp_secret` and writes 8 new recovery code hashes. `POST /v1/me/connections/{provider}` is not ported: connecting moves to the OAuth flow in Task 10 (until then the web keeps the mock route — Task 9 handles the switch). `PATCH /v1/me` with no actual change → 200, no activity entry (parked FE minor 4).

- [ ] **Step 1:** Port every `it` of `apps/web/src/app/api/me/me-routes.test.ts` except the connect cases (they move to Task 10); add "PATCH /me with the same values writes no activity", "recovery codes are 8 distinct 19-char codes and each works once at /v1/auth/2fa".
- [ ] **Step 2–4:** fail → implement → green. **Step 5:** `bun run check`; commit `feat(api): profile, password, two-factor and own sessions`.

### Task 8: Audit, dashboard and API conformance tests

**Files:** Create `apps/api/src/audit/routes.ts`, `apps/api/src/dashboard/routes.ts`, tests `audit.test.ts`, `dashboard.test.ts`, `apps/api/src/conformance.test.ts`; mount.

**Interfaces:** `GET /v1/audit/activity`, `GET /v1/audit/auth` (paging, filters, `format=csv` up to `CSV_MAX_ROWS` newest first via `@starterkit/ui/lib/csv` with `CSV_BOM` and `csvFileName`, `Content-Disposition: attachment`), `GET /v1/dashboard`. Behavior = `apps/web/src/lib/server/{audit-log,dashboard}.ts` and their routes/tests. Date range: `from`/`to` are calendar days in `APP_TIME_ZONE` (`@starterkit/ui/lib/format`): `at >= (from::date)::timestamp AT TIME ZONE tz AND at < ((to::date + 1)::timestamp AT TIME ZONE tz)`. `user` filter: actor name/id as recorded or the actor's current email (join `users` on `actor_id`).
- `conformance.test.ts` (replaces the web route guards for the API): (a) endpoint table — `createApp().routes` (method + path, `/v1` → `/api`, `:id` → `{id}`) equals the table in `docs/api/README.md` plus the internal allowlist (`GET /v1/auth/context`, health routes, the OAuth routes of Task 10 when they exist), both directions; (b) static scan of `apps/api/src/**/routes.ts`: every handler outside `auth/` calls `guard(` before any `sql`/query helper; every non-GET handler outside `auth/` calls `recordActivity(`; every list GET calls `pageQuery(`; a handler never calls `idParam`/404 before `body(` (port the order rule from `apps/web/src/test/architecture.test.ts`). Each rule has a fixture proving it fails on a violation.

- [ ] **Step 1:** Port every `it` of `apps/web/src/app/api/audit/audit-routes.test.ts` and `dashboard/dashboard-route.test.ts`; add "capped count on 200k rows": insert 200,000 `activity` rows with `generate_series`, `GET /v1/audit/activity?page=1000&pageSize=100` answers 200 with `totalCapped: true` in under 2 s (log the time).
- [ ] **Step 2–4:** fail → implement → green. **Step 5:** `bun run check`; commit `feat(api): audit logs, dashboard and conformance tests`.

### Task 9: Web becomes the BFF; mock deleted

**Files:**
- Create: `apps/web/src/lib/server/backend.ts`, `apps/web/src/app/api/[...path]/route.ts`, tests `backend.test.ts`, `forward.test.ts`.
- Rewrite: `apps/web/src/lib/server/{session.ts,page-guard.ts,prefetch.tsx,config.ts,api.ts}`, `apps/web/src/app/api/auth/{login,2fa,logout,forgot,reset}/route.ts`, `apps/web/src/app/(main)/layout.tsx` only if its data source changes, `apps/web/playwright.config.ts`, `apps/web/tests/e2e/global-setup.ts`.
- Delete: `apps/web/src/lib/server/mock/**`, `lib/server/{users,rbac,audit-log,audit,dashboard,sign-in,totp,ratelimit,paginate}.ts` and their tests, every `apps/web/src/app/api/**/route.ts` except `auth/*` and the catch-all, the ported route tests under `apps/web/src/app/api/**`.
- Modify: `apps/web/src/test/architecture.test.ts` and `api-contract.test.ts` (drop the rules that moved to `apps/api/src/conformance.test.ts`; keep the client `/api/`-only rule, CSP, `API_BASE_URL` server-only rule; add: no file under `apps/web/src` imports `bun`, `pg`, or `apps/api`), `apps/web/scripts/emit-api-schemas.ts` (endpoint-table check now lives in the API), `docs/api/README.md` (the backend is real: "Seed data (mock only)" → seed scripts; mock wording removed), `.env.example` files.

**Interfaces:**
- `config.ts` (web) adds `API_BASE_URL` (required in production; dev default `http://127.0.0.1:4000`) and `INTERNAL_API_TOKEN` (required, ≥ 32).
- `backend.ts`: `backend(path: string, init?: { method?: string; body?: BodyInit | null; contentType?: string; token?: string | null; challenge?: string | null; req?: Request }): Promise<Response>` — `fetch(API_BASE_URL + path)` with `X-Internal-Token`, `Authorization: Bearer` when `token`, `X-Auth-Challenge` when `challenge`, `X-Client-Ip` (`clientIp(req)`), `X-Client-Ua`, `X-Request-Id` (new UUID), `AbortSignal.timeout(10_000)`; a GET retries once on a connection error; a network failure or timeout → `apiError(500, "internal", <fixed copy>)` and an error log. `backendJson<T>(path, init): Promise<{ status: number; data: T | null }>`.
- `session.ts`: `type AppSession = { token?: string; csrf?: string; challenge?: string }`; cookie options unchanged (`sk_session`, httpOnly, `sameSite: "strict"`, secure from `COOKIE_SECURE`, TTL `SESSION_TTL_HOURS`). `authContext = cache(async () => …)` → `{ user: UserDto; perms: PermissionName[] } | null` from `GET /v1/auth/context` (null on 401, and the cookie is cleared).
- `app/api/[...path]/route.ts`: `GET, POST, PATCH, PUT, DELETE = forward`. `forward(req)`: path must match `^/api/[a-z0-9/_-]+$` after decoding (else 404); a full session + a non-GET without a matching `x-csrf-token` → 403 `csrf`; body over 64 KB → 400; forwards query string and JSON body with the session token; streams the answer back with its status and `Content-Type`/`Content-Disposition`/`Retry-After`/`Cache-Control` headers only; API 401 → destroy the cookie.
- Auth routes keep their same-origin checks and set/clear the cookie: login stores `{ token, csrf: randomToken }` or `{ challenge }`; 2fa reads `challenge`, stores `{ token, csrf }`; logout calls the API (bearer + CSRF check when a full session; challenge otherwise) and destroys the cookie; forgot/reset forward.
- `page-guard.ts`: `requirePagePermission(perm)` and `guardedTitle(title)` use `authContext()`; return `{ user, perms, csrf }` as today.
- `prefetch.tsx`: `type Read = { key: QueryKey; path: string | null }` (`path` = the `/api/...` URL the hook fetches; null = nothing to prefetch); `<Prefetch reads>` GETs each through `backend` (`/api` → `/v1`) with the session token in parallel, dehydrates the 200s only. `reads.*` keep their names and keys; `table()` keeps the 400 rule by parsing with the route schema before fetching.
- E2E: `playwright.config.ts` `webServer` = `[api, web]`: api `bun run --filter @starterkit/api db:reset && bun apps/api/src/index.ts` with `DATABASE_URL` = `_e2e` db, `API_PORT=4123`, fixed random `INTERNAL_API_TOKEN`/`DATA_ENCRYPTION_KEY` for the run, `OAUTH_MOCK=true`, `LDAP_MOCK=true`, url `http://127.0.0.1:4123/readyz`; web as today with `API_BASE_URL=http://127.0.0.1:4123` and the same `INTERNAL_API_TOKEN`. Tests that relied on mock ids or in-process state are adapted to look ids up through the UI or `/api`.
- The OAuth button and the connect action keep working through the mock flow until Task 10: for this task, Next keeps `app/api/auth/oauth/[provider]/route.ts` and calls a temporary `POST /v1/auth/oauth/{provider}/mock-login` (`OAUTH_MOCK` only) and the web's connect button calls `POST /api/me/connections/{provider}` forwarded to a temporary `POST /v1/me/connections/{provider}` (`OAUTH_MOCK` only). Task 10 deletes both.

- [ ] **Step 1: Failing tests** — `forward.test.ts` (API faked with a local `Bun.serve`/`http` server or `fetch` stub): "mutation with a session and no x-csrf-token is 403 csrf and never reaches the API", "GET without a session is forwarded without Authorization", "API 401 clears the cookie", "`/api/../v1` and `%2e%2e` paths are 404", "a 70 KB body is 400", "CSV passes through with Content-Disposition", "API down → 500 internal fixed copy". `backend.test.ts`: "sends X-Internal-Token and client headers", "GET retries once on ECONNREFUSED, POST never". Keep `page-guard.test.ts` and `prefetch.test.ts` updated to the new sources.
- [ ] **Step 2–4:** fail → implement → delete the mock → green.
- [ ] **Step 5:** `bun run check`, `bun run build`, `bun run e2e` (all specs, including `no-flicker`, `a11y`, `permissions`, `ds` snapshots), `bun run budget` — all green; `rg -n "mock/db|lib/server/mock" apps` returns nothing. Commit `feat(web): BFF over the Bun API; mock store removed`.

### Task 10: OAuth (Google, Apple) — real and mock flow

**Files:** Create `apps/api/src/auth/oauth.ts` (+ test), `apps/web/src/app/api/auth/oauth/[provider]/callback/route.ts`, `apps/web/src/app/api/auth/oauth/[provider]/mock-authorize/route.ts`; rewrite `apps/web/src/app/api/auth/oauth/[provider]/route.ts`; modify the `/me/security` connect action (`features/me`) to navigate instead of POST; delete the temporary mock-login/connect endpoints of Task 9; `docs/api/README.md` rows for the OAuth endpoints.

**Interfaces:**
- API `POST /v1/auth/oauth/{provider}/start` body `{ mode: "login" | "link", next?: string, bindingHash: string }` (+ bearer when `link`) → `{ url }`: creates an `oauth_states` row (state = `randomToken`, PKCE verifier, nonce, 10 min); `url` = the provider's authorize URL (arctic `Google`/`Apple`, scopes `openid email` (+ `name` for Apple, `response_mode=form_post`)), or `/api/auth/oauth/{provider}/mock-authorize?state=…` under `OAUTH_MOCK`. A provider without config and without mock → 404 `not_found`.
- API `POST /v1/auth/oauth/{provider}/callback` body `{ code, state, binding }` (+ bearer for link) → login: `{ next, token }` (session, `login_success`, method = provider; no 2FA step, the provider checks it) — link: `{ next }` (`user_identities` insert, `me.connect` activity; identity already linked to another user → 409 `duplicate`). State spent on first use, `hashToken(binding)` must equal `binding_hash`, expiry checked; `id_token` verified with `jose` against the provider JWKS (issuer, audience = client id, `nonce`, expiry). Unknown identity on login → 401 `invalid_credentials`. Mock: `code` = `mock` → subject `mock-<provider>-demo` (login) or `mock-<provider>-<userId>` (link).
- Web `GET /api/auth/oauth/{provider}?next=&mode=` → random binding → cookie `sk_oauth` (`httpOnly`, `secure` unless `COOKIE_SECURE=false` on localhost, `sameSite: "none"` when secure else `"lax"`, path `/api/auth/oauth`, max-age 600) → 303 to `url`.
- Web callback `GET|POST /api/auth/oauth/{provider}/callback` (Apple posts a form) → reads `code`/`state` + `sk_oauth` → API callback → sets `sk_session` `{ token, csrf }` (login) → answers 200 HTML (`<meta http-equiv="refresh" content="0;url=<safe next>">`, CSP nonce not needed, no script) so the Strict cookie is sent on the next navigation; errors land on `/login?error=oauth` (login) or `/me/security?oauth=failed` (link); success of a link → `/me/security?connected=<provider>`, and the security screen toasts it once and drops the parameter (`router.replace`).
- Web mock-authorize `GET` (only when the API answered a mock URL; it 404s unless `OAUTH_MOCK=true` in web env too) → 303 to the callback with `code=mock&state=…`.
- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (PEM), redirect URIs = `${APP_URL}/api/auth/oauth/{provider}/callback`.

- [ ] **Step 1:** Tests: API — "state works once", "wrong binding is 401", "expired state is 401", "id_token with a wrong nonce/audience/issuer is rejected" (sign test tokens with a local JWKS via `jose`), "login with an unlinked identity is invalid_credentials and creates no user", "link of an identity owned by another user is 409 duplicate", "mock login signs in google@example.com". Port the connect cases left out in Task 7. Web — "callback sets the session and answers a meta-refresh page to a safe next", "next=//evil.com lands on /". E2E — the existing Google/Apple sign-in and connect specs pass through the mock flow.
- [ ] **Step 2–4:** fail → implement → green. **Step 5:** `bun run check`, related E2E; commit `feat(auth): OAuth sign-in and account linking for Google and Apple`.

### Task 11: Operations — SMTP, janitor, containers, CI

**Files:** Modify `apps/api/src/mail/mailer.ts` (smtp transport via `nodemailer`, `SMTP_URL`, `MAIL_FROM`, 10 s timeout, errors logged without recipient); create `apps/api/src/jobs/janitor.ts` (+ test), start it from `index.ts`; create `apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.github/workflows/ci.yml`.

**Interfaces:**
- `janitor.ts`: `runJanitor(db): Promise<Record<string, number>>` — under `pg_try_advisory_lock(<fixed key>)` (skip when another instance holds it): delete ended sessions (expired or idle), `auth_challenges`/`oauth_states`/`user_tokens` past expiry, `rate_limits` windows older than 1 h, `login_backoff` quiet for 15 min, `activity`/`auth_log` older than `AUDIT_RETENTION_DAYS`; returns counts (logged at info). `startJanitor()` runs it every 5 min (`setInterval`, unref'd) and once at start; stopped on shutdown.
- Dockerfiles: multi-stage on `oven/bun:1.4.3` (api: `bun install --production --filter`, non-root `bun` user, `CMD ["bun","src/index.ts"]`, `HEALTHCHECK` on `/healthz`); web: build with Bun, run on `node:24-slim` with `next start`, non-root. `docker-compose.yml`: `postgres:18` (volume, healthcheck), `migrate` one-shot (`bun run db:migrate`), `api` (depends on migrate), `web` (depends on api; only web publishes a port, `3001:3000` so it never clashes with the owner's :3000). Secrets through an env file the compose file names (`.env.compose`, gitignored, example committed).
- CI: on push/PR — Bun 1.4.3, Node 24, service `postgres:18`; `bun install --frozen-lockfile`, `bun run check`, `bun run build`, Playwright chromium install (CI only), `bun run e2e`, gitleaks action.

- [ ] **Step 1:** Tests: "janitor deletes only expired rows and skips when the lock is held", "smtp transport errors are logged without the recipient" (fake SMTP server via `Bun.listen` or nodemailer's stream transport). **Step 2–4:** fail → implement → green. If Docker is available: `docker compose build` and `docker compose up -d` then `curl localhost:3001/login` → 200, then `docker compose down`; if not, say so in the report.
- [ ] **Step 5:** `bun run check`; commit `feat(ops): SMTP mail, janitor, container images, compose and CI`.

### Task 12: Parked FE minors

**Files:** `apps/web/src/features/users/*` (edit screen), `features/users` sessions table, `features/rbac` matrix; tests next to them; related E2E.

- [ ] 1. `/users/[id]/edit`: apply the same actor-rank block the list/detail use (`rankBlock`/`protection` in `features/users/use-users.ts`): fields stay readable, Save is a `BlockedButton` with the rank reason. Test: an Admin opening a Superadmin's edit page sees the blocked Save (unit + `permissions.spec.ts` case).
- [ ] 2. User sessions table after the user is deleted: the detail query's 404 wins; the sessions query is disabled once the user is gone (no "Couldn't load" flash). Test in the feature's hook test.
- [ ] 3. Role matrix: a cell for a permission the editor lacks is disabled with the reason (`BlockedButton`/tooltip copy from the copy guide), and `closeViews` never adds a permission the editor lacks. Test in the matrix test.
- [ ] 4. No-op activity entries: covered by the API (Tasks 6–7); add the E2E-free assertion in `users.test.ts` ("bulk assignRole to users who already hold the role writes no activity") if Task 6 didn't.
- [ ] Commit `fix(web): rank-blocked edit, sessions after delete, matrix grants only held permissions`.

### Task 13: Docs, rules and final verification

**Files:** `AGENTS.md` (§1 repo map with `apps/api` and `packages/shared`; §2 commands: setup, dev, db scripts, `bun test`; §3 security rules now enforced in the API with their test files; §4 checklist pointing at API tests; §11 testing; §12 rewritten as "Backend" — the rules of `apps/api`: route order, `guard`, `pageQuery`, `recordActivity`, migrations forward-only, SQL parameters only, invariants under advisory locks, no secret in logs), `README.md` (setup, env reference table for both apps, running, seeding, production deploy with compose, DB roles SQL: `CREATE ROLE starterkit_app LOGIN …; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES …`, backups note, key rotation not yet supported), `docs/api/README.md` (final), memory note for the owner is the controller's job.

- [ ] Every rule added to AGENTS.md names the file/test that enforces it (AGENTS.md preamble rule).
- [ ] Final verification: `bun run check`, `bun run build`, `bun run e2e`, `bun run budget`, `bun run api:schemas && git diff --exit-code docs/api`, `gitleaks detect --no-banner` (local binary), banned-word scan (`no-domain.test.ts`), `bun run setup` on a fresh clone path is not required. Record the numbers in the report.
- [ ] Commit `docs: backend rules, setup and operations`.

### Task 14: SunnyGo brand (owner request 2026-10-20)

The owner asked for their brand in the starterkit. Source (read-only; copy only these files, never anything else from that folder — it also holds certificates and keys): `/Users/riuzaki/Private Space/Sunny Go/SunnyGo-Legal/SunnyGo-Brand/logo/` (`README.md` = brand rules, `svg/`, `favicon/`, `social/`).

**Files:** `packages/shared/src/brand.ts`; `packages/ui/src/ds/brand.tsx` (+ test); `packages/ui/src/styles/tokens.css` (+ `tokens.test.ts`); `apps/web/src/components/brand/` (new: the SunnyGo mark and wordmark as React SVG components — the one folder to swap for another brand); `apps/web/src/app/{icon.svg,favicon.ico,apple-icon.png,opengraph-image.png}` (Next file conventions); `sidebar.tsx`, `auth-card.tsx`; `/ds` gallery brand section; `ds` E2E snapshots.

**Rules (from the brand README, binding):**
- Product name `SunnyGo` (`BRAND.name`); the logo is never retyped in a font — the wordmark `sunnygo` and the mark `go` are the outline SVG paths from `svg/`, inlined as React components with `role="img"` and `aria-label={BRAND.name}`.
- Four colour versions only: main (navy `#0D1530` letters + amber `#FFA928` sun) on light, dark (white letters + amber sun) on dark; mono black/white not needed in the app. Add tokens `--brand-ink` (light `#0D1530`, dark `#FFFFFF`) and `--brand-sun` (`#FFA928` both) in `:root`/`.dark`; logo paths use them. Amber is for the sun only — never a UI colour. Never green.
- Clear space = sun diameter; minimum sizes: wordmark 72 px wide, transparent mark 24 px; below 24 px use the tile favicon.
- Sidebar expanded → wordmark; collapsed rail → mark; sign-in card → wordmark. The `ds` `Brand` component becomes a layout slot that takes the logo nodes (no monogram placeholder).
- Favicon: `favicon/favicon.svg` as `app/icon.svg` (it switches colour in dark mode), `favicon.ico`, `apple-touch-icon-180.png` as `app/apple-icon.png`, `social/og-image-1200x630.png` as `app/opengraph-image.png`.
- Accent palette (ruling, Claude): the README reserves sky blue for another product (Hushtop) and makes navy the trust colour, so `--primary` moves from blue to the navy family in light mode, with a dark-mode primary that keeps WCAG AA (4.5:1 for text on/with primary, 3:1 for focus ring and controls against their background). Links and focus states must stay distinguishable from body text (underline or weight where colour alone no longer separates them). `chart-*` series colours stay.
- API TOTP issuer follows `BRAND` automatically.

- [ ] Tests first: `brand.test` (logo has role img + accessible name; collapsed shows mark, expanded wordmark), `tokens.test` (new tokens exist in both themes; contrast pairs for primary meet AA).
- [ ] `bun run check`; `NEXT_DIST_DIR=.next-e2e bun run build`; `bun run e2e` (a11y on 10 pages light/dark must pass; update `ds` snapshots only for the brand/colour change and say so); `bun run budget`.
- [ ] Commit `feat(brand): SunnyGo logo, name, favicon and navy accent`.

## Refactor tasks (owner decision 2026-10-20: Elysia + Drizzle + module folders)

Execution order after Task 10: 15 → 16 → 17 → 18 → 11 → 12 → 14 → 13. Spec: "Amandemen 2026-10-20" in the spec file.
Binding for 15–18: behaviour-preserving — every existing API test keeps its name and assertions (only the harness may
change), every E2E stays green, the contract and check order are unchanged. Pin `elysia` 1.4.30, `drizzle-orm` 0.45.4,
`drizzle-kit` 0.31.11 exactly. Hono is removed in Task 18. Raw full SQL statements are forbidden in app code (spec rule);
tests also use Drizzle to move rows/time.

### Task 15: Elysia + Drizzle foundation and kernel

Files: `apps/api/src/{app.ts,index.ts}`, `config/`, `db/{client.ts,schema/*.ts,migrate.ts}`, `drizzle.config.ts`,
`drizzle/` (generated + custom SQL), `common/{errors.ts,log.ts,crypto.ts,mailer.ts,locks.ts,pagination.ts,plugins/*}`,
the kernel modules (sessions, password, totp, limits, audit writer, seeds) moved to the new layout on Drizzle.
- Drizzle schema mirrors 0001+0002 exactly (tables, columns, FKs, unique `lower()` indexes, trigram GIN, btree list
  indexes, UNLOGGED tables, append-only trigger via custom SQL). Migration history restarts: generated `0000` + custom
  `0001`; the runner (advisory lock + checksum) applies `drizzle/*.sql`. Reset local dev/test/e2e DBs and reseed (allowed).
- Elysia app: plugins `context` (requestId, client ip/ua), `internalAuth`, body limit 64 KB, `errorHandler` (same mapping
  as `onError`), `guard(perm)` usable as `beforeHandle`; query validated before the guard, body parsed after it.
- Transitional: the existing Hono routers are mounted inside the Elysia app (`app.mount`) so every test stays green
  while modules move (removed in Task 18).
- `pageQuery` becomes a Drizzle helper (rows + capped count, sort whitelist → column objects).
- Tests: all kernel tests ported and green; `bun run check`; E2E green.

### Task 16: Modules auth, oauth, me on Elysia + Drizzle
`modules/{auth,oauth,me}/{index.ts,service.ts,rules.ts?}`; delete their Hono routers; tests unchanged and green; E2E auth specs green.

### Task 17: Modules rbac, users on Elysia + Drizzle
Same for `modules/{rbac,users}`; the lock-staged concurrency tests (TOCTOU, last Superadmin) stay and pass.

### Task 18: Modules audit, dashboard, health; Hono removed; conformance on Elysia
Move the last modules; delete Hono and every `routes.ts`; rewrite `conformance.test.ts` for the Elysia layout (endpoint
table from `app.routes`; scan of `modules/*/index.ts`: guard before service calls, activity on mutations via service,
pageQuery in list GETs, no 404 before body; and a new rule: no full SQL statement text in `src/**` outside migrations).
Full `bun run check`, build, E2E, budget green.

### Tests layout for 15–18 (owner decision 2026-10-20)
API tests move out of `src/` into `apps/api/test/{unit,integration,helpers}` mirroring `src/` (spec "Tes di folder
terpisah"). Task 15 creates the layout, moves the kernel/config/db tests and the helpers, adds `test:unit` and
`test:integration` scripts, and adds unit tests for every pure helper that has none. Tasks 16–17 move each module's tests
as the module moves and add unit tests for its `rules.ts`. Task 18 adds the conformance rule "no `*.test.ts` under
`apps/api/src`". Test names and assertions stay the same when moved.

### Modulith layout for 15–18 (decision 2026-10-20)
Use the spec section "Modular monolith": `kernel/` (was `common/`), `modules/index.ts` registry, per module
`index.ts` (public API) + `controller.ts` + `service.ts` + `schema.ts` + `rules.ts`. Task 15 creates `kernel/`, the
registry, the table-ownership split of the Drizzle schema (each `schema.ts` in its module) and an API architecture test
(no deep imports into another module, kernel never imports modules, every table owned once). Tasks 16–18 move modules
into this shape. Task 13 documents "how to add a module" in AGENTS.md and README.

### Test placement (supersedes "Tests layout for 15–18")
Module tests live in `modules/<m>/tests/{unit,integration}/`, kernel tests in `kernel/tests/unit/`, shared harness in
`apps/api/test/helpers/`, cross-module tests (boundaries, conformance, no-raw-SQL) in `apps/api/test/architecture/`.
The architecture test forbids a `*.test.ts` beside a source file. The production image (Task 11) excludes tests.
