# Starterkit monorepo — fase 1 frontend: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo baru berisi design system Bilik yang bersih dari domain JumpServer, plus layar auth, RBAC, user
management, dan audit log yang berjalan di atas API mock, plus aturan kerja Bilik dalam bentuk `AGENTS.md` dan tes
penjaga.

**Architecture:** Bun workspaces. `packages/ui` = token, primitif shadcn/Radix, motion, komponen DS, chart (source-only,
di-transpile Next; tidak mengimpor `apps/`). `apps/web` = Next.js 16 App Router: shell, fitur, route handler `/api/*`
yang melayani store mock di memori. Lapisan dan pola mengikuti Bilik (`page.tsx` tipis → `features/<domain>` → hook
React Query → `fetch('/api/...')` → route handler: zod → `withPermission` → store).

**Tech Stack:** Bun 1.4.3 (package manager + workspaces), Node 24 (runtime Next), Next 16.3.8, React 19.3.0, Tailwind
4.3.3, Radix 1.6.7, TanStack Query 5.104.0, zod 4.6.5, iron-session 9.0.1, motion 14.0.0, recharts 3.8.0, vitest 5.0.3,
Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-10-19-fe-starterkit-design.md` (baca dulu; plan ini berargumen dari sana).

Singkatan path sumber: `BILIK` = `/Users/riuzaki/Private Space/Sunny Go/PROJECT-APPS/bilik-studio/apps/ws-console`,
`BILIK_DOCS` = `.../bilik-studio/docs`, `RECON` = `/Users/riuzaki/Private Space/Sunny Go/PROJECT-APPS/starterkit-laravel`,
`ROOT` = `/Users/riuzaki/Private Space/Sunny Go/PROJECT-APPS/project-starterkit-monorepo`.

## Global Constraints

- `BILIK` dan `RECON` hanya dibaca; tidak ada satu file pun di sana yang diubah.
- Versi dependensi = versi persis dari `BILIK/package.json`. Tidak menambah dependensi runtime baru; dependensi baru
  apa pun wajib versi persis. Tidak ada aturan umur minimum rilis (dihapus pemilik 2026-10-19).
- Semua copy UI berbahasa Inggris (`BILIK_DOCS/console-copy-guide.md`).
- Warna hanya lewat token di `packages/ui/src/styles/tokens.css`; hex literal hanya di blok `:root` dan `.dark`.
- Kata terlarang di `apps/**` dan `packages/**` (selain `package.json`/lockfile): `jumpserver|jms|squid|egress|prometheus|loki|bifrost|bilik|tibsdev|bankmega|workspace|koko|megacode`
  (case-insensitive). Ditegakkan oleh `apps/web/src/test/no-domain.test.ts` (Task 3).
- `packages/ui/src/**` tidak boleh mengimpor dari `apps/` atau alias `@/`; import internal package pakai path relatif.
- Desktop-first seperti Bilik (`BILIK_DOCS/console-ui-standard.md` §0).
- Setiap commit diakhiri baris: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Kontrak bersama (dipakai banyak task)

Nama-nama ini dipakai di lintas task; jangan diganti nama.

- Permission (RECON-style): `user.{view,create,edit,delete}`, `role.{view,create,edit,delete}`,
  `permission.{view,create}`, `audit.view`. Tipe `PermissionName`. Katalog di `apps/web/src/lib/shared/permissions.ts`.
- Role seed: `Superadmin` (semua permission, terkunci), `Admin` (semua kecuali `role.*` dan `permission.*`), `Viewer`
  (semua `*.view` kecuali `permission.view`).
- Bentuk error: `{ error: { code: string; message: string } }`. Kode tetap:
  `unauthenticated`(401) `forbidden`(403) `csrf`(403) `not_found`(404) `bad_request`(400) `duplicate`(409)
  `rate_limited`(429) `invalid_credentials`(401) `account_inactive`(403) `invalid_code`(400) `superadmin_locked`(409)
  `last_superadmin`(409) `self_action`(409) `role_in_use`(409) `ldap_password`(409) `internal`(500).
- Paging: query `page` (≥1), `pageSize` (10|25|50|100, default 25), `q`, `sort` (`field` atau `-field`); jawaban
  `Page<T> = { items: T[]; total: number; page: number; pageSize: number }`.
- Aksi massal: jawaban `{ done: string[]; skipped: { id: string; code: string }[] }`.
- Mutasi (POST/PATCH/PUT/DELETE) wajib header `x-csrf-token`; token ada di session dan dikirim server ke layout.

## Review Focus

1. `?next=` di login/OAuth berisi URL eksternal (`//evil.com`, `/\evil`, `%2F%2Fevil`) → selalu mendarat di path
   internal atau `/`. Tes: Task 6 (`afterSignIn`, port `safe-path.test.ts`).
2. Role diedit (permission dicabut) atau user dinonaktifkan saat sesinya masih hidup → request berikutnya 403/401;
   permission dihitung per request dari store, tidak disimpan di cookie. Tes: Task 5.
3. Login: user tak dikenal vs password salah vs user LDAP lewat metode password menghasilkan jawaban identik
   (`invalid_credentials`, status sama); `forgot-password` untuk email tak dikenal = jawaban sukses yang sama. Tes: Task 6.
4. Sesi yang baru lolos password tapi belum lolos 2FA tidak bisa memanggil API apa pun selain `/api/auth/2fa` dan
   `/api/auth/logout`. Tes: Task 6.
5. Aksi massal berisi diri sendiri atau Superadmin aktif terakhir → baris itu `skipped` dengan kode, sisanya `done`, dan
   activity log hanya mencatat yang `done`. Tes: Task 4 dan Task 9.

---

### Task 1: Kerangka monorepo + primitif `packages/ui`

**Files:**
- Create: `ROOT/package.json`, `ROOT/bunfig.toml`, `ROOT/.gitignore`, `ROOT/.editorconfig`, `ROOT/tsconfig.base.json`,
  `ROOT/eslint.config.mjs`
- Create: `ROOT/packages/ui/{package.json,tsconfig.json,vitest.config.ts}`
- Create (port): `packages/ui/src/styles/{tokens.css,base.css}` dari `BILIK/src/styles/tokens.css` dan
  `BILIK/src/app/globals.css` (bagian non-Tailwind-entry), `packages/ui/src/ui/*` dari `BILIK/src/components/ui/*`,
  `packages/ui/src/motion/*` dari `BILIK/src/components/motion/*`, `packages/ui/src/lib/cn.ts` dari
  `BILIK/src/lib/shared/cn.ts`
- Create: `ROOT/apps/web/{package.json,tsconfig.json,next.config.ts,postcss.config.mjs,vitest.config.ts}`,
  `apps/web/src/app/{layout.tsx,page.tsx,globals.css,fonts.ts}`
- Test (port): `packages/ui/src/styles/tokens.test.ts` (dari `BILIK/src/test/tokens.test.ts`),
  `packages/ui/src/lib/cn.test.ts`, `packages/ui/src/motion/*.test.ts`, `packages/ui/src/ui/*.test.ts`

**Interfaces:**
- Produces: package `@starterkit/ui` dengan `exports`: `./ui/*` → `./src/ui/*.tsx`, `./motion` → `./src/motion/index.ts`,
  `./lib/*` → `./src/lib/*.ts`, `./styles/*` → `./src/styles/*`. (`./ds`, `./charts` ditambah Task 3.)
- Produces: package `@starterkit/web`; alias `@/*` → `apps/web/src/*`.
- Produces: script root `dev`, `build`, `typecheck`, `lint`, `test`, `check` (= typecheck + lint + test), semua lewat
  `bun run --filter`.

- [ ] **Step 1:** `git init` di `ROOT` (folder sudah berisi `docs/`). Tulis `package.json` root: `"private": true`,
  `"workspaces": ["apps/*", "packages/*"]`, script di atas. `bunfig.toml`: `[install] exact = true`. `check-dep-age.mjs` Bilik
  tidak dibawa.
- [ ] **Step 2:** Port primitif ke `packages/ui/src` dengan import internal relatif (`../lib/cn`), bukan `@/`. Port tes
  primitif & motion & `tokens.test.ts` (ubah path baca CSS). Ganti `@/lib/shared/cn` → relatif.
- [ ] **Step 3:** `apps/web`: `next.config.ts` = `BILIK/next.config.ts` + `transpilePackages: ["@starterkit/ui"]`;
  `globals.css` = entry Tailwind 4 yang `@import` `@starterkit/ui/styles/tokens.css` dan `base.css`, plus
  `@source "../../../packages/ui/src";`. `layout.tsx` dan `fonts.ts` dari Bilik (tanpa metadata/brand Bilik).
  `page.tsx` sementara: satu `Button` dari `@starterkit/ui/ui/button`.
- [ ] **Step 4:** `eslint.config.mjs` root = `BILIK/eslint.config.mjs` minus blok `server/**/*.cjs`, ignores tambah
  `**/.next/**`. tsconfig: `strict`, `noUncheckedIndexedAccess` seperti Bilik.
- [ ] **Step 5:** Jalankan `bun install && bun run check && bun run build`.
  Expected: semua lulus; `tokens.test.ts` hijau; build Next sukses.
- [ ] **Step 6:** Commit `chore: scaffold bun monorepo with ui primitives, tokens, motion`.

---

### Task 2: Aturan kerja untuk AI dan manusia (`AGENTS.md` + `docs/standards`)

Dikerjakan sekarang supaya implementer task berikutnya ikut aturannya. Tes penjaga yang disebut di sini dibuat di task
yang disebut; `AGENTS.md` menunjuk ke file tes itu.

**Files:**
- Create: `ROOT/AGENTS.md`, `ROOT/CLAUDE.md` (isi satu baris: `@AGENTS.md`)
- Create (port, domain dibuang): `ROOT/docs/standards/ui-standard.md` dari `BILIK_DOCS/console-ui-standard.md`;
  `ROOT/docs/standards/copy-guide.md` dari `BILIK_DOCS/console-copy-guide.md` (glossary diganti istilah starterkit:
  user, role, permission, session, activity log, sign-in log); `ROOT/docs/standards/design-system.md` dari
  `BILIK_DOCS/superpowers/specs/2026-10-17-console-v3-design-system.md` §0, §2–§7, §9 (buang §8 page blueprints Bilik,
  §10–§12)
- Create: `ROOT/.gitleaks.toml` (dari `bilik-studio/.gitleaks.toml`, buang allowlist JumpServer)

**Interfaces:**
- Produces: `AGENTS.md` dengan bagian bernomor tetap (task lain merujuk nomornya): §1 Peta repo & lapisan,
  §2 Perintah, §3 Keamanan, §4 Hardening & pentest checklist, §5 Dependensi, §6 Token & warna, §7 Standar UI,
  §8 Motion, §9 Performa, §10 Copy, §11 Tes & definisi selesai, §12 Backend nanti.

- [ ] **Step 1:** Tulis `AGENTS.md`. Setiap aturan satu baris, imperatif, dengan rujukan ke file yang menegakkannya.
  Isi wajib (diambil dari kode Bilik, bukan dikarang):
  - §3 Keamanan: CSP nonce per request + header (`apps/web/src/security-headers.ts`, port Bilik); cookie session
    `httpOnly`, `sameSite: "strict"`, `secure` di HTTPS; CSRF token di header untuk setiap mutasi, dibandingkan
    constant-time (`csrf.ts`); setiap route `/api/*` selain `/api/auth/*` lewat `withPermission` dan cek permission
    sebelum membaca data (ditegakkan `src/test/architecture.test.ts`); input divalidasi zod di route handler sebelum
    guard menyentuh store; redirect hanya ke path internal (`safe-path.ts`); jawaban error tidak membocorkan detail
    internal (`handleError`); tidak ada enumerasi user (login & forgot-password jawabannya seragam); rate limit +
    backoff login (`ratelimit.ts`); map in-memory selalu dibatasi ukurannya; tidak ada `dangerouslySetInnerHTML`;
    tidak ada secret di repo (`gitleaks`); setiap mutasi menulis activity log.
  - §4 Hardening & pentest checklist: daftar kasus yang wajib punya tes sebelum merge, diturunkan dari tes Bilik
    (`proxy.test.ts`, `page-guard.test.ts`, `route-guard.test.ts`, `read-routes.test.ts`, `safe-path.test.ts`,
    `csrf.test.ts`, `ratelimit.test.ts`, `logger-redact.test.ts`): path traversal & normalisasi URL, open redirect,
    IDOR (akses id milik orang lain), 403 sebelum baca, parameter di luar enum/range → 400 sebelum guard, CSV formula
    injection (`csv.ts`), redaksi secret di log.
  - §5 Dependensi: versi persis; jangan tambah dependensi untuk yang bisa ditulis beberapa baris.
  - §6–§8: ringkasan aturan inti + tunjuk `docs/standards/*`; motion wajib `prefers-reduced-motion` dan token motion
    (`packages/ui/src/motion/tokens.ts`).
  - §9 Performa: budget first-load JS per route (angka dari `BILIK/scripts/bundle-budget.mjs`), chart & overlay di-lazy
    (`LazyMount`, `deferred-overlay`), tidak memakai `next/image`.
  - §11: definisi selesai = `bun run check` lulus + e2e terkait lulus + tidak ada kata terlarang.
  - §12: kontrak API = skema zod di `apps/web/src/lib/shared/contracts/*`; backend Bun/Rust wajib mengikuti kode error
    dan bentuk paging di "Kontrak bersama" plan ini.
- [ ] **Step 2:** Port tiga dokumen standar. Hapus semua rujukan halaman/fitur Bilik; pertahankan aturan.
- [ ] **Step 3:** Verifikasi: `rg -i 'jumpserver|squid|egress|prometheus|bifrost|bilik|tibsdev|bankmega' AGENTS.md docs/standards`
  Expected: tidak ada hasil.
- [ ] **Step 4:** Commit `docs: agent rules and ported ui/copy/design-system standards`.

---

### Task 3: Komponen DS + chart di `packages/ui`, bebas domain

**Files:**
- Create (port): `packages/ui/src/ds/*` dari `BILIK/src/components/ds/*` KECUALI `columns.tsx`, `domain-field.tsx`,
  `disconnect-session-dialog.tsx`, `commands-dialog.tsx`, `audit-toast.tsx`, `brand.tsx`, `logo.tsx` (dan tesnya)
- Create (port): `packages/ui/src/charts/*` dari `BILIK/src/components/charts/*`
- Create (port): `packages/ui/src/lib/{format,avatar,safe-path,action-input,paging,sort,query,meter,roving,delta,overflow,chart-layout,chart-scale,chart-data,series,csv,clipboard}.ts`
  dari `BILIK/src/lib/{shared,client}/` beserta tesnya
- Create: `packages/ui/src/lib/status.ts` (pengganti `status-glossary.ts`/`status.ts` Bilik)
- Create: `packages/ui/src/ds/brand.tsx` (placeholder)
- Create: `apps/web/src/test/no-domain.test.ts`
- Modify: `packages/ui/package.json` (exports `./ds`, `./charts`)

**Interfaces:**
- Consumes: Task 1 primitif.
- Produces: `type Health = "healthy" | "degraded" | "down" | "stopped" | "unknown"` (nama sama dengan token
  `--<health>-mark/ink/soft`); `StatusChip({ health: Health; label: string; description?: string })`;
  `StatusLegend({ items: { health: Health; label: string }[] })`.
- Produces: `Brand({ name: string; className?: string })` = monogram kotak (huruf pertama `name`) + nama; logo Bilik
  tidak dibawa.
- Produces: `APP_TIME_ZONE = "Asia/Jakarta"` di `lib/format.ts` (satu tempat; dipakai semua formatter waktu).
- Produces: `ConfirmActionDialog`, `DataTable`, `Column`, `Toolbar`, `FilterMenu`, `StatTile(s)`, `Panel`, `Facts`,
  `EmptyState`, `ErrorState`, `Segmented`, `RelativeTime`, `CopyValue`, `TimeRangePicker`, `QrCode`, `SecretOnceDialog`,
  `StepIndicator`, `Avatar`, `Meter`, `Notice`, `Failure`, `ActionMenu`, `LazyMount`, chart index Bilik — API sama
  dengan Bilik kecuali yang disebut di atas.
- `Failure` di Bilik mengimpor `lib/client/api` (ApiError): ubah agar menerima `{ status: number; code: string; message: string }`
  generik, tanpa mengimpor app.

- [ ] **Step 1: Tes penjaga domain (gagal dulu)**

```ts
// apps/web/src/test/no-domain.test.ts
const BANNED = /jumpserver|\bjms\b|squid|egress|prometheus|\bloki\b|bifrost|bilik|tibsdev|bankmega|workspace|\bkoko\b|megacode/i;
it("no Bilik domain word in apps/web/src or packages/ui/src", () => {
  expect(scan([WEB_SRC, UI_SRC], /\.(ts|tsx|css|md)$/).filter((f) => BANNED.test(read(f)))).toEqual([]);
});
it("packages/ui never imports apps/ or @/", () => {
  expect(scan([UI_SRC], /\.(ts|tsx)$/).filter((f) => /from\s+["'](@\/|[./]*apps\/)/.test(read(f)))).toEqual([]);
});
```

- [ ] **Step 2:** Jalankan `bun run --filter @starterkit/web test -- no-domain`. Expected: lulus pada isi Task 1 (sanity);
  kemudian setelah port mentah Step 3 ia harus FAIL dan menunjuk file domain.
- [ ] **Step 3:** Port file DS/chart/lib. Bersihkan sampai tes penjaga hijau: hapus tipe/label domain dari `format.ts`,
  `chart-data.ts`, `series.ts` (`types.ts` Bilik tidak dibawa; tipe yang dipakai chart seperti `Point` pindah ke
  `lib/chart-data.ts`); `step-indicator`/`status-legend`/`status-chip` memakai `Health` + label dari props.
- [ ] **Step 4:** Port tes komponen (`status-chip`, `status-legend`, `stat-tile`, `data-table`, `qr-code`, `markup`,
  `focus-return`, `charts.test.ts`) dan tes lib; sesuaikan ekspektasi label domain menjadi label generik.
- [ ] **Step 5:** `bun run check`. Expected: lulus; `no-domain.test.ts` hijau.
- [ ] **Step 6:** Commit `feat(ui): port DS components and charts without domain coupling`.

---

### Task 4: Kontrak API + store mock + aturan domain (murni, teruji)

**Files:**
- Create: `apps/web/src/lib/shared/permissions.ts`, `apps/web/src/lib/shared/contracts/{common,auth,me,users,rbac,audit,dashboard}.ts`
- Create: `apps/web/src/lib/server/mock/{db.ts,seed.ts,rules.ts,password.ts}`
- Test: `apps/web/src/lib/server/mock/rules.test.ts`, `seed.test.ts`, `password.test.ts`

**Interfaces:**
- Produces (`permissions.ts`): `PERMISSIONS: readonly PermissionName[]`, `MODULES: { key: "user"|"role"|"permission"|"audit"; actions: Action[] }[]`
  (sumber baris/kolom matrix), `type PermissionName`.
- Produces (`contracts/common.ts`): `type ErrorCode` = union semua kode di "Kontrak bersama"; (`contracts/auth.ts`):
  `type AuthMethod = "password" | "ldap" | "google" | "apple"`.
- Produces (`db.ts`): tipe `UserRecord` (UserDto + `passwordHash: string|null`, `totpSecret: string|null`,
  `recoveryCodes: string[]` (hash)), `RoleRecord`, `SessionRecord { id; userId; device; ip; createdAt; lastSeenAt }`,
  `DbView` (akses baca users/roles untuk `rules.ts`).
- Produces (`contracts/*`): skema zod + tipe yang di-infer: `UserDto { id; name; username; email; avatarUrl: string|null; isActive; isLdap; twoFactorEnabled; roles: string[]; connected: ("google"|"apple")[]; lastLoginAt: string|null; createdAt }`,
  `RoleDto { id; name; locked: boolean; permissions: PermissionName[]; userCount }`,
  `PermissionDto { name: PermissionName; roles: string[] }`,
  `SessionDto { id; device; ip; lastSeenAt; current: boolean }`,
  `ActivityDto { id; at; actor: {id; name}; action: string; target: {type; id; label}; before: unknown; after: unknown }`,
  `AuthLogDto { id; at; userId: string|null; login: string; event: "login_success"|"login_failed"|"logout"|"2fa_success"|"2fa_failed"; method: "password"|"ldap"|"google"|"apple"; ip; device; location: string|null }`,
  `Page<T>`, `ListQuery` (paging di "Kontrak bersama"), `BulkResult`, `ApiErrorBody`, serta body request tiap endpoint
  (Task 6–12 memakainya).
- Produces (`db.ts`): `db()` singleton di `globalThis` (selamat dari HMR) berisi `users`, `roles`, `sessions`,
  `activity`, `authLog`, `resetTokens`, `ldapDirectory` (Map by id); `resetDb()` untuk tes.
- Produces (`rules.ts`, murni, tanpa I/O):
  - `effectivePermissions(user: UserRecord, roles: Map<string, RoleRecord>): Set<PermissionName>` (gabungan semua role)
  - `checkUserChange(actor: UserRecord, target: UserRecord, change: UserChange, db: DbView): ErrorCode | null`
    (`UserChange` = `{ kind: "deactivate"|"delete"|"setRoles"; roles?: string[] }`)
  - `checkRoleChange(role: RoleRecord, change: "edit"|"delete", db: DbView): ErrorCode | null`
  - `checkPasswordOp(target: UserRecord): ErrorCode | null` (`ldap_password` bila `isLdap`)
  - `bulk<T>(ids: string[], check: (id) => ErrorCode | null, apply: (id) => void): BulkResult`
- Produces (`password.ts`): `hashPassword(pw): string` / `verifyPassword(pw, hash): boolean` (scrypt `node:crypto`,
  bandingkan constant-time).
- Seed (`seed.ts`): 50 user deterministik (PRNG berbenih), password semua `Password123!` (hash dihitung sekali dan
  dipakai ulang), ~200 activity, ~300 auth log tersebar 30 hari terakhir. Akun tetap:
  `superadmin@example.com` (Superadmin), `admin@example.com` (Admin), `viewer@example.com` (Viewer),
  `twofa@example.com` (Admin, 2FA aktif, secret TOTP tetap tercatat di README), `inactive@example.com` (nonaktif),
  `ldap@example.com` (Viewer, `isLdap`, password direktori `LdapPass123!`), `google@example.com` (Viewer, terhubung
  Google), `apple@example.com` (Viewer, terhubung Apple).

- [ ] **Step 1: Tes aturan (gagal dulu)**

```ts
it("effective permissions are the union of all roles", () => { /* user [Viewer, Admin] → has user.edit and audit.view */ });
it("superadmin role cannot be edited or deleted", () => expect(checkRoleChange(superRole, "edit", v)).toBe("superadmin_locked"));
it("role with users cannot be deleted", () => expect(checkRoleChange(viewerRole, "delete", v)).toBe("role_in_use"));
it("cannot deactivate, delete, or change roles of self", () => {
  for (const kind of ["deactivate", "delete", "setRoles"] as const) expect(checkUserChange(me, me, { kind, roles: [] }, v)).toBe("self_action");
});
it("last active superadmin cannot lose the role or be deactivated", () => {
  expect(checkUserChange(otherAdmin, onlySuper, { kind: "deactivate" }, v)).toBe("last_superadmin");
  expect(checkUserChange(otherAdmin, onlySuper, { kind: "setRoles", roles: ["Admin"] }, v)).toBe("last_superadmin");
});
it("password ops refused for LDAP users", () => expect(checkPasswordOp(ldapUser)).toBe("ldap_password"));
it("bulk skips protected ids and applies the rest", () => {
  expect(bulk(["a", "self", "b"], (id) => (id === "self" ? "self_action" : null), apply))
    .toEqual({ done: ["a", "b"], skipped: [{ id: "self", code: "self_action" }] });
  expect(apply).toHaveBeenCalledTimes(2);
});
it("seed is deterministic and has every fixed account", () => { /* two seeds equal; 8 fixed emails present */ });
it("verifyPassword accepts the right password and rejects others", () => { /* incl. empty string */ });
```

- [ ] **Step 2:** `bun run --filter @starterkit/web test -- mock`. Expected: FAIL (modul belum ada).
- [ ] **Step 3:** Implement `permissions.ts`, kontrak, `db.ts`, `rules.ts`, `password.ts`, `seed.ts` sesuai Interfaces.
- [ ] **Step 4:** Jalankan lagi. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): api contracts, in-memory mock store and protection rules`.

