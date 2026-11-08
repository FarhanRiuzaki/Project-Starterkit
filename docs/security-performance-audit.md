# Security and performance audit

Audit date: 8 November 2026. Scope: this repository, isolated local test databases, local browser sessions and locally built containers. Existing design-system work was retained. No third-party penetration test was performed. Publication and a persistent local Docker deployment were subsequently authorized separately from the audit.

The audit reproduced and fixed concurrency flaws in sign-in, reset links, re-authentication and OAuth linking. It also updated vulnerable dependency versions, enforced secure cookies for production HTTPS, repaired standalone asset packaging and removed a redundant login image request. These results establish tested behavior for the cases below; they are not a guarantee that the application has no other vulnerabilities.

## Runtime and architecture

| Area | Observed implementation |
| --- | --- |
| Package manager | Bun; local 1.4.4, CI and Docker 1.4.3. `packageManager` now records `bun@1.4.3`. Both versions ran API tests successfully. |
| Web | Next.js App Router, 16.3.8 before and 16.4.5 after; React 19.3.0; Node 24.21.0 locally. The newly built Linux image runs Node 24.22.2. Next is not deployed on Bun. |
| API | Elysia 1.4.30 on Bun 1.4.3 in production; Drizzle 0.45.4 over Bun SQL. |
| Database | PostgreSQL 18 in Compose/CI; local tests used PostgreSQL 18.6. |
| Validation and tests | Zod 4.6.5 → 4.6.7; Happy DOM 20.14.5 → 21.0.4; Vitest 5.0.3; Playwright 1.63.0; TypeScript 6.0.3. |
| Build | Next standalone output; Bun installs/build orchestration, Node executes Next. Exact dependency pins and `bun.lock`; frozen install in CI and Docker. |

`apps/api/src/index.ts` boots the HTTP server, pool and janitor. `app.ts` installs kernel plugins and the module registry. Modules are health, auth, oauth, me, users, rbac, audit and dashboard. PostgreSQL owns sessions, OAuth state, reset tokens and shared rate limits; they are not process-local limiters.

The web is a BFF. `src/proxy.ts` stamps a per-request CSP nonce and trusted pathname; it does not replace authorization. Page guards obtain current API permissions. The catch-all Route Handler forwards `/api/x` to `/v1/x`. Dedicated auth Route Handlers manage sealed cookies, same-origin checks and sign-in transitions. No `use server` actions or `use cache` functions were found in application source.

The browser calls same-origin `/api/*`. Server modules use `server-only`; architecture tests enforce client/server and module boundaries. React Query keys are centralized and server prefetch uses the same API reads. Private backend fetches use `cache: no-store`; per-request React memoization does not create a shared user cache.

There is no backend upload endpoint. The shared upload component validates local file selection for presentation; it is not a server upload security boundary. This starter kit implements account ownership and RBAC, not multi-tenant isolation.

External integrations are configured LDAP, SMTP and Google/Apple OAuth. Tests use mock directories/providers, local signing keys and stubbed token responses. No real provider, directory or mail server was attacked or contacted by the pentests.

## Findings and fixes

“Reproduced” means a test against the original behavior returned the forbidden result. Row locks in these tests control the ordering of concurrent local transactions; an attacker is not assumed to have database access. The real prerequisite is overlapping an otherwise legitimate account change with an in-flight request using old proof.

