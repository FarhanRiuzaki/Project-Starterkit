# Security change review

8 November 2026. This working tree also contains existing design-system, navigation, date-range, upload and login work. No files were staged, committed or reverted to split those changes. The groups below identify audit changes for review; they are not a claim that every hunk in a listed file belongs to the audit.

## Account consistency

| Files | Audit changes | Regression evidence |
| --- | --- | --- |
| `apps/api/src/modules/auth/{service,index,sessions}.ts` | Recheck account proof under the user lock; serialize reset consumption and forgot recipient checks with credential changes; invalidate pending first-factor challenges; allow transaction-scoped re-authentication stamps. | Lock-staged login, reset, forgot and challenge tests in `auth/tests/integration/auth.test.ts`. |
| `apps/api/src/modules/me/service.ts` | Recheck the authorizing live session and account snapshot before self-service writes. | Stale-password and revoked-session tests in `me/tests/integration/me.test.ts`. |
| `apps/api/src/modules/oauth/{service,providers,exchange}.ts` | Lock/recheck live linking sessions and linked identities; bound token exchange to 10 seconds and 64 KB, refuse redirects, preserve provider wire formats. | Callback race tests in `oauth/tests/integration/oauth.test.ts`; stubbed transport, cancellation, wire-format and Apple client-secret tests in `oauth/tests/unit/transport.test.ts`. |

Review the auto-login identifier changes separately: the `BAD_LOGIN` text, `credentialOk` auto branch, resolved sign-in method, shared login contract and their UI/tests predate this audit. The new locking and reset hunks share the same auth files. No database migration was required for the audit.

## Runtime and packaging

| Files | Audit changes | Verification |
| --- | --- | --- |
| `apps/web/src/lib/server/config{,.test}.ts`, env example comments | Reject production HTTPS without secure cookies, including case-normalized schemes; retain local HTTP support. | Config regression tests. |
| `apps/web/src/{security-headers,proxy}.ts`, `security-headers.test.ts` | Explicit development-only eval allowance for Next debugging; production retains nonce/strict-dynamic without unsafe-eval. | Policy tests, development browser check and production image smoke. |
| `apps/web/Dockerfile`, `scripts/smoke-web-image.mjs` | Include public assets in standalone runtime; smoke an existing image without network access or published ports. | Non-root runtime, login, SVG assets and strict production CSP. |
| Auth layout CSS, `apps/web/tests/e2e/{auth,security}.spec.ts` | Download artwork only for the active theme; browser security regression coverage. | Active-theme request count, anonymous/CSRF/origin/ownership/cache/input checks. Review artwork/layout styling separately. |
| `.dockerignore`, `eslint.config.mjs` | Exclude local agent tooling from build context/lint traversal. | Docker build and zero-warning lint. No agent-tooling contents modified. |

The unrelated dashboard/date filtering, audit filters, shell, component library, palettes, motion, file selection and screenshot changes remain in the working tree. They were exercised by the checks, but are not relabeled as security fixes.

## Dependencies and CI

The root manifest records Bun 1.4.3. Next/eslint-config-next are 16.4.5, Zod is 4.6.7 and Happy DOM is 21.0.4. The lockfile records exact resolutions. CI performs frozen installation and now gates all dependencies with `bun run audit:dependencies`; `audit:production` is available separately.

Two overrides are intentionally limited to their parent paths:

| Parent → child | Resolution | Why and compatibility evidence |
| --- | --- | --- |
| `@esbuild-kit/core-utils` → `esbuild` | 0.25.12 | Removes the affected 0.18.20 copy used by Drizzle's loader. An isolated Bun 1.4.3 install resolved the override, and the ESM loader executed a TypeScript enum fixture under Node 24. Drizzle generation against a scratch copy of all current schemas reported no schema changes; all seven migration/meta file hashes stayed unchanged. |
| `@typescript-eslint/typescript-estree` → `minimatch` | 11.0.1 | Removes the affected 10.2.6 copy. The actual parser's project-service `allowDefaultProject` matching succeeded in the Bun 1.4.3 canary, and repository typecheck/lint passed. Other consumers, including ESLint's older minimatch API and Vite's esbuild, retain their own resolutions. |

These versions cross the parents' declared ranges; compatibility was tested rather than inferred from semver. Remove each override once the parent dependency selects a patched release itself, then repeat frozen install, full audit, lint, schema generation in a disposable copy, checks and build. The old loader still emits Node deprecation warnings; the tested generator works, but this does not promise compatibility with future Node majors.

The [Bun override documentation](https://bun.com/docs/pm/overrides) describes parent-scoped overrides. Both rules were exercised on the repository's pinned Bun 1.4.3, independently of the newer documentation. The selected versions address the [esbuild advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99) and [minimatch advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).

## Review and reproduction

The [audit report](security-performance-audit.md) contains severity, original reproduction conditions, retests and performance measurements. The [staging guide](staging-readiness.md) records local deployment evidence and external checks still pending. Ignored local logs and fixtures are under `.superpowers/scratch/security-perf/`; private rehearsal env values must never be copied into a review, issue or commit.

Review mixed files hunk by hunk before forming commits; an entire-file patch would include earlier product/design work. No audit-only patch was fabricated from an unavailable pre-audit snapshot.

## Subsequent sidebar request

The user then requested standard collapsed-sidebar tooltips and submenu handling. This is a product interaction change,
separate from the security fixes above. `sidebar.tsx` now uses the existing tooltip for leaf labels and the new local
`sidebar-rail-menu.tsx` to compose that same tooltip with the existing deferred dropdown menu for parents. Expanded
tree links and the phone drawer retain their behavior. The navigation menu is non-modal, so it does not hide the
rest of the page from assistive technology. It closes on selection/Escape/outside interaction,
suppresses overlapping tooltips and closes when CSS hides its trigger after expansion or resize.

`tests/e2e/sidebar-rail.spec.ts` covers hover/focus labels, keyboard view selection, current-view marking, Escape focus
return, outside dismissal, preference persistence and touch/resize behavior. The behavior is recorded in the existing
design-system standard. No new dependency or global tooltip style was added.

The full browser run also exposed two stale test assumptions: the artwork test still selected an `img` after the
active-theme CSS-background change, and chunk failure injection matched a symbol removed by production minification.
The tests now check full-bleed background geometry/theme and assert that the chart chunk was actually rejected before
checking its panel fallback/reload. Both targeted retests passed; screenshot baselines were not updated for these fixes.