---

### Task 5: Inti server — config, session, CSRF, guard, header keamanan, proxy

**Files:**
- Create: `apps/web/src/lib/server/{config.ts,session.ts,csrf.ts,api.ts,ratelimit.ts,logger.ts,audit.ts,page-guard.ts}`
- Create: `apps/web/src/{security-headers.ts,proxy.ts}`
- Create: `apps/web/src/test/{architecture.test.ts,scan.ts,server-only-stub.ts}`
- Test (port): `csrf.test.ts`, `ratelimit.test.ts`, `logger-redact.test.ts` (dari `BILIK/src/lib/server/`),
  `security-headers.test.ts`, `proxy.test.ts` (dari `BILIK/src/`), baru: `api.test.ts`

**Interfaces:**
- Consumes: Task 4 `db()`, `effectivePermissions`, kontrak error.
- Produces:
  - `config()`: env zod — `SESSION_SECRET` (≥32 char; wajib bila `NODE_ENV=production`, di dev bila kosong dibuat acak
    per proses), `COOKIE_SECURE` (default `false`), `SESSION_TTL_HOURS` (default 12).
  - Cookie `sk_session` (iron-session) berisi `{ sid?: string; csrf?: string; pending2fa?: { userId: string; method: AuthMethod } }`.
    Data sesi (user, perangkat, IP, waktu) di `db().sessions[sid]`, bukan di cookie.
  - `json(data, status?)`, `apiError(status, code, message)`, `handleError(e)` (ZodError → 400 `bad_request`, lainnya
    → 500 generik, detail hanya ke log).
  - `withPermission(req: Request, perm: PermissionName | null, handler: (ctx: AuthCtx) => Promise<Response>): Promise<Response>`;
    `AuthCtx = { user: UserRecord; sid: string; perms: Set<PermissionName> }`. Urutan: sesi tidak ada / `sid` tak ada
    di store / user nonaktif → 401 (dan hapus cookie); method mutasi tanpa `x-csrf-token` valid → 403 `csrf`;
    `perm` tidak dimiliki → 403 `forbidden`; lalu handler; error → `handleError`. `perm: null` = cukup login.
  - `recordActivity(ctx: AuthCtx, entry: { action: string; target: { type: string; id: string; label: string }; before?: unknown; after?: unknown }): void`
    dan `recordAuth(entry: Omit<AuthLogDto, "id" | "at">): void` di `audit.ts`.
  - `requirePagePermission(perm: PermissionName | null): Promise<{ user: UserDto; perms: PermissionName[]; csrf: string }>`
    untuk server component; tanpa sesi → `redirect(signInHref(path))`; tanpa permission → `notFound()`.
  - `proxy.ts`: CSP nonce + header dari `securityHeaders()` (port Bilik apa adanya) untuk semua request; tidak memeriksa
    permission (itu tugas layout + guard API).
