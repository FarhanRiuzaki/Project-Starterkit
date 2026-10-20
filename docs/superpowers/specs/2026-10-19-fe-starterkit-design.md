# Starterkit monorepo — fase 1: frontend (design)

Tanggal: 2026-10-19. Status: disetujui pemilik 2026-10-19.

## Maksud

Starterkit pribadi untuk proyek-proyek berikutnya, pengganti RECON (`PROJECT-APPS/starterkit-laravel`, Laravel 12 +
Vuexy/jQuery). Tampilan dan pola UI diambil dari Bilik (`PROJECT-APPS/bilik-studio/apps/ws-console`, Next.js 16 +
Tailwind 4 + shadcn/Radix). Backend nanti Bun atau Rust (belum diputuskan), tidak ada PHP lagi.

Fase 1 hanya frontend: UI/UX Bilik diekstrak ke repo baru tanpa apa pun yang terkait JumpServer/workspace, plus layar
untuk empat fitur inti RECON yang berjalan di atas data mock. Bentuk request/response mock menjadi kontrak API yang nanti
diimplementasikan backend.

## Tujuan

1. Repo baru `PROJECT-APPS/project-starterkit-monorepo` (monorepo) berisi design system Bilik yang bersih dari domain
   JumpServer.
2. Layar lengkap untuk empat fitur: auth, RBAC, user management, audit log — jalan end-to-end di data mock (login,
   navigasi sesuai permission, CRUD, filter, aksi massal).
3. Layar memanggil HTTP (`/api/...`), bukan mengimpor data mock langsung, supaya backend Bun/Rust nanti tinggal
   menggantikan endpoint tanpa mengubah kode layar.
4. Aturan kerja Bilik (keamanan, hardening/pentest, standar UI, token, performa, motion, copy) ikut dibawa sebagai
   `AGENTS.md` + `docs/standards/*`, dan sebisa mungkin ditegakkan oleh tes, supaya AI yang memakai starterkit ini
   mengikutinya. (Ditambahkan pemilik setelah persetujuan, 2026-10-19.)

## Bukan tujuan (fase 1)

- Backend Bun/Rust, database, migrasi, email sungguhan, OAuth/LDAP sungguhan.
- Fitur RECON lain: notification rules engine, CRUD generator, obfuscator, `MT7XXService`, viewer dokumentasi, API token
  management, `Product` contoh. (Bisa jadi fase berikutnya; tidak dikerjakan sekarang.)
- Mengubah `bilik-studio` atau `starterkit-laravel`. Keduanya hanya dibaca.

## Anti-goal (gagal walau secara teknis jalan)

- Masih ada sisa domain Bilik: string/komponen/route terkait JumpServer, workspace, Squid/egress, Prometheus/Loki,
  Bifrost, AI usage, fleet, sesi JumpServer.
- Komponen layar mengimpor fixture mock langsung, sehingga mengganti ke backend sungguhan berarti mengubah layar.
- Design system diubah gayanya (token warna, tipografi, kepadatan) sampai tidak lagi terasa seperti Bilik.
- Abstraksi yang tidak diminta (lapisan adapter berlapis, generator, plugin system) untuk hal yang belum ada.

## Sumber

| Ambil dari | Path | Catatan |
|---|---|---|
| Token & gaya | `bilik-studio/apps/ws-console/src/styles/tokens.css`, `src/app/globals.css`, `src/app/fonts.ts` | Design system v3 "Tray"; spec: `bilik-studio/docs/superpowers/specs/2026-10-17-console-v3-design-system.md` |
| Primitif | `src/components/ui/*` | shadcn/Radix (button, dialog, dropdown, tabs, table, input, tooltip, popover, command, sonner, skeleton, icon) |
| Komponen DS | `src/components/ds/*` | yang generik saja (lihat di bawah) |
| Chart | `src/components/charts/*` | dipakai dashboard |
| Motion | `src/components/motion/*` | |
| Shell | `src/components/shell/*` | sidebar, top bar, command palette, account menu, page header |
| Pola login/2FA | `src/features/login/login-form.tsx`, `src/features/onboarding/mfa-step.tsx`, `src/components/ds/qr-code.tsx` | |
| Pola audit | `src/features/audit/audit-page.tsx`, `audit-entry-dialog.tsx` | |
| Pola akun sendiri | `src/app/(me)/me/{security,sessions}`, `src/features/me/{security-panel,my-sessions-table}.tsx` | |
| Galeri DS | `src/app/(main)/ds/page.tsx` | ikut dibawa, diisi data fiktif non-domain |
| Fungsi (perilaku) | `starterkit-laravel/routes/web.php`, `app/Http/Controllers/AuthApp/{User,Role,Permission,OAuthManagementController}.php`, `app/Http/Controllers/AppsManagement/{ActivityLog,AuthenticationLog}Controller.php`, migrasi di `database/migrations` | acuan field & aksi, bukan untuk disalin kodenya |

