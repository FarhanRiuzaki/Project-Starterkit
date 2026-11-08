# Staging readiness

8 November 2026. No external staging environment exists yet. The authorized scope is local applications and repository-owned dummy resources. This guide records the production-style local rehearsal and the configuration needed for a later staging environment; it does not authorize external testing or deployment.

## Local rehearsal

The existing production Compose stack was run as the separate project `starterkit-stage-rehearsal`, using locally built `starterkit-api:audit` and `starterkit-web:audit` images. It used its own PostgreSQL volume, random temporary secrets and dummy bootstrap account. Only the web was published, on `127.0.0.1:3001`; the API and database had no host-published ports. The normal development stack on port 3000 and its database were retained.

The private environment and image/loopback override were stored under the gitignored `.superpowers/scratch/security-perf/staging/` directory; the env file has mode 0600. Never print resolved Compose configuration or environment values into logs. Use `docker compose ... config --quiet` for validation.

Observed results:

- Migration and system bootstrap exited successfully; API, database and web became healthy.
- The API database role was neither superuser nor role/database creator, had no schema CREATE privilege, and had the expected table DML permissions.
- The browser signed in through the real standalone BFF/API/database path. It created, updated and deleted a dummy role and user; the records were removed at the end.
- Anonymous access and mutation without CSRF were denied. Logout succeeded and subsequent private access was denied.
- The session cookie was HttpOnly and SameSite Strict. Production CSP retained strict-dynamic and no unsafe-eval; no browser page errors were observed.
- Provider links were absent with optional providers unconfigured. No LDAP, OAuth or mail-delivery request was sent. SMTP pointed at an unavailable loopback address only to satisfy production configuration; successful boot is not evidence of mail delivery.

This rehearsal intentionally used local HTTP with `COOKIE_SECURE=false`. It does not validate HTTPS, Secure cookie transport, real ingress forwarding or certificate renewal.

## Configuration for an authorized staging environment

Start from `.env.compose.example`; keep the filled file outside version control. `docker-compose.yml` passes an explicit allow-list to each service.

| Boundary | Configuration and acceptance check |
| --- | --- |
| Public origin | Set the actual HTTPS `APP_URL` and `COOKIE_SECURE=true`. Verify redirects, nonce CSP, Secure/HttpOnly/SameSite cookies, HSTS, and the browser's complete sign-in/sign-out flow through the real ingress. |
| Reverse proxy | Set `TRUSTED_PROXY=true` only if the proxy overwrites forwarded headers. Verify canonical origin and right-most-hop client-IP behavior. Without trusted forwarding, per-IP limits are skipped for unknown IPs; account and fleet limits still apply. |
| Internal API | Keep port 4000 private. Share a random `INTERNAL_API_TOKEN` only between web and API. Confirm private routes reject a missing/wrong token and health checks do not expose application data. |
| Database | Use a schema-owner `MIGRATION_DATABASE_URL` only for migrations/bootstrap, and a DML-only `DATABASE_URL` for the API. Back up before applying migrations; do not reset staging or reuse development/test credentials. |
| Session/encryption | Generate independent `SESSION_SECRET` and base64 32-byte `DATA_ENCRYPTION_KEY`. Decide secret storage, backup and rotation procedures before real accounts. Rotation can invalidate sessions or make encrypted TOTP data unreadable; it requires an explicit recovery plan. |
| LDAP | Supply directory URL, bind identity/secret, base DN and approved user filter. Production requires LDAPS or enforced STARTTLS. With an authorized dummy directory account, verify successful/failed NIP login, timeout, certificate trust and lockout policy. Do not test guesses against real employees. |
| SMTP | Supply `MAIL_FROM` and an authenticated TLS SMTP URL (`smtps://` or enforced STARTTLS). With an owned dummy mailbox, verify reset/invitation delivery, safe links, expiry and single use. Local mock/unit tests do not establish deliverability. |
| Google/Apple | Configure all keys for a provider or leave it disabled. Register exact `APP_URL/api/auth/oauth/<provider>/callback` redirect URIs. With owned dummy identities, verify linking after recent proof, callback, unlinking, revoked sessions and rejection of an unlinked identity. Mock flags are refused in production. |
| Bootstrap | Set `SEED_SUPERADMIN_*` only in the migration service. Bootstrap runs once while no active Superadmin exists. Confirm the first account securely, then remove the bootstrap password from long-lived deployment configuration. |
| Operations | Decide backup/restore, retention, monitoring, certificate renewal, image/action pinning policy and rollback ownership. Audit-row retention and process health are implemented; operational readiness has not been established by a local smoke test. |

## Local verification commands

Run from the repository root. These checks use isolated `_test`/`_e2e` databases where appropriate:

```sh
bun install --frozen-lockfile
bun run audit:dependencies
bun run audit:production
bun run check
NEXT_DIST_DIR=.next-e2e bun run build
NEXT_DIST_DIR=.next-e2e bun run budget
bun run e2e
```

Use the pinned Bun 1.4.3 and Node 24 paths in Docker/CI. Keep production `.next-e2e` output separate from a running dev server's `.next`. For container packaging, build local images and run `node scripts/smoke-web-image.mjs <local-web-image-tag>`; that smoke intentionally uses no network and proves no database/provider connectivity.

For a new local production rehearsal, use a distinct Compose project and fresh private env values. Override the web port to loopback and the image tags explicitly. Validate with `config --quiet`, then `up -d --no-build` after building the selected images. The isolated project's `down` stops it without deleting its database volume; never use a broad volume prune or reset the development database to clean up a rehearsal.

Before external validation, record the permitted URL, dummy accounts, provider resources and scope. No external pentest is implied by these local results.