- `architecture.test.ts` (port + ubah dari Bilik): lapisan `@starterkit/ui` → `components/shell` → `features/*`
  (fitur tidak saling impor); setiap `export function GET|POST|PATCH|PUT|DELETE` di `app/api/**/route.ts` di luar
  `app/api/auth/**` memanggil `withPermission(`; setiap handler non-GET di luar `app/api/auth/**` memanggil
  `recordActivity(`.

- [ ] **Step 1: Tes guard (gagal dulu)** di `api.test.ts` dengan `next/headers` di-mock (pola `vi.mock` seperti
  `BILIK/src/app/api/read-routes.test.ts`):

```ts
it("401 without session", ...);                         // status 401, code "unauthenticated"
it("401 when sid was terminated in the store", ...);    // delete db().sessions[sid] → 401
it("401 when the user was deactivated mid-session", ...);
it("403 csrf on POST without or with wrong x-csrf-token", ...);
it("403 forbidden when permission missing, handler not called", ...);
it("permission removed from role takes effect on next request", ...); // edit role in db → 403
it("handler errors do not leak messages", ...);         // throw new Error("db secret") → 500, body has no "db secret"
```

- [ ] **Step 2:** Jalankan; Expected: FAIL.
- [ ] **Step 3:** Implement modul di atas; port `csrf.ts`, `ratelimit.ts`, `logger.ts`, `security-headers.ts` dari
  Bilik tanpa perubahan perilaku (ganti nama global `__ws*` → `__sk*`).
