# Backend Bun + PostgreSQL — design

Tanggal: 2026-10-20. Branch: `feat/be-bun-postgres` dari `main` (FE sudah di-merge ke `main`).
Pemilik: Farhan Riuzaki. Keputusan di dokumen ini adalah rekomendasi Claude yang diambil tanpa putaran konfirmasi,
sesuai izin pemilik ("setelah plan matang, gue ambil rekomendasi lo, langsung gas tanpa konfirmasi gue").
Setiap keputusan Claude ditandai **(Claude)**; yang diputuskan pemilik ditandai **(pemilik)**.

## Maksud

Fase FE selesai di atas mock API (`apps/web/src/lib/server/mock`). Fase ini mengganti mock itu dengan backend
sungguhan sehingga starterkit siap dipakai produk publik: aman, cepat untuk data jutaan baris, bisa di-deploy, bisa
dioperasikan. Layar FE tidak berubah: kontraknya tetap `docs/api` (zod di contracts + JSON Schema).

Sukses = `bun run setup && bun run dev` menjalankan web + API di atas PostgreSQL lokal, pemilik login sebagai
Superadmin (Farhan Riuzaki), semua layar fase FE bekerja seperti di mock, seluruh E2E lulus di atas stack sungguhan,
dan mock store terhapus.

## Keputusan pemilik

- Backend **Bun**, database **PostgreSQL**, kelas produksi enterprise untuk publik: keamanan, performa, optimasi.
- Browser tidak pernah memanggil backend langsung; hanya `/api/*` di Next. `API_BASE_URL` env server saja.
- DB lokal: URL dari pemilik, hanya di `.env` yang di-gitignore (lihat `.superpowers/next-phase/backend-phase-notes.md`).
- Seeder superadmin dev: Farhan Riuzaki, riuzakif@gmail.com, password dari env seeder, role Superadmin.
- Semua standar mutlak fase FE (tabel server-side, skalabilitas, UI/UX/motion, tanpa flicker, konsisten,
  AGENTS.md) tetap berlaku.

## Non-goals

- Registrasi mandiri (sign-up publik). User dibuat admin atau lewat undangan, seperti fase FE.
- Multi-tenant, billing, notifikasi, upload berkas.
- Redis atau message broker. Semua state bersama ada di PostgreSQL (lihat "Batas yang disengaja").
- Mengubah layar atau kontrak kecuali yang disebut di dokumen ini.

## Arsitektur

```
browser ──/api/*──▶ apps/web (Next, BFF) ──HTTP /v1/* + token layanan──▶ apps/api (Bun + Hono) ──▶ PostgreSQL
```

- **`apps/api`** (baru) memiliki semua aturan domain dan data: auth, sesi, RBAC, user, audit, dashboard.
  Hono 4 di atas `Bun.serve` **(Claude)**: middleware tersusun, `app.request()` untuk tes, Request/Response standar.
  Path API = path Next dengan prefix diganti: `/api/users/{id}` ↔ `/v1/users/{id}`.
- **`apps/web`** menjadi BFF: memegang cookie sesi, CSRF, same-origin, header keamanan, dan meneruskan request.
  Tidak ada logika domain lagi di Next. Izin (permission) diputuskan oleh API (satu sumber kebenaran); Next memakai
  hasil API untuk guard halaman dan menyembunyikan UI **(Claude)**. Ini mempersempit kalimat spec FE "permission
  tetap dicek di Next": Next tetap menolak halaman (404) berdasarkan izin dari API, tetapi keputusan akses data hanya
  di API, supaya tidak ada dua implementasi aturan yang bisa berbeda.
- **`packages/shared`** (`@starterkit/shared`, baru): `contracts/*` (zod), `permissions.ts`, `paging.ts`,
  `audit.ts` (kosakata audit) dan kunci redaksi log dipindah dari `apps/web/src/lib/shared` / `lib/server/logger.ts`
  supaya web dan API memakai sumber yang sama **(Claude)**. `bun run api:schemas` tetap menghasilkan `docs/api/schemas`.
- API boleh mengimpor helper murni `@starterkit/ui/lib/format` (zona waktu aplikasi) dan `@starterkit/ui/lib/csv`.