Dibuang dari Bilik: `src/components/ds/columns.tsx` (`sessionColumns`, `egressColumns`, `aiRequestColumns`),
`domain-field.tsx`, `src/components/projects/*`, semua `src/features/*` selain pola yang disebut di atas,
`src/lib/server/*` yang memanggil JumpServer/Prometheus/Loki/Bifrost, `server/entry.cjs`, `server/peer-header.cjs`,
`env-chip`, `audit-unrecorded-banner`, `nav-badges` (alert count), `Dockerfile` khusus server tibsdev. Komponen DS yang
mengimpor `lib/shared/*` domain (mis. `status-glossary`, `projects-view`, `roles` dengan role `admin`/`developer`)
dipotong ketergantungannya, bukan dibawa beserta modul domainnya.

## Bentuk repo

```
project-starterkit-monorepo/
  package.json          # bun workspaces
  apps/web/             # Next.js 16 — layar + route handler mock di app/api
  packages/ui/          # tokens.css, ui/, ds/, charts/, motion/ (tidak mengimpor apa pun dari apps/)
  docs/superpowers/specs/
```

Cara pakai (keputusan pemilik): proyek baru meng-copy/clone seluruh monorepo lalu dimodifikasi. `packages/ui` tidak
dipublikasikan atau di-versioning sebagai library — cukup source-only (di-transpile Next via `transpilePackages`), dan
shell/DS boleh bergantung pada nav dan API client milik app. Tidak perlu build step atau API publik yang stabil.

`apps/api` (Bun atau Rust) ditambahkan di fase backend, tidak di-scaffold sekarang. Package manager: Bun (Bilik memakai
npm; dipilih Bun karena backend condong ke Bun — keputusan Claude).

## Layar

Semua layar desktop-first mengikuti Bilik. (Diganti 2026-10-20: responsive ponsel, tablet, desktop; lihat `2026-10-20-responsive-design.md`.)

**Auth (publik)**
- `/login` — email/username + password; tombol Google, Apple; tab/opsi LDAP (username + password direktori). Error
  kredensial, akun nonaktif, terlalu banyak percobaan.
- `/login/2fa` — kode TOTP 6 digit atau recovery code; muncul bila user punya 2FA aktif.
- `/forgot-password`, `/reset-password?token=` — mock: email tidak dikirim, token reset ditampilkan/dicatat di log
  server dev.
- OAuth mock: tombol Google/Apple langsung "berhasil" sebagai user mock yang punya akun terhubung provider itu.

**Akun sendiri**
- `/me` — profil (nama, username, email, avatar).
- `/me/security` — ganti password; nyalakan 2FA (QR + verifikasi kode + recovery codes, pakai `qr-code` dan
  `secret-once-dialog`); matikan 2FA; akun terhubung (Google/Apple: hubungkan/putuskan).
- `/me/sessions` — sesi login aktif (perangkat, IP, terakhir aktif), keluarkan satu sesi.

**User management** (permission `user.*`)
- `/users` — DataTable: cari, filter role & status, pagination; pilih banyak → aktifkan/nonaktifkan/hapus massal;
  toggle aktif per baris.
- `/users/new`, `/users/[id]/edit` — form (nama, username, email, role, status, password awal / kirim undangan).
- `/users/[id]` — detail: role & permission efektif, akun terhubung, sesi aktif (admin dapat memutus), reset password
  oleh admin, riwayat dari audit log user tersebut.

