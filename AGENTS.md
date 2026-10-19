# AGENTS.md

Rules for every contributor, human or AI. One rule per line, each with the file that enforces it. Rules come from the
code, tests and docs of the app this starterkit was extracted from; do not add a rule here that no code, test or doc backs.

Guard files named below are created by later plan tasks (security core and `architecture.test.ts`: Task 5; `no-domain.test.ts`
and the DS/chart port: Task 3; `bundle-budget.mjs`, e2e: Task 13). Until a guard exists, the rule is still binding.

## 1. Repo map and layers

- `packages/ui/src/{ui,motion,styles,lib}` = primitives, motion, tokens, helpers; `ds` and `charts` (Task 3) sit above them. Source-only, transpiled by Next.
- `apps/web/src/{app,components/shell,features,lib/{shared,server,client},test}` = Next.js 16 App Router app.
- Layers import downward only: `ui`/`motion` → `ds` → `charts` → `components/shell` → `features/*`. (`apps/web/src/test/architecture.test.ts`)
- A feature never imports a sibling feature. (`architecture.test.ts`)
- `packages/ui/src/**` never imports from `apps/` or the `@/` alias; use relative paths inside the package. (`apps/web/src/test/no-domain.test.ts`)
- `page.tsx` stays thin: `features/<domain>` → React Query hook → `fetch('/api/...')` → route handler (zod → `withPermission` → store).
- Client code (`"use client"`) never imports `lib/server`. (`architecture.test.ts`)
- `lib/shared` is pure: no React, Next, `lib/server` or components. (`architecture.test.ts`)
- Only `charts` imports `recharts`; only `packages/ui/src/motion/framer.tsx` imports `motion`; only `packages/ui/src/ui/icons.ts` imports `@hugeicons/core-free-icons`; no `lucide-react`. (`architecture.test.ts`, `packages/ui/src/motion/layer.test.ts`)
- Radix DropdownMenu and Popover are imported only in their `*-impl` file; nothing imports it statically. (`packages/ui/src/ui/deferred-overlay.test.ts`)
- Only `lib/cn.ts` imports the raw class-merge package. (`packages/ui/src/lib/cn.test.ts`)
- No source-app domain words in `apps/**` and `packages/**` (except `package.json`, lockfile); the list lives only in the test. (`apps/web/src/test/no-domain.test.ts`)

## 2. Commands

Package manager is Bun 1.4.3; runtime for Next is Node 24.

- `bun install` installs.
- `bun run dev` serves `apps/web`.
- `bun run check` = typecheck + lint (`--max-warnings 0`) + unit tests. Must pass before every commit.
- `bun run --filter @starterkit/web test -- <name>` runs one test file.
- `bun run build` builds `apps/web`; `bun run e2e` and `bun run budget` arrive in Task 13.
- Commit messages end with the `Co-Authored-By` line required by the plan.

## 3. Security