### Next ↔ API

- Setiap request Next → API membawa `X-Internal-Token` (secret bersama ≥ 32 karakter, `INTERNAL_API_TOKEN`,
  dibandingkan constant-time). Tanpa token yang benar API menjawab 401 kecuali `/healthz` dan `/readyz`.
  API default listen di `127.0.0.1` (`API_HOST`); di produksi hanya di jaringan privat.
- Identitas user: `Authorization: Bearer <session token>`. IP dan user-agent klien diteruskan sebagai
  `X-Client-Ip` / `X-Client-Ua`, dipercaya API hanya karena token layanan valid. `X-Request-Id` dibuat Next per
  request dan dicatat di kedua log.
- Next memakai satu klien `lib/server/backend.ts` (timeout 10 s, tanpa retry untuk mutasi, satu retry untuk GET
  pada error koneksi) **(Claude)**.
- Route Next: satu catch-all `app/api/[...path]/route.ts` yang meneruskan method, query, body (maks 64 KB), dan
  menjawab apa adanya (status, JSON, CSV + `Content-Disposition`). Bila cookie memegang sesi penuh, mutasi wajib
  `x-csrf-token` yang cocok (403 `csrf`) sebelum diteruskan. Tanpa sesi, request tetap diteruskan tanpa bearer agar
  urutan cek (400 query sebelum 401) diputuskan API. Jawaban 401 dari API menghapus cookie.
- Route khusus di `app/api/auth/*` karena mengatur cookie: login, 2fa, logout, forgot, reset, oauth (mulai dan
  callback). Semua POST auth tetap wajib same-origin.
- Guard halaman (`requirePagePermission`, `guardedTitle`) memanggil `GET /v1/auth/context` (user + permissions),
  di-memo per request dengan `React.cache`. Prefetch halaman memanggil URL `/v1/...` yang sama dengan hook React
  Query di sisi browser, sehingga data pertama tetap dari server (aturan tanpa flicker tidak berubah).

## Sesi dan autentikasi

- Sesi milik API: tabel `sessions` (id uuid, `token_hash` SHA-256 unik, user, method, device, ip, created_at,
  last_seen_at, expires_at). Token sesi 32 byte acak (base64url), hanya hash-nya disimpan.
- Cookie `sk_session` (iron-session, sealed, `httpOnly`, `SameSite=Strict`, `Secure` saat `COOKIE_SECURE`) berisi
  hanya `{ token, csrf }` atau `{ challenge }` (2FA tertunda). CSRF dibuat dan dicek Next.
- Masa berlaku sama dengan FE: absolut `SESSION_TTL_HOURS` (12), idle `SESSION_IDLE_MINUTES` (120), `last_seen_at`
  ditulis paling sering sekali per 60 detik lewat satu `UPDATE ... WHERE last_seen_at < now() - 60s`. Validasi sesi +
  permission efektif = satu query per request.
- 2FA tertunda: tabel `auth_challenges` (hash token, user, method, `next`, kedaluwarsa 10 menit, sekali pakai).
- Password: `Bun.password` argon2id (memory 19 MiB, time 2 — rekomendasi OWASP) **(Claude)**. User tidak dikenal
  tetap menjalankan verifikasi terhadap hash dummy supaya waktu jawab sama.
- TOTP: secret dienkripsi AES-256-GCM dengan `DATA_ENCRYPTION_KEY` (32 byte base64) dan prefix versi `v1:` supaya
  rotasi kunci bisa ditambah tanpa migrasi format **(Claude)**. Replay ditolak lewat `totp_last_step`.
- Recovery code: 8 kode × 80 bit (format `xxxx-xxxx-xxxx-xxxx`, base32), di-hash argon2id, sekali pakai (aturan
  `docs/api/README.md` "Backend notes").
- Link reset/undangan: aturan `docs/api/README.md` (32 byte, hash SHA-256, satu per user, sekali pakai, 30 menit /
  72 jam), tabel `user_tokens`.
- Rate limit dan backoff: angka sama dengan FE (`AGENTS.md` §3), disimpan di tabel `UNLOGGED` PostgreSQL dengan
  upsert atomik, sehingga berlaku lintas proses **(Claude)**. Dibersihkan oleh janitor.