**RBAC** (permission `role.*`, `permission.*`)
- `/roles` — daftar role + jumlah user + jumlah permission; buat/hapus role.
- `/roles/[id]` — permission matrix: baris = modul, kolom = aksi (view/create/edit/delete/…); select-all per baris, per
  kolom, dan global (seperti RECON). Simpan dengan konfirmasi.
- `/permissions` — daftar permission, role mana yang memakainya; tambah beberapa sekaligus (padanan
  `permissions/batch-store`).

**Audit** (permission `audit.view`)
- `/audit/activity` — siapa mengubah apa, pada record mana, kapan; dialog detail dengan diff sebelum/sesudah.
- `/audit/auth` — login sukses/gagal, logout, 2FA, metode login (password/Google/Apple/LDAP), IP, perangkat, lokasi.
- Keduanya: filter user/peristiwa/rentang waktu (`TimeRangePicker`), ekspor CSV.

**Dashboard**
- `/` — `StatTile`: user aktif, user baru 7 hari, login gagal 24 jam, sesi aktif; satu chart login per hari; daftar
  aktivitas terbaru.

**Galeri DS**
- `/ds` — semua komponen dengan data fiktif non-domain.

## Mock & kontrak API

- Layar → hook React Query (pola `src/lib/client/api.ts` Bilik) → `fetch('/api/...')`.
- `apps/web/app/api/**/route.ts` melayani endpoint dari store di memori (seed: ±50 user, role Superadmin/Admin/Viewer,
  ±200 entri activity log, ±300 entri auth log). Data hilang saat server restart — disengaja.
- Input divalidasi zod di route handler; skema zod yang sama diekspor sebagai tipe kontrak.
- Sesi: cookie (iron-session seperti Bilik) berisi id user mock. Middleware/guard memeriksa permission; menu dan tombol
  disembunyikan bila user tidak punya permission, dan endpoint menolak (403) walau dipanggil langsung.
- Akun seed untuk mencoba: satu per role, satu dengan 2FA aktif, satu nonaktif, satu akun LDAP, satu terhubung Google.
  Kredensial ditulis di README.
- Aksi yang mengubah data menulis entri activity log; login/logout menulis auth log — supaya layar audit berisi jejak
  dari aksi yang baru dilakukan.
- **Browser tidak pernah memanggil backend langsung** (keputusan pemilik 2026-10-19). Semua request dari browser
  hanya ke `/api/*` di origin yang sama dan selalu lewat server Next (route handler/proxy). URL backend
  (`API_BASE_URL`) hanya ada di env server — tidak boleh `NEXT_PUBLIC_*`, tidak boleh muncul di kode klien. CSP
  `connect-src 'self'` sudah memblokir panggilan ke origin lain; tes arsitektur menolak `fetch` ke URL absolut dan env
  `NEXT_PUBLIC_*` berisi URL API di kode klien.
- Saat backend ada: route handler mock diganti route handler yang meneruskan request ke `API_BASE_URL` dari sisi
  server (session/CSRF/permission tetap dicek di Next). Mekanisme pastinya diputuskan di fase backend.

## Aturan data (mengikuti RECON)

- **Role:** satu user bisa punya banyak role (RECON: `syncRoles($request->roles)` di `AuthApp/User.php`). Permission
  efektif = gabungan permission semua role. Tidak ada permission langsung ke user. Form user memakai multi-select role.
- **LDAP:** flag per user `is_ldap` yang di-set admin (RECON `AuthApp/User.php`). Pada form user, toggle LDAP
  menyembunyikan field password/undangan. Reset password oleh admin dan ganti password di `/me/security` dinonaktifkan
  untuk user LDAP. Login LDAP hanya untuk user yang sudah ada dan ber-flag LDAP (tidak ada provisioning otomatis).
