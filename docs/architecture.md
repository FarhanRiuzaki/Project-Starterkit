# Arsitektur SunnyGo

Fakta struktur dari source dan [AGENTS.md](../AGENTS.md); detail endpoint ada di [API](api/README.md), konfigurasi dan operasi di [README](../README.md).

Browser → Next.js BFF (`/api/*`, cookie/session/CSRF/same-origin) → API privat (`/v1/*`, internal token, session/permission) → PostgreSQL. Browser tidak menghubungi API langsung.

| Batas | Kontrak implementasi |
| --- | --- |
| `apps/web` | Next App Router; page tipis melakukan permission guard dan prefetch. Screen/hook per feature, state shareable di URL dan query key di `lib/shared/queries.ts`. Client tidak mengimpor `lib/server`. |
| `apps/api` | Modular monolith Bun/Elysia. Modul berisi index/controller/service/schema/rules dan tests. Antar modul hanya lewat index; kernel tidak bergantung pada modul. |
| `packages/shared` | zod DTO/query/body, paging, permissions, audit, redaksi dan brand; source murni bersama. |
| `packages/ui` | Tokens, primitives, motion, komponen DS dan charts; tidak mengimpor domain aplikasi. API hanya mengimpor helper murni `lib/*`. |
| PostgreSQL | Satu tempat untuk data, session, rate-limit/backoff dan state OAuth. Drizzle dengan parameter terikat; invariant konkuren memakai transaksi dan lock. |

## Kontrak lintas bidang

- Urutan route: validasi query → guard → validasi body → UUID/keberadaan → aturan → perubahan dan activity dalam transaksi → DTO. Kegagalan tak dikenal memberi error publik tetap.
- List memakai pageQuery, whitelist sort, ukuran 15/25/50/100, maksimum page 1000, capped total; CSV memiliki batas dan pencegahan formula injection.
- UI list memakai useTableQuery/DataTable server mode, saved views dan column chooser; perubahan filter mereset page serta dapat dipulihkan lewat Back.
- Credential dan session tetap di API; BFF hanya menyimpan token/challenge tersegel dan meneruskan header allow-list. Tidak ada cookie/database secret di bundle browser.
- Migrasi forward-only, diverifikasi checksum; migrator/seed memakai schema owner, API produksi memakai role DML. Jangan mengubah migrasi yang sudah diterapkan.
- Penambahan modul `projects` mengikuti pola yang sama: kontrak shared, lima route CRUD, permission `project.*`, activity `project.*`, registry, navigasi, prefetch dan migrasi baru. Tidak ada tenant/ownership per pengguna yang dijanjikan; akses modul dibatasi permission organisasi tunggal.

Pola penambahan modul lengkap dan tes penegaknya: AGENTS §12–13. Perubahan kontrak membutuhkan pembaruan schema/docs dan pengujian terkait; perubahan arsitektur penting dicatat di [decisions](decisions.md).

## Kompatibilitas saat integrasi

Dua branch memakai nama komponen yang sama dengan kontrak berbeda. `Combobox` mempertahankan mode command/select (`value: string[]`, `onValueChange`) dan mode input pencarian (`ComboOption`, `onChange`/`loadOptions`); renderer internal dipisahkan agar pemakai yang sudah ada tetap bekerja. `FileUpload` mempertahankan pilihan file terkontrol (`files`/`onFilesChange`) serta mode transfer melalui callback `upload`. Kedua regression suite dipertahankan; mode transfer tidak menambahkan endpoint atau storage server.

Pengelola saved views dimuat pada pembukaan pertama dan mempertahankan state berikutnya. Editor filter users juga dimuat saat dibuka. Pemisahan ini berasal dari pengukuran budget hasil merge, bukan perubahan kebijakan paging, permission atau penyimpanan view.