- [ ] **Step 4:** Port tes Bilik yang disebut; tulis `architecture.test.ts`. `bun run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): session, csrf, permission guard, security headers`.

---

### Task 6: Auth — API + layar login, 2FA, OAuth mock, lupa/reset password

**Files:**
- Create: `apps/web/src/lib/server/totp.ts` (dari `BILIK/src/test/totp.ts` + verifikasi). `afterSignIn`/`signInHref`
  diimpor langsung dari `@starterkit/ui/lib/safe-path` (Task 3).
- Create: `apps/web/src/app/api/auth/{login,2fa,logout,forgot,reset}/route.ts`, `apps/web/src/app/api/auth/oauth/[provider]/route.ts`
- Create: `apps/web/src/app/(auth)/{layout.tsx,login/page.tsx,login/2fa/page.tsx,forgot-password/page.tsx,reset-password/page.tsx}`
- Create: `apps/web/src/features/auth/{login-form.tsx,two-factor-form.tsx,forgot-form.tsx,reset-form.tsx}`
  (pola `BILIK/src/features/login/login-form.tsx`, `BILIK/src/features/onboarding/mfa-step.tsx`)
- Create: `apps/web/src/lib/client/api.ts` (port `BILIK/src/lib/client/api.ts`: 401 → `signInHref`; buang cabang onboarding; tambah header `x-csrf-token` dari `setCsrf()`)
- Test: `apps/web/src/app/api/auth/auth-routes.test.ts`, `apps/web/src/lib/server/totp.test.ts`

