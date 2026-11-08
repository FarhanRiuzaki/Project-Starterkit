# QA SunnyGo

Sesi integrasi Core, 8 November 2026. Hasil historis di [audit security/performance](security-performance-audit.md), [review perubahan](security-change-review.md) dan [staging readiness](staging-readiness.md) tetap menjadi bukti untuk revisi yang disebut di sana; bukan hasil uji otomatis untuk merge ini.

## Rencana dan lingkungan

- Jalankan check seluruh workspace setelah resolusi konflik dan integrasi projects: typecheck, lint zero-warning, unit/integration/architecture.
- Jalankan build produksi terpisah `.next-e2e`, budget 250 kB gzip dan E2E relevan untuk autentikasi/security, permissions, projects, filter/saved views, responsivitas, forms, galeri dan aksesibilitas.
- Verifikasi migrasi/schema drift, endpoint/schema docs, status Git dan ancestry seluruh commit branch. Gitleaks memakai redaksi; jangan mencatat env atau rahasia.
- Host tersedia Node 24 dan PostgreSQL 18. Docker daemon tidak aktif saat pemeriksaan awal. Bun host awal 1.4.4 berbeda dari pin 1.4.3; lingkungan yang akhirnya dipakai dicatat bersama hasil.
- API tests hanya database berakhiran `_test`; E2E hanya `_e2e`. Worktree eksperimen asal tidak diubah. Artifact lokal berada di `.superpowers/scratch/core/` (gitignored).

## Temuan integrasi

| ID | Temuan | Tindakan / status |
| --- | --- | --- |
| QA-001 | Feature branch berbasis main lokal lama, sementara origin/main memuat saved views, forms, bulk matching dan pembuktian perluasan modul. Merge menghasilkan konflik UI/API/docs dan gambar baseline. | Selesai: kontrak dan perilaku kedua sisi dipadukan; full check dan kasus browser terkait lulus, dengan retest locator tercatat di bawah. |
| QA-002 | Dua implementasi komponen dengan nama sama memakai kontrak props berbeda (Combobox/FileUpload). | Selesai: kedua kontrak dan regression suite dipertahankan; interaksi teruji. Saved views/editor filter dimuat saat dibuka agar budget terpenuhi. |
| QA-003 | projects sebelumnya hanya eksperimen; ada versi dengan search migration dan coverage lebih lengkap. | Selesai: versi lengkap disalin tanpa mengubah worktree asal, memakai helper unique-violation bersama dan FilterLayout terbaru. |

## Hasil sesi ini

| Gate | Hasil dan bukti |
| --- | --- |
| Full check terakhir | **Lulus**, Bun 1.4.3 / Node 24.21.0 di macOS: typecheck, lint tanpa warning ESLint, 1.528 tes (UI 729, shared 10, web 266, API 523). `.superpowers/scratch/core/final-check.log`. |
| Produksi dan budget | Build produksi lulus di macOS dan Linux (Node 24.22.0 / Bun 1.4.3 di container). Seluruh **22 route** lulus budget 250 kB gzip; terbesar `/users` dilaporkan **250,0 kB** (headroom sangat kecil). `core/budget.log`, `core/linux-budget.log`, `core/linux-upload-retest.log` di scratch. |
| Browser macOS | Run lengkap: **323 lulus, 96 skip, 2 gagal** karena locator judul File upload cocok dengan dua contoh galeri. Setelah locator dipersempit ke panel Import users, seluruh file upload suite diuji ulang: **3 lulus**, termasuk kedua kasus gagal tadi. `core/mac-final-e2e.log`, `core/mac-upload-retest.log`. |
| Browser Linux | Run lengkap: **323 lulus, 96 skip, 2 gagal** dengan penyebab locator yang sama. Retest sesudah perbaikan: **3 lulus**, lalu budget seluruh route lulus. `core/linux-e2e.log`, `core/linux-upload-retest.log`. |
| Galeri dan visual | Baseline Chromium macOS/Linux diperbarui untuk gabungan galeri dan filter. Run galeri/interaksi awal macOS: 14 lulus / 1 skip; Linux galeri: 9 lulus / 1 skip. Bagian form desktop serta viewport phone light/dark ditinjau; screenshot phone kedua OS tidak menunjukkan overflow. Snapshot comparison dan axe galeri juga lulus di run lengkap. |
| Kontrak dan database | 67 schema diregenerasi. Endpoint/contract conformance, schema drift, migrasi sampai 0005, ownership tabel, guard/CRUD projects, saved views dan concurrency masuk gate API yang lulus. `core/schemas.log`, `core/final-check.log`. |
| Secret/whitespace | Gitleaks riwayat feature dan diff staged menggunakan redaksi: tidak ada temuan; diff whitespace bersih. Scan awal direktori apps dihentikan karena mencakup env/cache lokal; hasil itu tidak dipakai sebagai bukti source aman. `core/gitleaks-history.log`, `core/gitleaks-staged.log`. |
| Integrasi Git | Fetch terakhir tidak menambah commit origin/main. Seluruh 10 referensi branch lokal/remote tersedia tercakup oleh dua parent merge (feature `ed87a2b` dan origin/main `4d95a95`); fix lokal `fc7821e` tetap terwariskan. Commit yang memuat catatan ini adalah hasil integrasi Core. |

Run penuh tetap dicatat memiliki dua kegagalan awal; log tidak diubah menjadi hijau. Perbaikannya adalah penargetan locator, tanpa menghapus assertion atau menambah skip. Semua kasus gagal tersebut lulus pada retest kedua platform; tidak ada kegagalan tersisa yang diketahui. Sebanyak 96 skip mengikuti kondisi viewport/interaksi suite yang sudah ada.

Artifact sesi ini berada di `.superpowers/scratch/core/` (gitignored). Database Linux memakai nama khusus berakhiran `_core_linux_e2e`, terpisah dari dev, `_test` dan E2E host. Docker diaktifkan untuk verifikasi; tiga service produksi lokal yang ikut hidup otomatis dihentikan kembali tanpa menghapus volumenya. Container verifikasi terpisah selesai dan dihapus otomatis. Tidak ada deployment dari source integrasi ini.

## Batas bukti

Tidak ada perubahan Figma atau deployment eksternal pada tugas ini. Tidak ada pembuktian provider LDAP/SMTP/OAuth nyata, HTTPS ingress, real-device/WebKit atau kapasitas produksi. Tugas tindak lanjut tercatat dalam backlog; persetujuan rilis tetap milik Product Owner.