- **Proteksi** (tiap aturan = kode error 4xx tersendiri + tombol disabled dengan alasan di tooltip):
  - Role Superadmin tidak bisa diubah permission-nya maupun dihapus.
  - Minimal satu user Superadmin aktif harus selalu ada.
  - User tidak bisa menonaktifkan, menghapus, atau mencabut role dirinya sendiri.
  - Role yang masih dipakai user tidak bisa dihapus.
  - Aksi massal melewati baris yang terlindungi dan melaporkan "N berhasil, M dilewati (alasan)", bukan menolak
    seluruh batch.

## Standar tabel & skalabilitas (keputusan pemilik 2026-10-20, wajib)

Berlaku untuk SETIAP tabel/list di starterkit, sekarang dan nanti; data bisa jutaan baris.
- **Server-side penuh:** paging, sort, search, dan filter dikerjakan server. Klien tidak pernah mengambil seluruh baris.
  Endpoint list tidak pernah mengembalikan array tanpa batas — selalu `Page<T>`.
- **Ukuran halaman:** pilihan `15 | 25 | 50 | 100`, default **15**. Pemilih ukuran halaman ada di setiap tabel.
- **Pagination bernomor:** first / prev / nomor halaman / next / last + "Showing 1–15 of 12,345". Halaman maksimal
  1000 (nilai Bilik); lebih dalam dari itu → 400, pengguna mempersempit filter (pola max result window).
- **Sort:** hanya kolom yang di-whitelist per endpoint; header kolom bisa diklik dengan `aria-sort`.
- **State di URL:** `page`, `pageSize`, `sort`, `q`, dan filter tersimpan di query string (bisa dibagikan, back/forward
  benar). Ganti filter/search/pageSize → kembali ke halaman 1. Search di-debounce.
- **Total besar:** `Page<T>` boleh membawa `totalCapped: true` bila backend membatasi hitungan pasti (tampil "100,000+").
- **Export:** CSV mengikuti filter yang sama, dibatasi 10.000 baris, tidak pernah lewat klien yang mengambil semua data.
- **Komponen tunggal:** satu `DataTable` server-driven di `packages/ui` + satu hook `useTableQuery` (URL state) + satu
  helper server `paginate()` / skema `ListQuery`; tidak ada tabel yang membuat paging sendiri.
- **Backend nanti (Bun/Rust):** index pada kolom sort/filter, keyset internal bila memungkinkan, hitungan dibatasi
  (`totalCapped`), batas `pageSize` dan `page` yang sama ditegakkan di server.
- Ditegakkan oleh tes: kontrak (`PAGE_SIZES`, default 15, `page ≤ 1000`), dan tes arsitektur yang menolak GET list
  tanpa `paginate(`.

## Standar UI, UX, dan motion (keputusan pemilik 2026-10-20, wajib)

Berlaku untuk setiap layar dan modul, sekarang dan nanti. Sumber detail: `docs/standards/{ui-standard,design-system,copy-guide}.md`.
- **UI:** hanya token + komponen DS (`packages/ui`); anatomi halaman sesuai ui-standard; terang dan gelap sama-sama
  dicek; dua density; skeleton berbentuk sama dengan konten (tanpa layout shift).
- **UX presisi:** setiap region data punya lima state (loading, empty, error dengan retry, stale, data); setiap aksi
  async punya state pending di pemicunya, hasil yang diumumkan (toast/`role=status`), error yang bisa dipulihkan, dan
  fokus yang kembali ke tempat yang masuk akal; aksi destruktif dikonfirmasi dengan teks akibatnya; tombol yang
  diblokir aturan tampil disabled + alasan; semua aksi bisa lewat keyboard dengan focus ring terlihat; tidak ada jalan
  buntu (404/forbidden selalu punya jalan kembali); copy mengikuti copy-guide.
- **Motion:** memakai token motion (`DUR`, `EASE`, `SPRING_*`, `STAGGER`) — tidak ada durasi/easing literal;
  `MotionLayer` + transisi halaman + stagger saat data pertama muncul + number tween + shared indicator + enter/exit
  dialog/menu/toast; hanya `transform`/`opacity`; patuh budget performa design-system §7.7; `prefers-reduced-motion`
  mematikan gerak non-esensial; refresh data tidak memicu animasi ulang selain flash baris baru.