**Interfaces:**
- Consumes: Task 5 session/ratelimit/`recordAuth`, Task 4 `verifyPassword`, seed.
- Produces:
  - `POST /api/auth/login` body `{ method: "password"|"ldap"; login: string; password: string; next?: string }` →
    `200 { next: "/login/2fa" }` (user ber-2FA; cookie hanya `pending2fa`) atau `200 { next: afterSignIn(next) }` (sesi
    penuh dibuat). Gagal → 401 `invalid_credentials` (seragam), 403 `account_inactive` (hanya setelah password benar),
    429 `rate_limited` dari `loginGate`.
  - `POST /api/auth/2fa` body `{ code: string }` (6 digit TOTP atau recovery code `xxxx-xxxx`, sekali pakai) →
    `200 { next }` / 400 `invalid_code`; ikut `loginGate` step `otp`.
  - `GET /api/auth/oauth/[provider]?next=` (`google|apple`) → mock: masuk sebagai user seed yang terhubung provider
    tersebut, `recordAuth` method provider, redirect 303 ke `afterSignIn(next)`. Provider lain → 404.
  - `POST /api/auth/logout` → hapus `sid` dari store + cookie, `recordAuth` logout.
  - `POST /api/auth/forgot` `{ email }` → selalu `200 { ok: true }`; bila user ada & bukan LDAP, token reset (acak,
    kedaluwarsa 30 menit, sekali pakai) dicatat lewat `logger.info` (mock email).
  - `POST /api/auth/reset` `{ token, password }` → 200 / 400 `invalid_code` (token salah/kedaluwarsa). Password minimal
    12 karakter (aturan di kontrak `auth.ts`).
  - `totp.ts`: `newTotpSecret(): string` (base32), `otpauthUrl(secret, account, issuer): string`,
    `verifyTotp(secret: string, code: string, now?: number): boolean` (jendela ±1 step).
- Layar `/login`: field login + password; tombol "Continue with Google", "Continue with Apple" (link ke route OAuth);
  pilihan metode "Password" / "LDAP" pakai `Segmented`. Pesan 429 = `error.message` dari server (server mengisinya
  dengan `retryText`; `ratelimit.ts` server-only tidak diimpor klien).

- [ ] **Step 1: Tes (gagal dulu)**

```ts
it("unknown user, wrong password, and LDAP user via password method give identical 401 bodies", ...);
it("inactive user with correct password gets 403 account_inactive", ...);
it("2FA user gets next=/login/2fa and the pending cookie cannot call GET /api/users (401)", ...);
it("valid TOTP completes sign-in; reused recovery code is rejected", ...);
it("forgot-password answers the same for unknown and known emails", ...);
it("reset token works once and expires after 30 minutes", ...);
it("login and OAuth honour next only for internal paths", ...); // "//evil.com", "/\\evil", "https://x" → "/"
it("6th failed attempt for one username within a minute is 429", ...);
it("every attempt writes one auth log entry with method and event", ...);
it("verifyTotp accepts current and adjacent step, rejects others", ...);
```