- Password seeder: kebijakan password (min 12) berlaku di produksi. Di luar produksi seeder menerima password
  yang lebih pendek dengan peringatan di log, karena password dev pemilik 8 karakter **(Claude)**.

### OAuth (Google, Apple) dan LDAP

- OAuth sungguhan: authorization code + PKCE + `state` + `nonce`, `id_token` diverifikasi dengan JWKS penyedia
  (`arctic` untuk alur, `jose` untuk JWT) **(Claude)**. Tiap penyedia aktif bila env client-nya diisi.
- State disimpan di tabel `oauth_states` (sekali pakai, 10 menit) dan diikat ke browser lewat cookie `sk_oauth`
  (`httpOnly`, `Secure`, `SameSite=None` karena Apple memakai `form_post`, 10 menit) **(Claude)**.
- Callback menyetel cookie sesi lalu menjawab halaman kecil yang berpindah dengan `<meta http-equiv="refresh">` ke
  `next`, sehingga cookie `SameSite=Strict` terkirim pada navigasi berikutnya **(Claude)**.
- Masuk lewat OAuth hanya untuk identitas yang sudah dihubungkan (`user_identities(provider, subject)`); tidak
  ada pembuatan akun otomatis dan tidak ada penautan otomatis berdasarkan email (mencegah pengambilalihan akun)
  **(Claude)**. Menghubungkan akun di `/me/security` memakai alur redirect yang sama dengan mode `link`. Ini mengubah
  tombol "Connect": dari POST langsung menjadi navigasi ke `/api/auth/oauth/{provider}?mode=link`.
- Penyedia mock (alur redirect yang sama, halaman authorize palsu, subject tetap per akun seed) hanya bila
  `OAUTH_MOCK=true` dan bukan produksi; E2E dan dev memakainya.
- LDAP sungguhan: `ldapts`, bind akun layanan → cari user (filter di-escape) → bind sebagai user; produksi wajib
  `ldaps://` atau StartTLS **(Claude)**. Aktif bila `LDAP_URL` diisi. Direktori mock (`LDAP_MOCK=true`, bukan
  produksi) untuk dev dan tes.
- Yang tidak bisa diverifikasi: OAuth dan LDAP sungguhan hanya dites dengan server palsu di tes; uji dengan Google,
  Apple dan direktori nyata perlu kredensial pemilik.

## Data

- `Bun.sql` (klien PostgreSQL bawaan Bun, tanpa ORM) **(Claude)**: query SQL ditulis langsung, nilai lewat
  parameter. Kolom sort dari whitelist per endpoint, tidak pernah dari input mentah.
- Migrasi: berkas SQL maju-saja `apps/api/migrations/NNNN_nama.sql`, runner dengan `pg_advisory_lock`, tabel
  `schema_migrations` (nama + checksum; berkas yang sudah jalan lalu berubah = gagal). `bun run db:migrate`.
