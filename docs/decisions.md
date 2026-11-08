# Keputusan SunnyGo

Dicatat 8 November 2026. Keputusan arsitektur lama di bawah adalah fakta yang sudah diterapkan dan didukung source/docs; bukan persetujuan baru atas kebutuhan spekulatif.

| ID | Status / sumber | Keputusan dan alasan |
| --- | --- | --- |
| DEC-001 | Diterapkan; README, AGENTS, manifest | SunnyGo menjadi template aplikasi internal/admin yang disalin per produk. Paket workspace source-only; tidak menerbitkan library. |
| DEC-002 | Diterapkan; AGENTS §1/3/12, tes arsitektur | Next BFF memegang browser boundary, API modular privat memegang data dan otorisasi; kontrak shared membatasi drift. |
| DEC-003 | Diterapkan; kernel/modules dan tes concurrency | PostgreSQL menyimpan seluruh shared state, transaksi dan lock menjaga invariant; tidak menambah Redis/broker. |
| DEC-004 | Diterapkan; standar UI/Figma | Semantic tokens, reusable UI, lima state dan tiga viewport menjadi fondasi konsistensi serta aksesibilitas. |
| DEC-005 | Keputusan pemilik; dokumen figma-versioning | Baseline desain ditetapkan `v1.0.0`; perubahan berikut memakai duplikat page versi patch. Migrasi Figma masih belum diterapkan menurut catatan yang ada. |
| DEC-006 | Diotorisasi pemilik pada sesi ini | Sesi ini adalah Core. Isi konteks sesuai proyek, gabungkan perubahan checkout utama dan seluruh commit branch ke main; pertahankan pekerjaan sesi lain. |
| DEC-007 | Arahan terakhir pemilik pada sesi ini: “gabung saja” setelah penjelasan modul contoh | Modul `projects` ikut diintegrasikan; keputusan ini menggantikan pilihan sebelumnya untuk menyimpan eksperimen terpisah. Gunakan versi dengan migrasi pencarian dan tes lebih lengkap, tanpa mengubah worktree asal. |
| DEC-008 | Prosedur integrasi Core berdasarkan aturan tim | Konflik dipadukan berdasarkan perilaku yang dibuktikan tes; jangan mengambil satu sisi seluruh repo. Tooling lokal/cache dan nested worktree tetap di disk, di luar source produk. |

## Asumsi dan hal yang belum diputuskan

Target pengguna diturunkan dari README dan spesifikasi awal; belum ada persona riset atau ukuran adopsi yang disepakati. Tanggal/nomor rilis, pemilik role individual, staging eksternal dan konfigurasi provider nyata belum ditentukan. Core tidak menetapkan keputusan rilis/deployment atas nama Product Owner. Kebutuhan lanjutan masuk [backlog](backlog.md).