- [ ] **Step 2:** Jalankan; Expected: FAIL.
- [ ] **Step 3:** Implement route + `totp.ts` + `lib/client/api.ts`.
- [ ] **Step 4:** Implement layar. `(auth)/layout.tsx` mengalihkan ke `/` bila sudah login penuh.
- [ ] **Step 5:** `bun run check`; lalu `bun run dev` dan coba manual: login `admin@example.com`, `twofa@example.com`
  (kode dari secret README), `ldap@example.com` metode LDAP, tombol Google. Expected: semua mendarat di `/`.
- [ ] **Step 6:** Commit `feat(web): sign-in with password, LDAP, TOTP 2FA, mock OAuth, password reset`.

---

### Task 7: Shell + navigasi berbasis permission + galeri `/ds`

**Files:**
- Create (port): `apps/web/src/components/shell/{app-shell,sidebar,top-bar,command-palette,palette-dialog,account-menu,page-header,nav-icon}.tsx`
  dari `BILIK/src/components/shell/*` (TIDAK membawa `env-chip`, `refresh-control`, `nav-badges`, `audit-unrecorded-banner`)
- Create: `apps/web/src/lib/shared/{nav.ts,brand.ts,shortcuts.ts}`, `apps/web/src/lib/client/{auth-context.tsx,prefs-context.tsx}`
- Create: `apps/web/src/app/(main)/layout.tsx`, `apps/web/src/app/(main)/page.tsx` (placeholder sampai Task 12),
  `apps/web/src/app/(main)/ds/page.tsx` + `apps/web/src/features/ds/*`
  (port galeri Bilik; data fiktif generik), `apps/web/src/app/{not-found.tsx,global-error.tsx}`
- Delete: `apps/web/src/app/page.tsx` (placeholder Task 1; `/` kini milik `(main)/page.tsx`)
- Test: `apps/web/src/lib/shared/nav.test.ts`

**Interfaces:**
- Consumes: Task 5 `requirePagePermission(null)`.
- Produces:
  - `BRAND = { name: "Starterkit" }` (satu-satunya tempat nama produk).
  - `NAV: NavItem[]` dengan `NavItem = { href; label; icon; shortcut; group: "main"|"access"|"audit"|"personal"; perm: PermissionName | null }`.
    Isi: Dashboard `/` (null, `G D`), Users `/users` (`user.view`, `G U`), Roles `/roles` (`role.view`, `G R`),
    Permissions `/permissions` (`permission.view`, `G P`), Activity log `/audit/activity` (`audit.view`, `G A`),
    Sign-in log `/audit/auth` (`audit.view`, `G S`), Design system `/ds` (null, tanpa shortcut, grup personal),
    Profile `/me` (null, `G M`).
  - `navFor(perms: ReadonlySet<PermissionName>): NavSection[]` (item tanpa permission tidak muncul; grup kosong hilang).
  - `AuthProvider({ user, perms, csrf })` + `useAuth(): { user: UserDto; can: (p: PermissionName) => boolean }`;
    provider memanggil `setCsrf(csrf)` dari `lib/client/api.ts`.
  - `(main)/layout.tsx` = `requirePagePermission(null)` → `AuthProvider` → `AppShell`.

- [ ] **Step 1: Tes** `navFor(new Set(["user.view"]))` berisi Dashboard, Users, Design system, Profile dan TIDAK berisi
  Roles/Permissions/Activity log; `navFor` untuk semua permission berisi 8 item urut seperti di atas.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Port shell; ganti `Role` Bilik (`admin|developer`) dengan `useAuth().can`. Account menu: Profile,
  Security, Sessions, theme, Sign out (POST `/api/auth/logout`).
- [ ] **Step 4:** `bun run check` + buka `/ds` di dev. Expected: semua komponen tampil di light & dark tanpa error konsol.
- [ ] **Step 5:** Commit `feat(web): app shell with permission-based nav and DS gallery`.

---

### Task 8: Akun sendiri — `/me`, `/me/security`, `/me/sessions`

**Files:**
- Create: `apps/web/src/app/api/me/route.ts` (GET, PATCH), `api/me/password/route.ts`, `api/me/2fa/route.ts`
  (POST start, PUT confirm, DELETE), `api/me/connections/[provider]/route.ts` (POST, DELETE), `api/me/sessions/route.ts`,
  `api/me/sessions/[id]/route.ts` (DELETE)
- Create: `apps/web/src/app/(main)/me/{page.tsx,security/page.tsx,sessions/page.tsx}`,
  `apps/web/src/features/me/{profile-form,security-panel,two-factor-setup,connections-card,my-sessions-table}.tsx`
  (pola `BILIK/src/features/me/security-panel.tsx`, `my-sessions-table.tsx`)
- Test: `apps/web/src/app/api/me/me-routes.test.ts`

**Interfaces:**
- Consumes: Task 5 guard (`perm: null`), Task 6 `totp.ts`, Task 4 `checkPasswordOp`.
- Produces:
  - `PATCH /api/me` `{ name?, email? }` (username tidak bisa diubah sendiri) → `UserDto`; email bentrok → 409 `duplicate`.
  - `POST /api/me/password` `{ current, next }` → 200 / 400 `invalid_credentials` / 409 `ldap_password`; sukses
    menghapus semua sesi lain milik user.
  - `POST /api/me/2fa` → `{ secret, otpauthUrl }` (disimpan sebagai pending); `PUT /api/me/2fa` `{ code }` →
    `{ recoveryCodes: string[] }` (8 kode, tampil sekali lewat `SecretOnceDialog`); `DELETE /api/me/2fa` `{ password }`.
  - `POST|DELETE /api/me/connections/[provider]` → `UserDto` (mock; putus ditolak 409 `self_action` bila itu satu-satunya
    cara login: user tanpa password dan tanpa LDAP).
  - `GET /api/me/sessions` → `SessionDto[]` (yang sekarang `current: true`); `DELETE /api/me/sessions/[id]` hanya untuk
    sesi milik sendiri (milik orang lain → 404).

- [ ] **Step 1: Tes (gagal dulu)**: ganti password salah current → 400; LDAP → 409; sukses mematikan sesi lain tapi
  tidak sesi saat ini; alur 2FA start→confirm→login berikutnya minta 2FA; recovery code tidak dikembalikan lagi oleh
  GET apa pun; hapus sesi milik user lain → 404; setiap mutasi menulis satu activity entry.