- ID: UUIDv7 (`Bun.randomUUIDv7()`), kolom `uuid`. Id di path yang bukan UUID valid = 404 tanpa query.
- Tabel: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_identities`, `sessions`,
  `auth_challenges`, `user_tokens`, `oauth_states`, `activity`, `auth_log`, `rate_limits` (UNLOGGED),
  `login_backoff` (UNLOGGED). Direktori LDAP mock hidup di kode, bukan tabel.
- Role direferensikan dengan nama di kontrak; di DB lewat `user_roles(user_id, role_id)`, jadi rename otomatis.
- Indeks: `pg_trgm` GIN di `users(name, username, email)`; unik `lower(username)`, `lower(email)`,
  `lower(roles.name)`; `activity(at DESC, id DESC)`, `activity(target_id, at DESC)`, `auth_log(at DESC, id DESC)`,
  `sessions(user_id)`, `sessions(expires_at)`.
- Paging: `LIMIT/OFFSET` (page ≤ 1000 × 100) dengan hitungan dibatasi `COUNT_CAP = 100000` lewat
  `SELECT count(*) FROM (... LIMIT 100001)` → `totalCapped` **(Claude)**. Satu helper `pageQuery` untuk semua list.
- Invarian bersamaan (Superadmin aktif terakhir, eskalasi role) dicek di dalam transaksi dengan
  `pg_advisory_xact_lock` per invarian, sehingga dua admin bersamaan tidak bisa sama-sama lolos.
- Audit append-only: trigger menolak `UPDATE` pada `activity` dan `auth_log`; `DELETE` hanya oleh janitor retensi
  (`AUDIT_RETENTION_DAYS`, default 365) **(Claude)**. Masking snapshot sama dengan FE.
- `statement_timeout` 5 s dan `idle_in_transaction_session_timeout` 10 s per koneksi; pool `DB_POOL_MAX` (10).
- Produksi memakai dua URL: `DATABASE_URL` (role aplikasi, hanya DML) dan `MIGRATION_DATABASE_URL` (pemilik skema);
  di dev keduanya boleh sama. SQL pembuatan role ada di README.

## Seed

- `bun run db:seed`: katalog permission, role sistem Superadmin (terkunci) / Admin / Viewer (isi sama dengan mock),
  dan superadmin dari `SEED_SUPERADMIN_NAME/EMAIL/USERNAME/PASSWORD`. Idempoten.
- `bun run db:seed:demo`: akun `@example.com` dan data contoh mock (50 user, 200 activity, 300 sign-in log); menolak
  jalan saat `NODE_ENV=production`. E2E memakai seed demo di database tes terpisah.
- `bun run setup`: membuat `apps/api/.env` dan `apps/web/.env.local` bila belum ada (secret acak, URL DB dari
  argumen/env), membuat database bila belum ada, migrasi, seed. Tidak menimpa berkas env yang sudah ada.

## Operasional

- Konfigurasi divalidasi zod saat start; nilai wajib yang hilang = proses berhenti dengan pesan jelas.
- Log JSON pino dengan redaksi yang sama seperti web (kunci dari `packages/shared`), `requestId` di setiap baris.
- `/healthz` (proses hidup), `/readyz` (DB menjawab). Shutdown halus pada SIGTERM: berhenti menerima, tunggu
  request berjalan (maks 10 s), tutup pool.
- Janitor dalam proses (interval 5 menit, dikunci `pg_try_advisory_lock` sehingga hanya satu instans jalan):
  hapus sesi/challenge/state/token kedaluwarsa, baris rate limit lama, audit lewat retensi.
- Email: `Mailer` dengan transport `log` (dev/tes, isi email ke log dan, di tes, ke kotak surat dalam memori) dan
  `smtp` (`nodemailer`). Produksi wajib `smtp`. Dikirim setelah commit, tidak memblok jawaban (forgot password
  tidak membocorkan waktu) **(Claude)**.
- Deploy: `Dockerfile` untuk `apps/api` dan `apps/web` (multi-stage, user non-root), `docker-compose.yml`
  (postgres + api + web) untuk menjalankan stack seperti produksi, workflow CI GitHub Actions (check + build + E2E
  dengan service PostgreSQL). Belum ada remote, jadi CI belum pernah jalan sungguhan.

## Tes

- API: `bun test` (Bun runtime, karena `Bun.sql` tidak ada di Node), integrasi ke database tes
  `project-starterkit-monorepo_test` yang dibuat otomatis; data di-reset per berkas tes. Perilaku yang dites
  sekarang di `apps/web/src/app/api/**/*.test.ts` dan `lib/server/*.test.ts` dipindah ke tes API untuk modul yang
  sama, termasuk seluruh daftar pentest `AGENTS.md` §4.
- Web: tes guard (CSRF, same-origin, catch-all, page guard, prefetch) memakai API palsu.
- E2E Playwright: menjalankan API + build web di port sendiri (bukan :3000) di atas database tes yang di-reset dan
  di-seed demo pada global setup. Semua E2E fase FE harus tetap lulus.
- `bun run check` mencakup API (typecheck, lint, tes).

## Batas yang disengaja (ponytail)

- Rate limit di PostgreSQL, bukan Redis: cukup sampai ribuan login/menit; ganti ke Redis bila jadi bottleneck.
- Audit tanpa partisi: indeks cukup untuk puluhan juta baris; partisi bulanan bila lebih.
- Email tanpa outbox: kegagalan kirim tercatat di log; tambah tabel outbox bila pengiriman harus dijamin.
- Tidak ada endpoint metrik Prometheus; log terstruktur + health cukup untuk awal.
- Rotasi `DATA_ENCRYPTION_KEY` belum diimplementasi; formatnya sudah berversi.

## Sisa minor FE yang ikut dibereskan

1. Halaman edit user mencerminkan aturan actor-rank (BlockedButton), tidak menunggu 403 saat Save.
2. Tabel sesi tidak menampilkan error sekejap setelah user dihapus.
3. Matrix tidak bisa menyiapkan permission yang tidak dimiliki editor.
4. Aksi tanpa perubahan (bulk assign role yang sudah dimiliki, `PATCH /api/me` tanpa beda) tidak menulis activity.

## Yang diserahkan ke pembuat plan

Nama berkas dan pembagian modul di `apps/api`, urutan task, bentuk helper route (`route(perm, handler)`), detail
query per endpoint (perilaku acuannya adalah mock + tesnya + `docs/api/README.md`).

## Amandemen 2026-10-20: Elysia + Drizzle + struktur modul (keputusan pemilik)

Pemilik meninjau source `apps/api` dan meminta: framework yang rapi (referensi **Elysia**), **ORM** (tidak menulis
`select` mentah), dan folder yang terstruktur matang. Ini menggantikan "Hono" dan "`Bun.sql` tanpa ORM" di atas.

- **Framework: Elysia 1.4** (stabil; bukan 2.0 rc) **(pemilik)**. Satu instance Elysia per modul (controller), disusun
  di `app.ts`. Plugin bersama: request context, token layanan, batas body, pemetaan error, guard.
- **ORM: Drizzle** (`drizzle-orm` + `drizzle-kit`, driver `bun-sql`) **(Claude)**: type-safe, ringan, dekat ke SQL
  sehingga kunci baris (`.for("update")`), `onConflictDo…`, subquery dan agregat tetap bisa diekspresikan; skema di
  TypeScript adalah sumber kebenaran. Prisma tidak dipilih (codegen berat, dukungan Bun lebih lemah).
- **Aturan query:** semua query lewat query builder / relational API Drizzle. Tidak ada statement SQL utuh yang
  ditulis tangan (`select …`, `insert …`, `update …`, `delete …`) di kode aplikasi. Helper `sql` Drizzle hanya untuk
  fungsi PostgreSQL tanpa padanan ORM (advisory lock, `now()`/interval, `array_agg`, `greatest`, `at time zone`) di
  dalam ekspresi builder. Trigger, tabel UNLOGGED dan indeks trigram ada di berkas migrasi SQL. Dijaga tes konformitas.
- **Migrasi:** `drizzle-kit generate` dari skema + berkas SQL kustom untuk yang tidak bisa dihasilkan; diterapkan
  oleh runner yang sudah ada (advisory lock + checksum). Riwayat migrasi dimulai ulang (belum ada produksi); DB lokal
  dev/test/e2e di-reset dan di-seed ulang.
- **Struktur:**
  ```
  apps/api/src/
    index.ts                 # boot: server, janitor, shutdown
    app.ts                   # createApp(): plugin + modul
    config/                  # skema env
    db/  client.ts  schema/<aggregate>.ts  migrate.ts  seed/
    common/                  # errors, plugins/ (context, internal-auth, error, guard), pagination, crypto, mailer, log, locks
    modules/<modul>/
      index.ts               # controller (Elysia): route, urutan cek kontrak
      service.ts             # logika bisnis + akses data (Drizzle)
      rules.ts               # aturan murni (tanpa I/O), bila ada
      <modul>.test.ts
  ```
  Modul: `auth`, `oauth`, `me`, `users`, `rbac`, `audit`, `dashboard`, `health`. Validasi memakai skema zod di
  `@starterkit/shared` (satu kontrak untuk web dan API).
- **Urutan cek kontrak tetap:** query 400 → sesi/izin 401/403 → body 400 → 404 → aturan → ubah → activity.
- Semua perilaku dan tes yang sudah ada dipertahankan; refaktor ini tidak mengubah jawaban API.
