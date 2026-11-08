# Backlog SunnyGo

Diperbarui 8 November 2026. Prioritas berikut adalah urutan integrasi Core dan tindak lanjut yang diketahui; Product Owner memutuskan perubahan prioritas produk. Owner adalah role, bukan klaim sesi lain sedang aktif.

| ID | Prioritas | Owner | Status | Dependency | Acceptance criteria | Target |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-001 | P0 | Core | Done | Konteks repo dan instruksi pemilik | Enam sumber kebenaran terisi, aturan tim/handoff dan role Core terdokumentasi, link valid, fakta/asumsi/status terbuka jelas. | Integrasi ini |
| CORE-002 | P0 | Core + BE/FE + QA | Done | CORE-001, PROJ-001 | Semua commit branch tersedia tercakup di main, perubahan checkout dipertahankan, konflik diselesaikan; check, E2E relevan dan budget lulus; hasil dicatat sebelum commit/push. | Integrasi ini |
| PROJ-001 | P0 | Core + BE/FE | Done | Otorisasi DEC-007 | Modul projects CRUD, kontrak/schema/docs, permission/nav/prefetch, migrasi/seed dan tests terintegrasi; tidak ada dependency antar-feature; lima state dan filter bersama digunakan. | Integrasi ini |
| DES-001 | P1 | Designer | Pending | Akses tulis Figma dan kebijakan versioning | Baseline/release index benar-benar diterapkan, page lama dan referensi master/token terjaga, bukti inventory/screenshot dicatat. Persetujuan pemilik sudah ada; lihat dokumen versioning. | Belum dijadwalkan |
| DES-002 | P2 | Designer | Pending | PROJ-001, DES-001 bila mengubah Figma | Review flow dan state projects terhadap standar; jika dibuat di Figma ikuti duplikasi page dan catat hasil nyata. | Belum dijadwalkan |
| OPS-001 | P1 | Product Owner + Architect + BE + QA | Pending | Lingkungan dan akun uji yang diotorisasi | HTTPS/ingress, Secure cookie, LDAP, SMTP dan Google/Apple nyata diverifikasi dengan bukti; backup/restore serta monitoring disepakati. | Sebelum deployment publik |
| REL-001 | P1 | Product Owner | Pending | CORE-002, penilaian QA dan risiko staging | Nomor/tanggal rilis dan scope disepakati secara eksplisit, risiko tersisa diterima; merge main tidak otomatis rilis. | Belum ditentukan |

Hasil verifikasi dan temuan berada di [qa.md](qa.md). Setiap tugas baru memuat seluruh kolom yang sama. Handoff menggunakan [format tim](team.md#handoff).

CORE-001/002 dan PROJ-001 diselesaikan dalam commit integrasi Core yang memuat catatan ini. Bukti gate dan hasil retest tercantum di QA; status ini tidak menyatakan rilis produk atau deployment.