| ID | Risk | Evidence and location | Impact and status |
| --- | --- | --- | --- |
| S1 | High | `auth/service.ts`, login read account state before password verification and session/challenge creation. Two lock-staged tests returned 200 after the password changed or 2FA was enabled. | Old proof could create a session or skip newly enabled 2FA. **Fixed and retested:** lock/recheck account before committing sign-in or a challenge. |
| S2 | High | `auth/service.ts`, reset spent a token before the later credential transaction. A waiting reset returned 200 after an administrative credential replacement and link revocation. | Reset could overwrite a newer password. **Fixed and retested:** claim the token once under the user lock, hash outside the transaction, recheck proof under the lock before writing. |
| S3 | High | `auth/service.ts`, forgot read an email before inserting a reset link. A staged email change still produced a new link mailed to the previous address. | A previous mailbox holder could receive a usable reset link after the identity change. **Fixed and retested:** recheck recipient/account eligibility under the same user lock as identity changes. |
| S4 | High | `me/service.ts`, password change verified a snapshot before waiting on the user lock. The old-password request returned 200 and overwrote the replacement hash. | Stale re-authentication could replace newer credentials. **Fixed and retested:** account proof and the authorizing live session are rechecked inside the write transaction. The same rule covers email and 2FA changes and re-authentication stamps. |
| S5 | High | `oauth/service.ts`, callback checked the linking session before its transaction. A waiting callback returned 200 after that session was deleted. | A revoked browser session could still attach a new sign-in identity. **Fixed and retested:** lock user, then verify/lock the live linking session before insertion. Provider login also rechecks that the identity remains linked under the user lock. |
| S6 | Medium | `me/service.ts`, a profile update waiting on the user row returned 200 after revocation of its authorizing session. | An already admitted mutation could outlive revocation. **Fixed and retested:** shared self-service transaction checks cover profile, credentials, connections and session termination. |
| S7 | Medium, configuration | `web/lib/server/config.ts` accepted production HTTPS with `COOKIE_SECURE=false`; a regression test demonstrated acceptance. | The sealed cookie lacked the transport restriction and HSTS was disabled. **Fixed and retested:** this combination now fails validation; local HTTP production tests remain supported. TLS termination is still deployment configuration. |
| S8 | Conditional upstream Critical/High | Lockfile contained affected Next and Zod versions. The maintainer advisories describe image optimization, Cache Components, Server Actions and oversized validation inputs. | **Dependency versions patched.** No local RCE was demonstrated. This app disables image optimization and has no Cache Components/Server Actions; request bodies are capped. The update also protects future starter-kit use. |
| S9 | High in affected test tooling | Happy DOM 20.14.5 had code execution/SSRF/cookie advisories. It is a development dependency used for trusted component tests. | **Patched to 21.0.4; component tests pass.** No hostile HTML execution experiment was performed. |
| S10 | Medium, upstream transport hardening | Arctic token exchange had no application deadline, followed redirects, and read response JSON without a body cap. Stub tests observed no abort and `redirect=follow`. | **Fixed and retested:** the existing Google/Apple exchange wire formats now use a 10 s abort signal, refuse redirects and cap responses at 64 KB. Provider failures log only their type. Apple client-secret signature/claims are verified against a local test key. |
| D1 | Low, deployment correctness | `apps/web/Dockerfile` copied standalone/static output without `public`. Isolated standalone runtime returned 404 for login artwork; the old image also failed its public-asset smoke check. | **Fixed:** copy `public` into the runtime. New image smoke test returns 200 for both SVG assets and runs as non-root. |
| P1 | Low, performance | Browser network entries showed both light/dark artwork downloaded on a light login, totaling 182,532 bytes. | **Fixed:** CSS chooses the active theme's background; regression tests verify one request in both themes. Light login transfers 91,269 fewer artwork bytes. |
| R1 | Moderate upstream, development only | Initial full audit reported esbuild 0.18.20 through drizzle-kit → esm-loader/core-utils, and minimatch 10.2.6 through TypeScript ESLint. | **Fixed in the local follow-up:** parent-scoped overrides select esbuild 0.25.12 and minimatch 11.0.1. Bun 1.4.3 resolution, actual parser matching, ESM loader and schema-generation compatibility were exercised before accepting the cross-range overrides. Full and production audits now report no vulnerabilities; see the [change review](security-change-review.md). |

