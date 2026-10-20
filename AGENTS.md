# AGENTS.md

Rules for every contributor, human or AI. One rule per line, each with the file that enforces it. Rules come from the
code, tests and docs of the app this starterkit was extracted from; do not add a rule here that no code, test or doc backs.

## 1. Repo map and layers

- `packages/shared/src` = zod contracts, paging, permissions, audit vocabulary, log redaction (`@starterkit/shared`); web and the API import it. Source-only.
- `packages/ui/src/{ui,motion,styles,lib}` = primitives, motion, tokens, helpers; `ds` and `charts` (Task 3) sit above them. Source-only, transpiled by Next.
- `apps/web/src/{app,components/shell,features,lib/{shared,server,client},test}` = Next.js 16 App Router app.
- Layers import downward only: `ui`/`motion` → `ds` → `charts` → `components/shell` → `features/*`. (`apps/web/src/test/architecture.test.ts`)
- A feature never imports a sibling feature. (`architecture.test.ts`)
- `packages/ui/src/**` never imports from `apps/` or the `@/` alias; use relative paths inside the package. (`apps/web/src/test/no-domain.test.ts`)
- `page.tsx` stays thin: `features/<domain>` → React Query hook → `fetch('/api/...')` → route handler (zod → `withPermission` → store); the page wraps its screen in `<Prefetch reads={[…]}>` (`lib/server/prefetch.tsx`), which runs the route's own read function on the server under the hook's key (`lib/shared/queries.ts`). (`apps/web/src/lib/server/prefetch.test.ts`)
- Client code (`"use client"`) never imports `lib/server`. (`architecture.test.ts`)
- `lib/shared` is pure: no React, Next, `lib/server` or components. (`architecture.test.ts`)
- `packages/shared/src/**` is pure: no React, Next, `apps/`, `@/`; the only workspace import is `@starterkit/ui/lib/*`. Contracts, paging, permissions, audit vocabulary and log redaction live there. (`architecture.test.ts`, `no-domain.test.ts`)
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
- `bun run test:changed` runs, in each workspace, the tests touched by files changed since the last commit (`vitest --changed`); `bunx vitest related <files>` inside a package runs the tests that import those files.
- `bun run api:schemas` regenerates `docs/api/schemas/` from the zod contracts.
- `bun run build` builds `apps/web`; `bun run e2e` runs the Playwright E2E against a production build on :3123 (`apps/web/playwright.config.ts`; `E2E_REUSE=1` reuses a server already on `E2E_PORT`); `bun run budget` checks first-load JS after a build.
- Commit messages end with the `Co-Authored-By` line required by the plan.

## 3. Security