- [ ] **Step 2:** FAIL → implement route → PASS.
- [ ] **Step 3:** Layar (QR via `QrCode`, konfirmasi via `ConfirmActionDialog`), lima state data (UI standard §3).
- [ ] **Step 4:** `bun run check`. Commit `feat(web): profile, security (password, 2FA, connections), own sessions`.

---

### Task 9: User management — `/users`

**Files:**
- Create: `apps/web/src/app/api/users/route.ts` (GET list, POST), `api/users/[id]/route.ts` (GET, PATCH, DELETE),
  `api/users/bulk/route.ts`, `api/users/[id]/status/route.ts`, `api/users/[id]/reset-password/route.ts`,
  `api/users/[id]/sessions/[sid]/route.ts` (DELETE)
- Create: `apps/web/src/app/(main)/users/{page.tsx,new/page.tsx,[id]/page.tsx,[id]/edit/page.tsx}`,
  `apps/web/src/features/users/{users-page,user-form,user-detail,user-columns}.tsx`, `apps/web/src/lib/shared/user-status.ts`
- Test: `apps/web/src/app/api/users/users-routes.test.ts`

**Interfaces:**
- Consumes: Task 4 rules + kontrak, Task 5 guard + `recordActivity`.
- Produces:
  - `GET /api/users?page&pageSize&q&sort&role&status=active|inactive` → `Page<UserDto>`; `sort` ∈ `name,email,lastLoginAt,createdAt`.
  - `POST /api/users` (`user.create`) `{ name, username, email, roles: string[], isActive, isLdap, password?: string; invite?: boolean }`
    — user non-LDAP wajib tepat satu dari `password` atau `invite: true` (undangan mock: token set-password dicatat
    lewat `logger.info` seperti forgot-password, dipakai lewat `/reset-password?token=`); user LDAP dilarang punya
    keduanya (400). Duplikat username/email → 409 `duplicate`.
  - `PATCH /api/users/[id]` (`user.edit`), `DELETE` (`user.delete`), `POST .../status` `{ active }` (`user.edit`),
    `POST .../reset-password` (`user.edit`) → `{ temporaryPassword }` sekali tampil, LDAP → 409.
  - `POST /api/users/bulk` `{ action: "activate"|"deactivate"|"delete"|"assignRole"; ids: string[] (1–100); role?: string }`
    → `BulkResult`; `delete` butuh `user.delete`, lainnya `user.edit`.
  - `DELETE /api/users/[id]/sessions/[sid]` (`user.edit`) memutus sesi user lain.
  - `userStatus(u: UserDto): { health: Health; label: "Active"|"Inactive" }` di `user-status.ts`.
- Detail user menampilkan: role, permission efektif (dikelompokkan per modul), akun terhubung, sesi aktif, 20 activity
  terakhir dengan `target.id === user.id`.

- [ ] **Step 1: Tes (gagal dulu)**

```ts
it.each([["page=0"], ["pageSize=7"], ["sort=password"], ["status=deleted"]])("GET rejects %s with 400 before guard", ...);
it("bulk with 0 or 101 ids is 400", ...);
it("viewer gets 403 on POST /api/users and the store is unchanged", ...);
it("bulk deactivate with self and last superadmin skips both with codes, logs only done ids", ...);
it("PATCH roles of another user changes their permissions on their next request", ...);
it("LDAP user with password or invite is 400; non-LDAP needs exactly one of password / invite", ...);
it("duplicate email is 409 duplicate (case-insensitive)", ...);
it("q matches name, username, email case-insensitively", ...);
```

- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Layar: `DataTable` dengan seleksi baris, `Toolbar` + `FilterMenu` role/status, aksi massal
  (hasil `skipped` ditampilkan di toast "N updated, M skipped" dengan alasan), toggle aktif per baris, tombol yang
  dilarang aturan tampil disabled dengan tooltip alasan, tombol yang tak diizinkan permission tidak dirender. Form
  memakai multi-select role dan toggle LDAP yang menyembunyikan field password.
- [ ] **Step 4:** `bun run check`. Commit `feat(web): user management with bulk actions and protection rules`.

---

### Task 10: RBAC — `/roles`, `/roles/[id]`, `/permissions`

**Files:**
- Create: `apps/web/src/app/api/roles/route.ts` (GET, POST), `api/roles/[id]/route.ts` (GET, PATCH, DELETE),
  `api/permissions/route.ts` (GET, POST batch)
- Create: `apps/web/src/app/(main)/roles/{page.tsx,[id]/page.tsx}`, `apps/web/src/app/(main)/permissions/page.tsx`,
  `apps/web/src/features/rbac/{roles-page,role-detail,permission-matrix,permissions-page}.tsx`,
  `apps/web/src/features/rbac/matrix.ts`
- Test: `apps/web/src/app/api/roles/rbac-routes.test.ts`, `apps/web/src/features/rbac/matrix.test.ts`

**Interfaces:**
- Consumes: Task 4 `MODULES`, `checkRoleChange`.
- Produces:
  - `GET /api/roles` (`role.view`) → `RoleDto[]`; `POST` (`role.create`) `{ name }` (unik, 409 `duplicate`);
    `PATCH /api/roles/[id]` (`role.edit`) `{ name?, permissions?: PermissionName[] }`; `DELETE` (`role.delete`).
    Superadmin → 409 `superadmin_locked`; dipakai user → 409 `role_in_use`. Permission tak dikenal → 400.
  - `GET /api/permissions` (`permission.view`) → `PermissionDto[]`; `POST` (`permission.create`)
    `{ names: string[] }` → 400 bila nama tidak berpola `<module>.<action>` dengan module di `MODULES`. (Di fase mock
    katalog tetap; POST hanya memvalidasi dan menambah nama baru ke katalog store. `ponytail:` katalog permission
    dinamis penuh ditunda ke backend.)
  - `matrix.ts` (murni): `toggleCell`, `toggleRow(module)`, `toggleColumn(action)`, `toggleAll` atas
    `Set<PermissionName>`; setiap toggle: bila semua sel target sudah tercentang → kosongkan, selain itu → centang semua.
    Kombinasi module×action yang tidak ada di `MODULES` (mis. `audit.create`) dilewati.

- [ ] **Step 1: Tes (gagal dulu)**: aturan toggle matrix (baris setengah tercentang → penuh; penuh → kosong; kolom
  `create` tidak menyentuh `audit`); PATCH Superadmin 409; DELETE role dipakai 409; Admin tanpa `role.edit` → 403;
  setelah PATCH, `userCount` dan `PermissionDto.roles` konsisten.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Layar matrix: baris modul, kolom aksi, checkbox per sel + header baris/kolom/global (indeterminate
  bila sebagian), tombol Save memakai `ConfirmActionDialog` yang menyebut jumlah permission ditambah/dicabut. Matrix
  read-only untuk Superadmin dan untuk user tanpa `role.edit`.