- **Tanpa flicker (keputusan pemilik 2026-10-20):** data halaman pertama dirender di server (server component membaca
  sumber data yang sama dengan route `/api` lalu mengisi cache React Query), jadi halaman muncul langsung berisi data
  tanpa skeleton; skeleton hanya muncul bila memuat > 150 ms dan, sekali muncul, bertahan ≥ 300 ms (tidak ada kilatan
  skeleton singkat); ganti halaman/sort/filter mempertahankan data sebelumnya (`placeholderData`) dengan indikator
  sibuk halus, bukan kembali ke skeleton; refetch tidak memicu animasi ulang; setiap route punya `loading.tsx` dengan
  bentuk halaman. Ditegakkan oleh E2E yang gagal bila skeleton terlihat 1–300 ms atau layout bergeser (CLS).
- **Legend status per card (keputusan pemilik 2026-10-20):** legend status tidak pernah ditaruh di level halaman
  (toolbar/header halaman). Setiap card (`Panel`) yang menampilkan status membawa legend-nya sendiri di header card
  sebagai tombol info (ikon info → popover berisi `StatusLegend`), lewat prop `legend` pada `Panel`. Legend seri chart
  tetap di header card chart-nya. Ditegakkan oleh tes arsitektur: `StatusLegend` hanya boleh dirender oleh `Panel`.
- **Konsisten:** satu pola untuk satu kebutuhan di semua modul — `PageHeader`, `DataTable` server-driven,
  `Field`, `ConfirmActionDialog`, `BlockedButton`, toast hasil aksi, lima state, hook data per fitur dengan bentuk yang
  sama, route handler dengan urutan yang sama (parse → guard → rule → mutate → activity). Istilah UI hanya dari
  glossary copy-guide. Modul baru meniru modul yang ada, bukan membuat varian baru; review akhir membandingkan
  semua modul berdampingan.
- Ditegakkan oleh: tes motion (token tidak boleh literal, reduced-motion), E2E motion, axe a11y, baseline screenshot
  `/ds` terang/gelap, dan cek manual setiap layar per role di Task 13.

## Kriteria selesai

- `bun install && bun run dev` di root menjalankan `apps/web`; semua layar di atas bisa dicoba dengan akun seed.
- `rg -i 'jumpserver|jms|squid|egress|prometheus|loki|bifrost|workspace|bilik|tibsdev|bankmega' apps packages` kosong
  (kecuali kata "workspace" pada konfigurasi bun workspaces).
- `typecheck`, `lint`, dan unit test (vitest) lulus; tes DS Bilik yang masih relevan ikut dibawa dan lulus.
- Login sebagai Viewer: menu Users/Roles tidak tampil dan `/api/users` POST mengembalikan 403.

## Keputusan Claude (bisa dikoreksi)

- Nama folder `project-starterkit-monorepo` (permintaan tertulis "starterekit", dianggap salah ketik).
- Bun workspaces; struktur `apps/web` + `packages/ui`.
- Mock lewat Next route handler + store memori, bukan MSW atau fixture di klien.
- Nama permission bergaya RECON (`user.view`, `user.edit`, …).
- Bahasa UI Inggris seperti Bilik.
- Nama/brand sementara di satu konstanta, logo placeholder (logo Bilik tidak dibawa).
- Multi-role dan LDAP per-user flag mengikuti RECON; aturan proteksi di "Aturan data".
- Shell (sidebar, top bar, palette, account menu) tinggal di `apps/web`, bukan `packages/ui`: shell bergantung pada nav,
  permission, dan API client milik app, dan package tidak boleh mengimpor app (dibuat saat menulis plan).

## Diserahkan ke builder

- Pembagian persis komponen DS mana yang generik vs domain, selama anti-goal terpenuhi.
- Bentuk JSON endpoint, paging, dan format error (konsisten satu pola).
- Jumlah dan isi data seed.
- Tooling yang dibawa dari Bilik (`bundle-budget`, Playwright snapshot `/ds`) — bawa bila murah. `check-dep-age`
  (umur minimum rilis dependensi) tidak dibawa (keputusan pemilik 2026-10-19).