- Send CSP with a per-request nonce plus the fixed headers from `securityHeaders()`: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`, a `Permissions-Policy` that denies device APIs. (`apps/web/src/security-headers.ts`, `proxy.ts`)
- Send `Strict-Transport-Security: max-age=31536000; includeSubDomains` only when `COOKIE_SECURE=true`. (`security-headers.ts`)
- Session cookie is `httpOnly`, `sameSite: "strict"`, `secure` when `COOKIE_SECURE`, `path: "/"`. (`apps/web/src/lib/server/session.ts`)
- Keep only `sid`, `csrf` and the pending-2FA marker in the cookie; compute permissions per request from the store. (`api.ts`, `api.test.ts`)
- Require header `x-csrf-token` on every POST/PATCH/PUT/DELETE and compare it constant-time (`timingSafeEqual`, equal-length check). (`apps/web/src/lib/server/csrf.ts`, `csrf.test.ts`)
- Wrap every `/api/*` handler except `/api/auth/*` in `withPermission`, and check the permission before reading any data. (`apps/web/src/test/architecture.test.ts`)
- Validate input with zod in the route handler before the guard touches the store; a bad value is 400 `bad_request`. (`api.ts` `handleError`)
- Redirect only to internal paths: reject `//x`, `/\x`, control characters, and anything that normalizes to a protocol-relative URL; never land on `/login` or `/api`. (`apps/web/src/lib/shared/safe-path.ts`, `safe-path.test.ts`)
- Return generic errors: unknown exceptions are 500 with a fixed message, detail goes to the log only. (`handleError`, `api.test.ts`)
- Answer identically for unknown user, wrong password and LDAP user on password sign-in (`invalid_credentials`), and for `forgot-password` on an unknown email. (Task 6 tests)
- Rate-limit sign-in: 10/min per IP, 300/min fleet-wide breaker, 5/min per username, then soft backoff per username (3 free failures, then 1 s, 2 s, 4 s … max 60 s, cleared after 15 min quiet or on success). (`apps/web/src/lib/server/ratelimit.ts`, `ratelimit.test.ts`)
- Ignore `X-Forwarded-For` unless `TRUSTED_PROXY=true`. (`clientIp` in `apps/web/src/lib/server/api.ts`)
- Bound every in-memory `Map` (default 10,000 keys) and evict the oldest key on overflow; never clear all. (`ratelimit.ts`)
- Never use `dangerouslySetInnerHTML`. (`architecture.test.ts`)
- The browser calls only same-origin `/api/*` on the Next server, never the backend: every `fetch(`/`api(` literal in client code starts with `/api/`, and no `NEXT_PUBLIC_*API*`/`*URL*` variable exists; `API_BASE_URL` is server env only. (CSP `connect-src 'self'` in `apps/web/src/security-headers.ts`, `architecture.test.ts`)
- Redact `password, token, cookie, code, csrf, otpauth, uri, secret, formToken, phone, email` in logs, top level and one level down, and mask `otpauth://` and `secret=` inside strings. (`apps/web/src/lib/server/logger.ts`, `logger-redact.test.ts`)
- Commit no secret; `gitleaks` scans the tree. (`.gitleaks.toml`)
- Call `recordActivity` in every non-GET handler outside `/api/auth/*`. (`architecture.test.ts`)
- Neutralize CSV cells: prefix `'` when a cell starts with `=`, `+`, `-`, `@` (after optional spaces) or tab/CR. (`packages/ui/src/lib/csv.ts`, `csv.test.ts`)

## 4. Hardening and pentest checklist

A change that touches routes, guards, redirects or exports needs a test for each applicable case before merge.

- Path traversal and URL normalization: `/a/../b`, `%2e%2e`, `%2F` and case variants parse to the page they name. (`proxy.test.ts`, `page-guard.test.ts`, `safe-path.test.ts`)
- Open redirect: `//evil.com`, `/\evil`, `%2F%2Fevil`, `/a/..//evil` land on an internal path or `/`. (`safe-path.test.ts`)
- IDOR: a user requesting an id that belongs to someone else gets 403 or 404, never the record. (`route-guard.test.ts` pattern)
- 403 before read: with a missing permission the handler never runs and the store is not read. (`api.test.ts`)
- Out-of-enum or out-of-range query values are 400 before the guard touches the store. (`read-routes.test.ts` pattern)
- Mutation without or with a wrong `x-csrf-token` is 403 `csrf`. (`csrf.test.ts`, `api.test.ts`)
- Permission removed or user deactivated mid-session takes effect on the next request. (`api.test.ts`)
- Every route file is guarded; the no-guard list is exact. (`architecture.test.ts`, `route-guard.test.ts` pattern)
- Rate limit and backoff: per-IP bucket, fleet breaker, per-username cap, concurrent attempts reserved synchronously. (`ratelimit.test.ts`)
- CSV formula injection, including leading space, tab and CR. (`csv.test.ts`)
- Secrets absent from log lines, error messages, child bindings and printf arguments. (`logger-redact.test.ts`)
- Error bodies never contain the thrown message. (`api.test.ts`)

## 5. Dependencies

- Pin exact versions (no `^`, no `~`); match the versions in the plan header. (`package.json`)
- Do not add a dependency for what a few lines can do; any new dependency is pinned exact too.

## 6. Tokens and color

- Use color, radius, shadow and type-scale tokens only; hex literals exist only inside `:root` and `.dark`. (`packages/ui/src/styles/tokens.css`, `packages/ui/src/styles/tokens.test.ts`)
- No literal color (`#…`, `rgb(`, `hsl(`, `oklch(`) and no arbitrary pixel class (`-[12px]`) in `.tsx`. (`architecture.test.ts`)
- Surfaces step bg → sheet → tray → card; shadows only on floating layers. Full rules: `docs/standards/design-system.md` §0, §3.
- Status colors are for the five health states only; chart colors `chart-1…6` for series only. (`design-system.md` §3.1, §3.3)

## 7. UI standard

- Follow `docs/standards/ui-standard.md`: page anatomy (§1), grid (§2), the five states per data region (§3), data display (§4), interaction (§5).
- Desktop-first: 1440 px reference, 1280 px minimum, no horizontal scroll at 768–1279; targets 28 px minimum, 32 px default.
- Same metric, same label, unit, format and icon on every page; numbers only through `format.ts`.
- Status uses `StatusChip` plus `StatusLegend`, never color alone. Shareable state (filters, tab, range, page) lives in the URL.
- Extend the standard and the `/ds` gallery before inventing a one-off component.

## 8. Motion

- Motion durations and easings come from tokens, never literals: `instant 0.1`, `fast 0.15`, `pop 0.18`, `enter 0.22`, `page 0.26`, `exit 0.16`, `slow 0.28`, `tween 0.6`, `flash 1.2` s. (`packages/ui/src/motion/tokens.ts`, `tokens.test.ts`)
- Stagger is 35 ms per item, at most 8 items, 6 px shift. No stagger or `layout` on tables or lists with more than 20 siblings. (`tokens.ts`, `design-system.md` §7.7)
- Animate `transform` and `opacity` only; `will-change` never in static CSS. Exceptions are listed in `design-system.md` §7.8 (R3, R9).
- Honor `prefers-reduced-motion`: opacity only, no translate, scale, spring, stroke-draw, number tween or shimmer sweep. (`packages/ui/src/motion/reduced-motion.ts`, `globals-css.test.ts`)
- Do not use `motion-safe:animate-pop` or `motion-safe:animate-swap`; the utility already has its reduced fade. (`architecture.test.ts`)
- Features, `ds` and shell never write literal `duration-*`, `delay-*` or `0.2s`-style timings. (`architecture.test.ts`)
- Exits are faster than enters. The Framer layer loads after idle, outside first-load JS. (`design-system.md` §7.8 R1)

## 9. Performance

- First-load JS gzip stays at or under 250 kB per route; check with `bun run budget` (`apps/web/scripts/bundle-budget.mjs`, default `--budget 250`).
- Wrap below-the-fold charts in `LazyMount`; lazy-load Radix overlays through `deferred-overlay`; load heavy tables with `next/dynamic` when a route nears the budget.
- Do not use `next/image`; icons are inline SVG via `packages/ui/src/ui/icon.tsx`. (Not machine-enforced yet.)
- Do not import `zod` into client code that ships in a route's first load. (`docs/standards/ui-standard.md` §5)

## 10. Copy

- All UI text is English, sentence case, no exclamation marks, no emoji. Full rules and glossary: `docs/standards/copy-guide.md`.
- Use glossary terms exactly: user, role, permission, session, activity log, sign-in log, sign in / sign out, one-time code.
- Buttons are verb + object ("Create user"); never "OK", "Yes", "Submit". Errors say what happened, why, and what to do.
- Every disabled action explains why; every empty state says when data appears.
- Avoid: sorry, oops, simply, just, easily, successfully, utilize, in order to, N/A.

## 11. Tests and definition of done

- Write the failing test first for logic, guards and contracts; keep the test next to the module (`*.test.ts`).
- Done = `bun run check` passes + the related e2e passes + no banned word (§1) in `apps/**` and `packages/**`.
- A new route, guard or redirect adds its §4 cases.
- A new color, motion value or icon goes through tokens/`icons.ts` first, then the `/ds` gallery.

## 12. Backend later (shared contract)

The API contract is the zod schemas in `apps/web/src/lib/shared/contracts/*`. A Bun or Rust backend must follow them and the rules below.

- Error body: `{ "error": { "code": string, "message": string } }`.
- Error codes (fixed): `unauthenticated` 401, `forbidden` 403, `csrf` 403, `not_found` 404, `bad_request` 400, `duplicate` 409, `rate_limited` 429, `invalid_credentials` 401, `account_inactive` 403, `invalid_code` 400, `superadmin_locked` 409, `last_superadmin` 409, `self_action` 409, `role_in_use` 409, `ldap_password` 409, `internal` 500.
- Rate-limited responses (429) send `Retry-After` in seconds.
- Paging query: `page` (≥ 1), `pageSize` (10, 25, 50 or 100; default 25), `q`, `sort` (`field` or `-field`).
- Paging answer: `{ items: T[]; total: number; page: number; pageSize: number }`.
- Bulk answer: `{ done: string[]; skipped: { id: string; code: string }[] }`; skipped rows carry a code, only `done` rows reach the activity log.
- Every POST/PATCH/PUT/DELETE requires header `x-csrf-token`; the token lives in the session and the server hands it to the layout.
- Permissions: `user.{view,create,edit,delete}`, `role.{view,create,edit,delete}`, `permission.{view,create}`, `audit.view`; catalog in `apps/web/src/lib/shared/permissions.ts`.
- Responses send `Cache-Control: no-store`. (`json()` in `apps/web/src/lib/server/api.ts`)
- The backend is reached only from Next route handlers and server code through `API_BASE_URL` (server env, never `NEXT_PUBLIC_*`); the browser never sees its address, so CORS and cookies stay same-origin. (CSP `connect-src 'self'` in `apps/web/src/security-headers.ts`, `architecture.test.ts`)