- Send CSP with a per-request nonce plus the fixed headers from `securityHeaders()`: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`, a `Permissions-Policy` that denies device APIs. (`apps/web/src/security-headers.ts`, `proxy.ts`)
- Send `Strict-Transport-Security: max-age=31536000; includeSubDomains` only when `COOKIE_SECURE=true`. (`security-headers.ts`)
- Session cookie is `httpOnly`, `sameSite: "strict"`, `secure` when `COOKIE_SECURE`, `path: "/"`. (`apps/web/src/lib/server/session.ts`)
- Keep only `sid`, `csrf` and the pending-2FA marker in the cookie; compute permissions per request from the store. (`api.ts`, `api.test.ts`)
- Require header `x-csrf-token` on every POST/PATCH/PUT/DELETE and compare it constant-time (`timingSafeEqual`, equal-length check). (`apps/web/src/lib/server/csrf.ts`, `csrf.test.ts`)
- Wrap every `/api/*` handler except `/api/auth/*` in `withPermission`, and check the permission before reading any data. (`apps/web/src/test/architecture.test.ts`)
- Actor rank: a route that acts on another user (edit, status, password reset, sessions, delete, bulk) refuses with 403 `forbidden` when that user holds a permission the actor lacks (`checkTargetRank` in `apps/web/src/lib/server/mock/rules.ts`, `rankDenied`/`targetRank` in `lib/server/users.ts`); the screen mirrors it with a `BlockedButton` (`rankBlock`/`protection` in `features/users/use-users.ts`). (`users-routes.test.ts` "actor rank", `rules.test.ts`)
- Validate input with zod in the route handler before the guard touches the store; a bad value is 400 `bad_request`. (`api.ts` `handleError`)
- Redirect only to internal paths: reject `//x`, `/\x`, control characters, and anything that normalizes to a protocol-relative URL; never land on `/login` or `/api`. (`packages/ui/src/lib/safe-path.ts`, `safe-path.test.ts`)
- Return generic errors: unknown exceptions are 500 with a fixed message, detail goes to the log only. (`handleError`, `api.test.ts`)
- Answer identically for unknown user, wrong password and LDAP user on password sign-in (`invalid_credentials`), and for `forgot-password` on an unknown email or a throttled request. (`apps/web/src/app/api/auth/auth-routes.test.ts`)
- Re-authenticate before a credential or sign-in identity change: password change, turning 2FA off and a new email on `PATCH /api/me` take the current password (directory password for LDAP; a recovery code for a Google/Apple-only account turning 2FA off), through `reauth()` with one throttle per user. (`apps/web/src/lib/server/sign-in.ts`, `me-routes.test.ts`)
- Sessions end `SESSION_TTL_HOURS` after sign-in or `SESSION_IDLE_MINUTES` without a request; `authOf` removes an ended record, lists and counts prune first. (`apps/web/src/lib/server/session.ts`, `api.test.ts` "session lifetime")
- Rate-limit sign-in: 10/min per IP, 300/min fleet-wide breaker, 5/min per username, then soft backoff per username (3 free failures, then 1 s, 2 s, 4 s … max 60 s, cleared after 15 min quiet or on success). (`apps/web/src/lib/server/ratelimit.ts`, `ratelimit.test.ts`)
- Ignore `X-Forwarded-For` unless `TRUSTED_PROXY=true`. (`clientIp` in `apps/web/src/lib/server/api.ts`)
- Bound every in-memory `Map` (default 10,000 keys) and evict the oldest key on overflow; never clear all. (`ratelimit.ts`)
- Never use `dangerouslySetInnerHTML`. (`architecture.test.ts`)
- The browser calls only same-origin `/api/*` on the Next server, never the backend: every `fetch(`/`api(` literal in client code starts with `/api/`, and no `NEXT_PUBLIC_*API*`/`*URL*` variable exists; `API_BASE_URL` is server env only. `api()` throws at runtime unless the path starts with `/api/`; the static test cannot see non-literal `fetch(` arguments: the `api()` guard covers `api()` calls, and a raw `fetch(` with a non-literal argument is covered only by CSP `connect-src 'self'`. (`apps/web/src/lib/client/api.ts`) (CSP `connect-src 'self'` in `apps/web/src/security-headers.ts`, `architecture.test.ts`)
- Redact `password, token, cookie, code, csrf, otpauth, uri, secret, formToken, phone, email` in logs, top level and one level down, and mask `otpauth://` and `secret=` inside strings. (`packages/shared/src/log-redact.ts`, `apps/web/src/lib/server/logger.ts`, `logger-redact.test.ts`)
- Commit no secret; `gitleaks` scans the tree. (`.gitleaks.toml`)
- Call `recordActivity` in every non-GET handler outside `/api/auth/*`. (`architecture.test.ts`)
- Neutralize CSV cells: prefix `'` when a cell starts with `=`, `+`, `-`, `@` (after optional spaces) or tab/CR. (`packages/ui/src/lib/csv.ts`, `csv.test.ts`)

## 4. Hardening and pentest checklist

A change that touches routes, guards, redirects or exports needs a test for each applicable case before merge.

- Path traversal and URL normalization: `/a/../b`, `%2e%2e`, `%2F` and case variants parse to the page they name. (`proxy.test.ts`, `page-guard.test.ts`, `safe-path.test.ts`)
- Open redirect: `//evil.com`, `/\evil`, `%2F%2Fevil`, `/a/..//evil` land on an internal path or `/`. (`safe-path.test.ts`)
- IDOR: a user requesting an id that belongs to someone else gets 403 or 404, never the record. (`users-routes.test.ts` "a session of someone else or an unknown one is 404", `me-routes.test.ts` "someone else's or unknown is 404")
- Actor rank: a lower-ranked actor (Admin) gets 403 `forbidden` on every action against a higher-ranked user (Superadmin), single and bulk, and nothing changes. (`users-routes.test.ts` "actor rank")
- 403 before read: with a missing permission the handler never runs and the store is not read. (`api.test.ts`)
- Out-of-enum or out-of-range query values are 400 before the guard touches the store; a body's 400 comes before the 404. (`users-routes.test.ts` "rejects … with 400 before guard", `audit-routes.test.ts`, `architecture.test.ts` order rule)
- Mutation without or with a wrong `x-csrf-token` is 403 `csrf`. (`csrf.test.ts`, `api.test.ts`)
- Permission removed or user deactivated mid-session takes effect on the next request. (`api.test.ts`)
- Every route file (any `route.ts` under `app/`, every method including HEAD/OPTIONS) is guarded; the no-guard list is exact; the docs' Permission column matches each handler. (`architecture.test.ts`, `api-contract.test.ts`)
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
- Status uses `StatusChip` plus the card's legend, never color alone. Shareable state (filters, tab, range, page) lives in the URL. Query keys start with the owning module (`users`, `rbac`, `me`, `audit`, `dashboard`), built only in `apps/web/src/lib/shared/queries.ts`. (`queries.test.ts`)
- Every list is server-side: the GET route calls `paginate()` with whitelisted sorters (`sortParam`), the screen uses `useTableQuery` + `DataTable` server mode (sortable headers, page-size select, numbered pagination); page size 15 | 25 | 50 | 100 (default 15), page ≤ 1000 (deeper is 400), `totalCapped` shows "N+"; page, size, sort, search and filters live in the URL (any change but the page goes to page 1, Back undoes it). (`packages/shared/src/contracts/common.ts`, `apps/web/src/lib/server/paginate.test.ts`, `apps/web/src/lib/shared/table-state.test.ts`, `architecture.test.ts` "every GET route that answers a list")
- Status legends live in the card that shows the statuses: `Panel legend={…}` renders the "Status legend" info button in the card header; never a page-level, toolbar or inline legend. (`architecture.test.ts` "StatusLegend is rendered only by Panel", `packages/ui/src/ds/status-legend.test.ts`)
- Every data region has five states (loading in the content's shape, empty saying when data appears, error with retry, stale notice over kept data, data); every async action shows pending on its trigger, announces its result (toast or `role=status`), keeps a recoverable error and returns focus sensibly. (`docs/standards/ui-standard.md` §3)
- Destructive actions confirm through `ConfirmActionDialog` with their impact; an action blocked by a rule is a `BlockedButton` with the reason; everything works by keyboard with a visible focus ring; 404 and forbidden always offer a way back. (`docs/standards/ui-standard.md` §5, `docs/standards/copy-guide.md`)
- One pattern per need in every module (`PageHeader`, server `DataTable`, `Field`, `ConfirmActionDialog`, `BlockedButton`, result toast, one data hook per feature); route handlers run parse → guard → rule → mutate → activity; UI words only from the copy-guide glossary; a new module copies an existing one. (spec "Konsisten", `architecture.test.ts` route checks)
- A page that fails while rendering shows its error inside the shell (`app/(main)/error.tsx`; sign-in pages and the signed-in layout: `app/error.tsx`; `global-error.tsx` only for the root layout), with "Try again" (Next's `retry`), or "Reload page" when a code chunk failed to load (a newer deploy); code loaded on demand (lazy charts, `LazyMount`) sits in a `ChunkBoundary`, so a failed chunk takes down only its panel. (`apps/web/src/components/page-error.test.ts`, `packages/ui/src/ds/chunk-boundary.test.ts`)
- Extend the standard and the `/ds` gallery before inventing a one-off component.
- `PageHeader` is rendered by the route's feature component (loading, error and not-found states included), never by `page.tsx`. (`features/*`)
- A detail screen whose record answers 404 shows `DetailNotFound` (no retry, a link to the list); detail queries use `retryUnlessNotFound`. (`apps/web/src/components/detail-not-found.tsx`, `lib/client/api.ts`)
- Loading, one way per case: a route change → its `loading.tsx` (`RouteSkeleton`); a detail screen without data yet → the same sections via `LoadingShape` + `useDelayedFlag` (shape constant exported by the feature, imported by `loading.tsx`); a list → `DataTable` `loading` from `useTableQuery` (paging keeps rows, busy dim); a small part of a loaded page → `Reveal`. (`apps/web/src/components/route-skeleton.tsx`)
- Action results: success → `toast`; a button action's failure → `toast.error`; a form keeps its failure inline (`role="alert"`) beside the submit; a confirm dialog shows its failure inside the dialog. Every async trigger shows pending (spinner + `aria-busy`/disabled).
- Product name only through `BRAND` (`apps/web/src/lib/shared/brand.ts`): page titles pass their own title (the root layout adds the name), error `source`, logo. (`architecture.test.ts` "product name")
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
- Do not import `zod` into client code that ships in a route's first load. (`docs/standards/ui-standard.md` §5)

## 10. Copy

- All UI text is English, sentence case, no exclamation marks, no emoji. Full rules and glossary: `docs/standards/copy-guide.md`.
- Use glossary terms exactly: user, role, permission, session, activity log, sign-in log, sign in / sign out, one-time code.
- Buttons are verb + object ("Create user"); never "OK", "Yes", "Submit". Errors say what happened, why, and what to do.
- Every disabled action explains why; every empty state says when data appears.
- Avoid: sorry, oops, simply, just, easily, successfully, utilize, in order to, N/A.

## 11. Tests and definition of done

- Write the failing test first for logic, guards and contracts; keep the test next to the module (`*.test.ts`). A guard ships with fixtures that prove it fails on a violation.
- While working, run only the related tests (`bunx vitest related <files>` or `bun run test:changed`); run the full `bun run check` when shared code changed and before the task's final commit, and always in final verification.
- Playwright and other browser artifacts (screenshots, traces, logs) go under `.superpowers/scratch/` (gitignored), never outside the repo.
- Done = `bun run check` passes + the related e2e passes + no banned word (§1) in `apps/**` and `packages/**`.
- A new route, guard or redirect adds its §4 cases.
- A new color, motion value or icon goes through tokens/`icons.ts` first, then the `/ds` gallery.

## 12. Backend later (shared contract)

The API contract is the zod schemas in `packages/shared/src/contracts/*`, published for the backend as JSON Schema in `docs/api/schemas/` with the endpoint table in `docs/api/README.md`. After changing a contract or a route, run `bun run api:schemas` and update the table; `apps/web/src/test/api-contract.test.ts` fails on drift. A Bun or Rust backend must follow them and the rules below.

- Error body: `{ "error": { "code": string, "message": string } }`.
- Error codes (fixed): `unauthenticated` 401, `forbidden` 403, `csrf` 403, `not_found` 404, `bad_request` 400, `duplicate` 409, `rate_limited` 429, `invalid_credentials` 401 (400 when a signed-in user's current password is wrong, so the browser doesn't read it as an ended session), `account_inactive` 403, `invalid_code` 400, `superadmin_locked` 409, `last_superadmin` 409, `self_action` 409, `role_in_use` 409, `ldap_password` 409, `already_enabled` 409, `only_sign_in_method` 409, `internal` 500. (`ERROR_STATUS` in `packages/shared/src/contracts/common.ts`)
- Rate-limited responses (429) send `Retry-After` in seconds.
- Paging query: `page` (1–1000; deeper is 400), `pageSize` (15, 25, 50 or 100; default 15), `q`, `sort` (`field` or `-field`, whitelisted per endpoint). Every list endpoint pages; none answers an unbounded array.
- Paging answer: `{ items: T[]; total: number; page: number; pageSize: number; totalCapped?: boolean }` (`totalCapped` = the count stopped at `total`).
- Bulk answer: `{ done: string[]; skipped: { id: string; code: string }[] }`; skipped rows carry a code, only `done` rows reach the activity log.
- Every POST/PATCH/PUT/DELETE requires header `x-csrf-token`; the token lives in the session and the server hands it to the layout.
- Permissions: `user.{view,create,edit,delete}`, `role.{view,create,edit,delete}`, `permission.{view,create}`, `audit.view`; catalog in `packages/shared/src/permissions.ts`.
- Responses send `Cache-Control: no-store`. (`json()` in `apps/web/src/lib/server/api.ts`)
- The backend is reached only from Next route handlers and server code through `API_BASE_URL` (server env, never `NEXT_PUBLIC_*`); the browser never sees its address, so CORS and cookies stay same-origin. (CSP `connect-src 'self'` in `apps/web/src/security-headers.ts`, `architecture.test.ts`)
