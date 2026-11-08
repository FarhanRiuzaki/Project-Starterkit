# SunnyGo — konteks produk

Diperbarui 8 November 2026. Fakta implementasi mengacu pada source, `package.json`, [README](../README.md) dan [kontrak API](api/README.md). Status verifikasi terbaru ada di [QA](qa.md).

| Konteks awal | Isi proyek |
| --- | --- |
| Nama starterkit | SunnyGo; `BRAND.name` di `packages/shared/src/brand.ts`, workspace `starterkit` / `@starterkit/*`. |
| Target pengguna | Pengembang dan tim yang membuat aplikasi web internal atau produk admin; pengguna aplikasi turunannya adalah administrator, pengelola akses dan pengguna internal. Dasar: README dan spesifikasi awal. |
| Masalah utama | Mengulang fondasi autentikasi, otorisasi, pengelolaan pengguna, audit, UI responsif dan operasi setiap memulai produk; aturan perlu terdokumentasi dan dapat diuji. |
| Stack dan batasan | TypeScript monorepo Bun; Next.js 16.4.5/React 19.3.0 di Node 24 sebagai BFF; API Bun 1.4.3/Elysia 1.4.30/Drizzle 0.45.4; PostgreSQL 18; zod 4.6.7; Tailwind 4.3.3. Versi persis mengikuti manifest dan lockfile. |
| Repository | https://github.com/FarhanRiuzaki/Project-Starterkit ; checkout `project-starterkit-monorepo`. |
| Figma | [SunnyGo](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA); status migrasi versioning tercatat di [kebijakan Figma](standards/figma-versioning.md). |
| Target rilis | Tanggal dan versi rilis produk belum ditentukan Product Owner. Integrasi ke `main` diotorisasi pada sesi core ini; merge bukan persetujuan rilis/deployment. |

## Tujuan dan scope

Fondasi dipakai ulang dengan menyalin repository dan menyesuaikannya, bukan menerbitkan paket sebagai library. Fitur saat ini mencakup password/LDAP/OAuth, TOTP dan recovery, session, profil, users, roles/permissions, dashboard, activity/sign-in log dan CSV; UI bersama mencakup light/dark, palette, density, tabel server-side, saved views, kolom, filter, form dan galeri `/ds`.

Keputusan pemilik pada sesi ini menambahkan modul contoh `projects` ke scope integrasi: CRUD, status active/archived, pencarian/paging, permission dan activity log. Modul ini menunjukkan pola perluasan end-to-end; tidak mengubah SunnyGo menjadi produk manajemen proyek.

Di luar scope saat ini: multitenancy, billing backend, transport upload/storage server, Redis/broker, serta deployment dan pembuktian integrasi provider nyata. Contoh komponen galeri bukan layanan produk yang sudah terhubung. Penambahan berikutnya dicatat di [backlog](backlog.md) sebelum dikerjakan.

## Ukuran keberhasilan

- Checkout dapat di-install, disiapkan, dimigrasi, di-seed dan dijalankan mengikuti README.
- `bun run check` lulus: typecheck, ESLint tanpa warning, seluruh tes workspace; E2E yang relevan lulus di viewport yang didukung.
- Kontrak zod, endpoint API dan dokumentasi sesuai; batas modul serta guard dibuktikan oleh tes arsitektur dan integrasi.
- UI tidak scroll horizontal mulai 360 px, menyediakan lima state data, keyboard/touch dan state filter di URL; setiap route memenuhi budget JS awal 250 kB gzip.
- Modul baru mengikuti [arsitektur](architecture.md) dan panduan AGENTS tanpa menduplikasi fondasi.

Tidak ada angka adopsi, target bisnis, jadwal rilis atau hasil uji provider nyata yang telah disepakati. Product Owner menetapkan ukuran tambahan tersebut.