- [ ] **Step 4:** `bun run check`. Commit `feat(web): roles, permission matrix, permissions list`.

---

### Task 11: Audit — `/audit/activity`, `/audit/auth`

**Files:**
- Create: `apps/web/src/app/api/audit/activity/route.ts`, `api/audit/auth/route.ts`
- Create: `apps/web/src/app/(main)/audit/{activity/page.tsx,auth/page.tsx}`,
  `apps/web/src/features/audit/{activity-page,auth-log-page,entry-dialog,diff-view}.tsx`
  (pola `BILIK/src/features/audit/audit-page.tsx`, `audit-entry-dialog.tsx`)
- Test: `apps/web/src/app/api/audit/audit-routes.test.ts`

**Interfaces:**
- Consumes: Task 4 store, `toCsv`/`CSV_BOM` dari `@starterkit/ui/lib/csv`.
- Produces:
  - `GET /api/audit/activity?page&pageSize&user&action&from&to&format=json|csv` (`audit.view`) → `Page<ActivityDto>`
    atau CSV (`Content-Disposition: attachment`, nama `activity-YYYY-MM-DD.csv`, maks 10.000 baris).
  - `GET /api/audit/auth?page&pageSize&user&event&method&from&to&format` → `Page<AuthLogDto>` / CSV.
  - `from`/`to` ISO date, `to ≥ from`, rentang maks 92 hari (nilai Bilik) → selain itu 400.
  - Urutan selalu terbaru dulu.
- `diff-view.tsx`: tabel field | before | after, hanya field yang berubah; nilai yang namanya mengandung
  `password|secret|token` ditampilkan `••••` (store juga tidak pernah menyimpan nilai itu di `before/after`).

- [ ] **Step 1: Tes (gagal dulu)**: `to < from` → 400; rentang 93 hari → 400; CSV mentah dengan sel `=HYPERLINK(...)`
  keluar berawalan `'`; viewer tanpa `audit.view` (role kustom) → 403; `before/after` dari aksi reset password tidak
  memuat password; filter `event=login_failed` hanya mengembalikan event itu.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Layar dengan `TimeRangePicker`, filter, tombol Export CSV, dialog detail (`entry-dialog`).
- [ ] **Step 4:** `bun run check`. Commit `feat(web): activity and sign-in audit logs with CSV export`.

---

### Task 12: Dashboard `/`

**Files:**
- Create: `apps/web/src/app/api/dashboard/route.ts`
- Modify: `apps/web/src/app/(main)/page.tsx` (ganti placeholder Task 7)
- Create: `apps/web/src/features/dashboard/dashboard-page.tsx`
- Test: `apps/web/src/app/api/dashboard/dashboard-route.test.ts`

**Interfaces:**
- Produces: `GET /api/dashboard` (`perm: null`) → `{ activeUsers; newUsers7d; failedLogins24h; activeSessions;
  loginsPerDay: { date: string; success: number; failed: number }[] (14 hari, WIB); recent: ActivityDto[] | null }` —
  `recent` (5 entri) hanya bila punya `audit.view`, selain itu `null`; `failedLogins24h` juga `null` tanpa `audit.view`.
- Layar: `StatTiles` (4), `TimeSeriesChart` atau `BarChart` login per hari (sukses vs gagal, warna `--chart-1`/`--down-mark`),
  panel aktivitas terbaru (disembunyikan bila `null`). Chart di-lazy (`LazyMount`).

- [ ] **Step 1: Tes**: viewer tanpa `audit.view` mendapat `recent: null` dan `failedLogins24h: null`; `loginsPerDay`
  selalu 14 entri berurutan termasuk hari tanpa data (0).
- [ ] **Step 2:** FAIL → implement → PASS → layar.
- [ ] **Step 3:** `bun run check`. Commit `feat(web): dashboard`.

---

### Task 13: E2E, budget, README, verifikasi akhir

**Files:**
- Create: `apps/web/playwright.config.ts` (`webServer`: `bun run build && bun run start` di port 3100,
  `baseURL` `http://localhost:3100`), `apps/web/tests/e2e/{helpers.ts,ds.spec.ts,auth.spec.ts,permissions.spec.ts,a11y.spec.ts}`
- Create (port): `apps/web/scripts/bundle-budget.mjs` dari `BILIK/scripts/bundle-budget.mjs`
- Create: `ROOT/README.md`
- Modify: root `package.json` (script `e2e`, `budget`)

**Interfaces:**
- Consumes: semua task sebelumnya.

- [ ] **Step 1:** `auth.spec.ts`: login password → `/`; login `twofa@example.com` dengan TOTP dari secret seed (pakai
  `totp()` di `helpers.ts`); OAuth Google; LDAP; logout lalu `/users` → `/login?next=%2Fusers`.
- [ ] **Step 2:** `permissions.spec.ts`: login `viewer@example.com` → sidebar tidak berisi "Roles"/"Permissions";
  `page.request.post("/api/users", ...)` dengan CSRF valid → 403; buka `/roles` langsung → halaman not found.
- [ ] **Step 3:** `ds.spec.ts`: screenshot `/ds` light & dark (baseline baru). `a11y.spec.ts`: `@axe-core/playwright`
  tanpa pelanggaran `serious|critical` di `/login`, `/`, `/users`, `/roles/[superadmin]`, `/audit/activity`.
- [ ] **Step 4:** README: cara jalan (`bun install`, `bun run dev`), tabel akun seed (email, password, role, catatan
  2FA secret / LDAP password), peta repo, rujukan ke `AGENTS.md` dan spec.
- [ ] **Step 5: Verifikasi akhir.** Jalankan:
  `bun run check && bun run e2e && bun run budget`
  `rg -i 'jumpserver|\bjms\b|squid|egress|prometheus|\bloki\b|bifrost|bilik|tibsdev|bankmega|\bkoko\b|megacode' apps packages -g '!**/node_modules/**' -g '!bun.lock'`
  `rg -i workspace apps packages -g '!**/node_modules/**' -g '!bun.lock' -g '!package.json'`
  `docker run --rm -v "$PWD:/repo:ro" zricethezav/gitleaks:v8.30.1 dir /repo --config /repo/.gitleaks.toml --redact --no-banner`
  Expected: semua lulus; kedua `rg` tanpa hasil; gitleaks tanpa temuan (bila Docker tidak ada, catat sebagai
  dilewati).
- [ ] **Step 6:** Commit `test(web): e2e for auth and permissions, a11y, DS snapshots; README`.
