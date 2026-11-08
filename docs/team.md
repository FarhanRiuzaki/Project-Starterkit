# Aturan bersama — tim SunnyGo

Konteks proyek terisi di [product.md](product.md). Sesi ini berperan **Core / integrator**: menjaga konteks bersama, dependency, integrasi branch, resolusi konflik dan bukti verifikasi. Penugasan ini berasal dari pemilik pada 8 November 2026; tidak menggantikan kewenangan tiap bidang.

## Cara kerja

1. Baca konteks, keputusan, backlog dan kondisi file terbaru sebelum bekerja. Ikuti [AGENTS.md](../AGENTS.md) dan aturan folder terkait.
2. Pisahkan fakta, asumsi, usulan dan keputusan; klaim selesai harus menyertakan bukti. Jangan mengarang kebutuhan.
3. Kerjakan hal yang jelas secara mandiri; tanyakan hanya keputusan besar atau informasi yang benar-benar menghalangi.
4. Jaga scope. Catat kebutuhan tambahan dalam backlog, dengan acceptance criteria dan dependency.
5. Gunakan sumber kebenaran di tabel berikut. Dokumen standar dan kontrak rinci tetap dirujuk, tidak disalin menjadi aturan yang bersaing.
6. Jangan menimpa perubahan sesi lain. Catat owner tugas/file yang bersinggungan, baca ulang sebelum edit dan simpan perubahan sebelum integrasi. Jangan mengedit worktree eksperimen milik sesi lain untuk mengambil hasilnya.
7. Jangan menganggap sesi lain dapat dibaca/dikirimi pesan. Gunakan sarana koordinasi yang tersedia; jika tidak ada, tulis handoff untuk diteruskan pengguna. Inventory Git/worktree membuktikan file lokal, bukan status atau persetujuan sesi lain.
8. Jangan mengklaim perubahan Figma, tes atau sistem eksternal tanpa akses dan hasil nyata. Siapkan hasil review serta catat hambatan.
9. Selesai berarti acceptance criteria terpenuhi, bukti tersedia, dokumentasi relevan diperbarui dan risiko tersisa dijelaskan. Hasil gagal tetap gagal.

| Sumber kebenaran | Isi |
| --- | --- |
| [product.md](product.md) | Tujuan, pengguna, scope, ukuran keberhasilan dan target rilis. |
| [backlog.md](backlog.md) | ID, prioritas, owner, status, dependency, acceptance criteria dan target. |
| [design.md](design.md) | Arah desain, flow, state dan rujukan Figma/standar UI. |
| [architecture.md](architecture.md) | Arsitektur, batas sistem dan kontrak implementasi. |
| [decisions.md](decisions.md) | Keputusan penting, sumber keputusan dan alasan. |
| [qa.md](qa.md) | Rencana, temuan, bukti dan hasil verifikasi terbaru. |

## Batas keputusan

| Role | Kewenangan |
| --- | --- |
| Product Owner | Tujuan, scope, prioritas dan keputusan rilis. Pemilik proyek/pengguna sesi ini; belum ada penunjukan nama tim tambahan. |
| Designer | UX, visual, interaksi dan kesesuaian tampilan. |
| Architect | Arsitektur, kontrak teknis dan batas sistem. |
| BE Engineer | Implementasi backend dalam kontrak yang disepakati. |
| FE Engineer | Implementasi frontend mengikuti desain dan kontrak. |
| QA | Penilaian kualitas, temuan dan bukti pengujian; hasil gagal tidak boleh dipaksa menjadi lulus. |
| Core | Konsolidasi konteks/handoff dan integrasi; menjaga kontribusi bidang lain tetap utuh, menjalankan gate sebelum commit/merge. |

Nama individu untuk role selain Core belum ditetapkan. Owner backlog menunjukkan tanggung jawab role, bukan klaim adanya sesi aktif. Jika keputusan lintas bidang berbenturan, catat opsi, dampak dan rekomendasi; Product Owner menentukan tradeoff produk setelah menerima masukan pemilik bidang.

## Handoff

- Task ID dan tujuan.
- Keputusan atau perubahan.
- File, desain atau kontrak terkait.
- Bukti verifikasi: perintah, hasil, lingkungan dan lokasi artifact bila tersedia.
- Hambatan atau pertanyaan spesifik.
- Role penerima dan tindakan berikutnya.

Update ringkas: hasil, bukti, risiko, langkah berikutnya. Catat status saat ini di backlog dan QA sebelum handoff; riwayat hasil sebelumnya tidak otomatis membuktikan perubahan terbaru.