Relevant maintainer sources: [Next image optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [Next Cache Components advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), [Next Server Actions advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r), [Happy DOM advisory](https://github.com/capricorn86/happy-dom/security/advisories/GHSA-834v-8h66-3h79), [esbuild advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99), [minimatch advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249). The registry advisory identifies Zod versions below 4.6.6; the selected 4.6.7 no longer reports that advisory.

### Local reproductions and regression coverage

Run API tests from `apps/api`; the preload refuses a test database whose name does not end in `_test`. Each test resets dummy data. Run these suites serially because they share that database.

- `bun test src/modules/auth/tests/integration/auth.test.ts`: S1–S3, reset single use, pending first-factor invalidation, credential replay, unknown accounts, directory timing parity and safe bounded throttling.
- `bun test src/modules/me/tests/integration/me.test.ts`: S4/S6, own/other session ownership, re-authentication budget, password/email/2FA changes.
- `bun test src/modules/oauth/tests/integration/oauth.test.ts`: S5, unlinked identities, revoked linking sessions, single-use state, binding, provider mixups and signed local id_tokens.
- For the concurrency reproductions: hold the user row with `holdTx`, start the HTTP handler, wait for the database lock waiter, apply the credential/session/identity change in the holder and commit. The original schedules allowed the prohibited effects. Fixed requests prevent those writes or mail; forgot still returns its uniform 200 response. The exact schedules are executable tests rather than timing-dependent load attacks.
- `bun test src/modules/oauth/tests/unit/transport.test.ts`: deterministic short-deadline stalled-provider test and oversized-response cancellation; network calls are stubbed. An additional native socket check against loopback verified aborting a stalled response body on Bun 1.4.3 and 1.4.4.
- Web config test: `bun run --filter @starterkit/web test -- config.test.ts` exercises S7 and retains local HTTP behavior.
- `tests/e2e/security.spec.ts` exercises anonymous API access, two-user response isolation, cache headers, direct mutation without CSRF, hostile Origin, other-user session deletion, SQL-shaped search, out-of-range paging, a 70 KB request, production CSP and active-theme artwork loading.
- `node scripts/smoke-web-image.mjs <local-image-tag>` checks an existing local image with network disabled and no published port. It verifies the non-root process, standalone login and both public SVGs. It does not pull an image.

## Security boundaries retained

The inspected and tested protections include constant-time internal-token/CSRF comparisons; sealed HttpOnly SameSite Strict sessions; API-side absolute and idle expiry; permissions refreshed per request; transaction-scoped role escalation/actor-rank checks; escaped directory filters; TLS requirements for production LDAP/SMTP; OAuth state/binding/PKCE/nonce/signature validation; one-time TOTP/recovery codes; and hashed single-use reset tokens.

Inputs are validated server-side, IDs and sort keys are whitelisted, and Drizzle binds values. Both BFF and API cap request bodies at 64 KB, including streamed bodies. CSV formula protection remains in the export path. Fixed public error responses and redaction tests cover driver errors, credentials, mail replies and auth secrets. No new auth method, database, cache, upload service or runtime dependency was introduced.

Production CSP remains nonce-based with `strict-dynamic`, no `unsafe-eval`, and dynamic rendering. The browser test checks that the rendered production page works with that policy. Private JSON and authenticated documents are `no-store`; two independent browser users receive distinct `/api/me` identities and an anonymous context remains unauthorized.

The PostgreSQL limiter is shared across API processes and atomically reserves attempts. Its UNLOGGED tables intentionally reset after a database crash. Without a sanitizing trusted reverse proxy the web reports an unknown client address, so per-IP limits are skipped; account and fleet limits remain active. This is not an in-memory limiter, and adding an in-memory fallback would weaken multi-instance consistency.

### Secrets and build artifacts

A redacted gitleaks scan of Git history reported zero findings. A broader filesystem scan reported 43 generic-key matches confined to ignored local env files, nested local worktree env files and generated Next signing/cache metadata; these are not evidence of a committed credential leak. No values are included here. `.dockerignore` now also excludes local agent tooling/worktrees from the build context.

A byte comparison against all 11 matching secret configuration entries (10 distinct values) found no matches in 103 generated client asset files. No public source map files were emitted. This check covers those configured values, not every conceivable future secret. The existing env examples remain non-secret templates; no local secret was changed or rotated.

## Performance measurements

Browser lab: local Chromium 153.0.8010.12 through Playwright/CDP, production Next build on port 3123 and isolated API on 4123, desktop 1440 × 900, new context with cache disabled per sample, 4× CPU slowdown, 40 ms emulated network latency, 1,250,000 B/s download and 625,000 B/s upload. Five sequential samples per route. Medians below use the final idle-machine rerun; an additional after-run overlapped checks and was excluded. Browser and database were warmed by setup; these are cold browser contexts, not cold server starts.

| Measurement | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| Light login artwork requests / encoded bytes | 2 / 182,532 B | 1 / 91,263 B | One unnecessary 91,269 B dark SVG removed. |
| Login lab LCP | 328 ms | 320 ms | Small variation; no material LCP speedup claimed. |
| Dashboard lab LCP | 708 ms | 684 ms | Small variation; not proof of a faster backend. |
| Login / dashboard CLS | 0 / 0 | 0 / 0 | No layout shift observed in these samples. |
| Login lab TTFB | 5.7 ms | 5.8 ms | Essentially unchanged local response time. |
| Dashboard lab TTFB | 10.5 ms | 9.5 ms | Local lab variation. |
| Login first-load JS, build budget | 189.7 kB gzip | 189.4 kB gzip | Dependency/build change; not a new lazy-loading strategy. |
| Largest route first-load JS | 249.9 kB gzip | 246.7 kB gzip | `/users/[id]`; every route remains under 250 kB. |

The existing bundle-budget script measures the initial chunk graph; browser resource totals also include chunks requested after hydration, so the two should not be compared as the same metric. The Next version changed between measurements. No RUM, CrUX, real-device INP or sustained external load benchmark was collected. These samples do not establish real-user percentiles.

The initial cached production build completed in 2.961 seconds; the final cached build passed in 2.453 seconds. This is a baseline observation, not a portable build benchmark; the dependency upgrade invalidates caches and the Docker build also includes network installation. No build-time improvement is claimed.

Database paging, caps, indexed sorts, statement timeouts, connection pooling and concurrency tests passed. No measured application-query bottleneck justified changing queries, introducing a cache, memoizing more components or bundling the API. The security fixes deliberately add transaction checks; hashing and external directory work stay outside user row locks.

## Verification results

- Initial `bun run check`: passed, 1,416 tests; initial production build and route budget passed.
- Final host `bun run check`: passed, 1,429 tests (UI 674, shared 10, web 248, API 497); typecheck and zero-warning ESLint gate passed after the development-tooling overrides. `git diff --check` passed.
- Targeted new security reproductions failed on original behavior, then passed after fixes. The additional pending-proof and unlink regressions also pass.
- Pinned Bun 1.4.3 API run: all 497 tests passed; local Bun 1.4.4 also passed all 497. The Linux API image built successfully and its isolated non-root smoke returned health 200 and internal-token rejection 401 for both a private route and an encoded health path. No live database was attached to that image smoke; database behavior is covered by the integration suites.
- Dependency audit after the follow-up: no reported vulnerabilities in the full audit (672 packages) or production audit (227 packages) on local Bun 1.4.4. CI now runs the full `bun run audit:dependencies` gate after frozen install; `audit:production` retains the runtime-only view. Pinned Bun verification is recorded below.
- Linux web Docker build: frozen Bun 1.4.3 install, Next 16.4.5 production build and Node standalone runtime passed. Image smoke: non-root, login and both artwork assets passed.
- Related browser suites: 15 desktop tests passed (`auth`, `permissions`, `reauth`, `security`). The auth suite additionally exercises light/dark phone and desktop login layouts and accessibility. Real mobile/WebKit behavior was not tested here.

## Remaining deployment and integration requirements

1. Terminate HTTPS at the reverse proxy, set the correct public `APP_URL` and `COOKIE_SECURE=true`, and keep the API on a private network. Set `TRUSTED_PROXY=true` only when that proxy overwrites forwarding headers; account for the right-most XFF hop used here. Public HTTP remains supported for local Compose/E2E and is not a secure internet deployment.
2. Configure real LDAP, SMTP and OAuth credentials and verify them in an authorized staging environment. The tests do not prove live provider connectivity, delivery or organization-specific directory policy. The token exchange now has its own 10 s deadline and response cap; real provider connectivity and organization policy still require staging validation. Arctic 3.7.0 remains responsible for authorize URLs; jose verifies id_tokens and signs Apple client secrets.
3. Retire the scoped overrides in R1 when the parent tools adopt patched versions themselves, repeating their compatibility checks. The old ESM loader emits Node deprecation warnings despite successful generation on Node 24. CI action tags and base-image tags are still mutable; organization policy may require digest/SHA pinning and automated updates. OS-image CVEs and external ingress/TLS configuration were not scanned.
4. Before adding server uploads, validate bytes/size/type and authorization on the server; choose storage, download headers, lifecycle and scanning appropriate to the accepted formats. Before adding tenants, add tenant-scoped contracts, queries and ownership tests. Neither requirement is supplied by the client upload component or current single-organization RBAC.
5. Establish production RUM and representative data/load tests before capacity or percentile claims. The web bundle budget has limited headroom on user detail pages; retain the gate when adding modules. The API image still installs the UI package's dependency graph even though API source imports only its pure helpers; image-size restructuring was not attempted without a measured runtime benefit.

Official behavior was checked against the installed Next 16.3.8/16.4.5 documentation, the exact installed Arctic 3.7.0 and jose 6.2.12 implementations and [Next standalone output documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/output). The runtime image explicitly copies `public` and static output as required there. [Bun install documentation](https://bun.com/docs/pm/cli/install) describes frozen installs and blocked dependency lifecycle scripts; `bun pm untrusted` still lists the resolver postinstall as blocked. It was not granted trust. [Bun audit documentation](https://bun.com/docs/pm/cli/audit) describes the production filter; its command was exercised on the pinned runtime.

## Local Docker follow up

The local development stack is running from this checkout through `docker-compose.dev.yml` on port 3000, with Node
24.22.0, Bun 1.4.3 and Next 16.4.5. The old host Next 16.3.8 process was stopped, the stopped container's obsolete
checkout bind mount was replaced, and only its generated Next cache was cleared. Database and state volumes were
retained; no pending migrations were found.

The original development browser emitted React's eval/CSP debugging error. Development now explicitly allows
`unsafe-eval`, following the installed Next documentation; production does not. The new policy regression test,
full check inside the running container (1,429 tests), a rebuilt production image and its strict-CSP smoke passed.
Login, dashboard, users, profile, the design-system page and authenticated API reads returned 200 without browser
console/page errors. API/database readiness returned 200. The development stack remains running.

## Local staging preparation and review

The user confirmed that no external staging exists and authorized local preparation only. A separate production-style Compose project passed migration/bootstrap, health checks, standalone browser login, dummy role/user CRUD, anonymous/CSRF rejection and logout revocation with no browser page errors. The API used a DML-only database role; only the web was bound to loopback. No real LDAP, SMTP or OAuth provider was exercised. Local HTTP did not validate ingress TLS or Secure-cookie transport. See the [staging readiness guide](staging-readiness.md) for evidence and pending integration checks.

The [change review](security-change-review.md) groups audit changes and identifies files shared with earlier design/login work. Nothing was staged, committed or reverted to manufacture an artificial split. Tooling overrides were first tested in an isolated Bun 1.4.3 canary; schema generation against copied schemas/migrations reported no changes and left all seven migration/meta files unchanged.

The final lockfile also passed a real frozen install in the Linux Bun 1.4.3 stack. Its full audit checked 672 packages
with no reported vulnerabilities; the production audit checked 227 with none. Resolving from the actual Drizzle
loader and TypeScript parser parents confirmed esbuild 0.25.12 and minimatch 11.0.1. A second scratch schema generation
inside Linux passed with all seven migration/meta hashes unchanged. Full checks passed again in Linux (1,429 tests).
The API and web images were rebuilt with frozen Bun 1.4.3 installs, and their non-root/health/token and
login/assets/strict-CSP smokes passed. The production-style Compose browser flow was repeated on those images and
passed. That temporary stack was then stopped without deleting its volume; development port 3000 stayed running.

The first full Linux browser run had 287 passes, 94 skips and two failures from stale test assumptions: selecting the
removed artwork `img` and matching a minified-away chart symbol when injecting a chunk failure. The corrected tests
both passed a targeted retest. No screenshot baseline was changed. One subsequent Playwright startup build failed
typecheck while development was restarting, without a diagnostic in its list reporter. A serial production build
then passed; the exact cause of that startup failure was not established. Keep generated Next files stable while
starting verification builds.

The user additionally requested standard collapsed-sidebar tooltips and submenu handling. That product change uses
the existing tooltip and deferred menu primitives, with no new dependency. Its light/dark development browser checks
and full Linux check passed; the updated web image and strict-CSP/assets smoke also passed. The browser timing samples
above were collected before this later sidebar request, so no new LCP/TTFB improvement is inferred from it.

The corrected full Linux browser run completed with **289 passed, 94 skipped, zero failures** across desktop,
tablet and mobile Chromium projects. Skips are the suite's explicit viewport/interaction conditions, not muted
failures. This build preceded the subsequent sidebar request. After that request, a fresh production build passed
seven targeted tests covering security, artwork, existing UX flows and the new collapsed-sidebar keyboard/touch/
resize behavior. An accessibility check while the flyout is open exposed the shared menu's default modal behavior;
this navigation instance now explicitly uses `modal={false}`, and the check passes. Standard tooltip exit animation
also required name-scoped test locators, and keyboard selection now waits for the intended item's focus before Enter.

The final sidebar build passes the 250 kB budget on all 18 routes: largest route **247.1 kB gzip**, login **189.4 kB**.
The sidebar adds approximately 0.4 kB versus the 246.7 kB audit build; this is measured bundle overhead, not a claimed
runtime speedup. Its Linux web image build and non-root/login/public-assets/strict-CSP smoke passed again. The API
image and local production integration evidence above are unchanged by this client navigation revision. Light/dark
sidebar screenshots were inspected; no screenshot baseline was regenerated.
