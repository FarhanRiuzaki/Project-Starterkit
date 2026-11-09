# SunnyGo — product brief

Diperbarui 8 November 2026 oleh **Product Lead (Product Owner + Software Architect)** sesuai mandat Sesi 1. Pemilik mengonfirmasi target pertama: **template siap dipakai lokal; kapasitas tim belum ditentukan**. Riwayat integrasi Core tetap sebagai riwayat, bukan peran sesi ini. Tugas ini tidak mencakup deployment.

**Status terkini:** Batch A diterima untuk penggunaan lokal (DEC-023): satu menu Users, activity lebih jelas, copy undangan sesuai fakta dan auto-permission Superadmin terverifikasi. URL operasional lokal hanya http://localhost:3000 sesuai instruksi9November2026; backend internal4000. Main sudah terintegrasi pada c459bb0; CI penuh masih perlu stabilisasi (DEC-024). Rilis template keseluruhan tetap mengikuti REL-001.

## Tujuan dan pengguna

SunnyGo membantu developer/tim membangun aplikasi internal atau admin tanpa mengulang autentikasi, akses, audit, UI responsif dan setup database. Hasilnya adalah repository yang dapat disalin, dijalankan dan diperluas dengan pola yang terbukti. Pengguna aplikasi turunannya adalah administrator, pengelola akses dan pengguna internal. Persona ini diturunkan dari README/spesifikasi; belum divalidasi melalui riset pengguna.

Nilai rilis pertama: setup yang dapat diulang, batas keamanan yang tetap terjaga ketika modul ditambahkan, dan contoh end-to-end yang mudah diikuti. Tidak perlu menambah fitur domain untuk membuktikannya: `projects` sudah tersedia.

## Audit kondisi aktual

Baseline source: `2ba4b9f`, branch `main`; working tree bersih sebelum Sesi 1. Audit membaca source, manifest, CI, kontrak, migrasi, tes dan catatan sebelumnya. Ini bukan pentest atau audit visual baru.

| Area | Fakta dan bukti | Implikasi |
| --- | --- | --- |
| Stack | Manifest: Bun 1.4.3; Next 16.4.5/React 19.3.0 di Node 24; Elysia 1.4.30, Drizzle 0.45.4, PostgreSQL 18, zod 4.6.7, Tailwind 4.3.3. Versi persis mengikuti manifest/lockfile. | Pertahankan stack; tidak ada kebutuhan yang membenarkan migrasi atau dependency baru. |
| Modul | Registry API: health, auth, oauth, me, rbac, users, audit, dashboard, projects; feature web terkait dan `/ds` tersedia. | Fokus kesiapan penggunaan ulang dan koreksi, bukan membangun ulang fondasi. |
| Kontrak/data | DTO zod dan endpoint terdokumentasi; migrasi 0000–0005; projects memiliki CRUD, permission, unique name, search dan activity. | Gunakan projects sebagai contoh; organisasi tunggal, tanpa isolasi tenant. |
| Verifikasi Sesi 1 | `bun run check` exit 0: UI 729 + shared 10 + web 266 + API 523 = **1.528 tes lulus**; typecheck dan lint lulus. Node 24.21.0, **Bun host 1.4.4**, PostgreSQL 18; database khusus berakhiran `_pl_s1_test`. Log `.superpowers/scratch/product-lead-s1/check.log`. | Bukti diagnostik saat ini; belum menggantikan gate kandidat rilis dengan Bun pin 1.4.3 atau sign-off QA. Lint juga mengeluarkan diagnostic React-version detection; exit tetap 0. |
| Build/browser historis | [QA](qa.md): build/budget 22 route lulus, `/users` **250,0 kB gzip**. Full E2E tiap OS: 323 pass, 96 skip, 2 fail; kasus gagal lulus retest 3 kasus setelah koreksi locator. Log Core yang dirujuk tersedia lokal. | Hasil gagal historis tetap dicatat. Perlu bukti kandidat rilis pada revisi konsisten; ukur headroom JS. Sesi 1 tidak menjalankan ulang build/E2E. |
| Desain | [Kebijakan versioning](standards/figma-versioning.md) mencatat migrasi baseline selesai dan terverifikasi, tetapi [design.md](design.md) serta backlog lama menyebut belum. Review Figma projects belum tercatat. | Designer merekonsiliasi catatan; jangan mengulang migrasi yang sudah tercatat selesai. Tidak ada pemeriksaan/perubahan Figma langsung di Sesi 1. |
| Operasi/integrasi | [Staging readiness](staging-readiness.md) hanya membuktikan rehearsal lokal HTTP; belum ada staging eksternal atau bukti provider nyata. Docker daemon tidak tersedia saat audit Sesi 1. | Tidak menghalangi target lokal; membatasi klaim kesiapan produksi. |
| Dokumentasi/distribusi | Tidak ada file LICENSE terlacak. Sebagian peta README belum menyebut projects meski registry dan bagian lain sudah. [team.md](team.md) masih berkonteks sesi Core. | Selaraskan dokumentasi dan putuskan distribusi sebelum rilis. Mandat empat role saat ini tercatat di sini. |

## Riwayat audit awal setelah handoff QA/Designer

QA Sesi 4 pada baseline yang sama menemukan gate ukuran false pass: `/users` **256.048 byte**, lebih 48 byte dari batas 256.000; angka 250,0 kB sebelumnya adalah hasil rounding. E2E S4 mencatat **324 pass / 96 skip / 1 fail**; kasus gagal kemudian lulus retest 3/3 tanpa patch, sehingga full run awal tetap gagal. Bukti dan severity tetap di qa.md. Designer juga mereproduksi Cancel yang menghilangkan draft serta duplicate error yang tidak terhubung ke Name; stale edit dan normalisasi form gagal menurut QA.

**No-go rilis lokal pada baseline awal ini; keputusan revisi filter terbaru ada di DEC-020.** DEC-015 dan tabel triase backlog mengotorisasi koreksi gate/Cancel P0, duplicate/stale/trim P1 dan diagnosis intermiten. QA memverifikasi ulang; Designer mereview hasil visual. Desain filter tetap berjalan paralel. Estimasi koreksi 1,75–3 hari Developer + diagnosis ≤0,5 hari mencakup bagian DEV-002; bila tidak terserap cadangan, target bersyarat dapat bergeser 1–2 hari. Belum ada tanggal komitmen.

## Scope MVP yang diputuskan

| Masuk rilis template lokal | Batas penerimaan |
| --- | --- |
| Setup dan developer experience | Fresh checkout → frozen install → setup/migrate/system + demo seed → sign in dan CRUD contoh. Env contoh aman; proses dapat diulang tanpa reset database pengguna. |
| Akses dan keamanan yang sudah ada | Password, TOTP/recovery, session, profil/security, users dan RBAC; pertahankan BFF/CSRF/internal token, guard, redaksi, concurrency dan aturan eskalasi. |
| Audit/dashboard | Activity dan sign-in log, CSV aman, dashboard sesuai source; tidak menjanjikan metrik domain produk turunan. |
| Contoh perluasan projects | List/detail/create/edit/delete, active/archived, search/paging/sort, permission dan audit; bukan produk project management. |
| UI bersama yang sudah ada | Light/dark, palette/density, responsive shell, tabel server-side, filter URL/saved views, form/state dan `/ds`; lima state, keyboard dan touch mengikuti standar. Tidak menambah katalog komponen. |
| Adapter dan tooling | LDAP/Google/Apple tetap opsional; mock/log untuk lokal dijelaskan. SMTP delivery, TLS ingress dan provider nyata tidak diklaim terverifikasi. CI/check, E2E, budget dan panduan modul ikut template. |

Di luar MVP: multitenancy, billing backend, signup baru, transport upload/storage server, notifikasi/queue/broker, Redis, layanan baru, redesign, modul domain tambahan, deployment eksternal dan sertifikasi produksi. Komponen upload/galeri bukan layanan server. Key rotation TOTP dan admin reset 2FA belum menjadi scope fitur; keterbatasannya wajib terlihat di panduan operasi.

## Ukuran keberhasilan dan gate rilis

1. Developer dan QA mengulang quick start di checkout/database terisolasi tanpa langkah tak terdokumentasi. Catat durasi aktual; belum ada target durasi onboarding yang disepakati.
2. QA menerima bukti frozen install, `check`, build produksi, budget ≤250 kB gzip semua route dan E2E kandidat dengan Bun 1.4.3/Node 24/PostgreSQL 18. Skip dijelaskan; hasil gagal tetap gagal.
3. Flow inti dan kegagalan terbukti: sign in/2FA/logout, RBAC/penolakan akses, CRUD projects dan audit, filter/Back/saved views serta CSV. Tiga viewport mengikuti konfigurasi Chromium; WebKit/real-device tetap di luar bukti.
4. Designer menyelesaikan review projects dan rekonsiliasi status desain; blocker tugas inti selesai. Temuan lain hanya dapat menjadi risiko rilis bila dinilai QA dan diterima eksplisit Product Lead.
5. Panduan kontrak/modul, batas provider/lokal, keputusan distribusi dan risiko konsisten. Tidak ada defect terbuka yang memungkinkan bypass akses, kehilangan data, setup gagal atau flow inti terhenti.

**Keputusan saat ini: revisi filter diterima untuk penggunaan/review lokal (DEC-020); rilis template keseluruhan menunggu REL-001**. Deployment produksi belum dinilai siap. Check Sesi 1 bukan sign-off QA. Versi/tanggal rilis belum dipilih; versi Figma `v1.0.0` tidak menentukan versi rilis template.

## Milestone dan perkiraan timeline

Kapasitas dan tanggal mulai belum tersedia. Skenario berikut **target, bukan komitmen**: satu Developer 5 hari fokus/minggu; Designer dan QA masing-masing 2–3 hari fokus/minggu; Product Lead tersedia untuk keputusan/handoff. D1 berarti hari kerja saat kapasitas itu tersedia. Tugas Ready boleh dimulai sekarang.

| Milestone | Target relatif | Hasil / exit criteria |
| --- | --- | --- |
| M0 — baseline dan kontrak kerja | Sesi 1 | Audit, scope, backlog, kontrak dan handoff pertama tersedia; PL-001 selesai. |
| M1 — bukti celah dan review | D1–D2 | DEV-001/002, DES-001/002 dan QA-PLAN-001 menghasilkan daftar koreksi, pemilik serta dampaknya. |
| M2 — tutup blocker lokal | D3–D5 | DEV-003/004 sesuai temuan/desain, dokumentasi dan keputusan distribusi selesai. Anggaran koreksi awal 1–2 hari Developer; bukan janji semua temuan muat. |
| M3 — kandidat rilis | D6–D7 | QA-REL-001 menghasilkan bukti revisi kandidat yang sama; REL-001 memberi go/no-go beserta risiko. |
| Cadangan | D8–D10 | Retest, kegagalan environment dan waktu review bila diperlukan. |

Target jalur lokal **7–10 hari kerja** pada skenario ini. Effort awal: Developer sekitar 3–5 hari, Designer 1,5–2,5 hari, QA 2–3 hari, Product Lead 1–2 hari, dengan kerja paralel. Tunggu akses/keputusan tidak termasuk effort. Jika kapasitas berbeda atau koreksi melewati anggaran, hitung ulang sebelum memberi tanggal; staging/provider tidak termasuk estimasi.

## Permintaan aktif: sidebar filter live dan multiselect

Pemilik memperjelas referensi Bifrost lewat gambar open dan hidden: panel default collapsed menjadi rail vertikal floating kanan dengan ikon/badge/label Filters; expanded berbentuk sidebar berkelompok, multiple checkbox, **auto-apply tanpa tombol Apply**, Clear all langsung. Arah lama modal/scalar/draft-Apply di bawah menjadi riwayat; hasil uji lama tidak meluluskan scope baru.

Perubahan ini masuk scope kerja filter saat ini. OR dalam kelompok, AND antar-kelompok; URL/Back/views/chips tetap bekerja. Implementasi mencakup kontrak/API filtering server, CSV dan users bulk agar hasil konsisten lintas page. Domain, facet counts server, migration dan dependency baru tidak ditambahkan. DEC-017 merinci repeated parameters, limit 50 nilai/field, search debounce 300 ms dan kompatibilitas scalar/view lama. Designer menentukan ukuran/offset/phone dan coverage/fokus tanpa scrim desktop.

Developer memperkirakan **3,5–5 hari fokus** untuk delta FE+API/tests/budget, mengganti filter lama 1–2 hari; target skenario keseluruhan menjadi **12–18 hari kerja**, menggantikan 9–13 bila semua perubahan ini masuk kandidat. Tetap target bersyarat, kapasitas/kalender belum diketahui. Bugfix/account-menu yang sudah terbukti dipertahankan; tidak mengulang pekerjaan tanpa perubahan relevan. FIL-DES-002/FIL-API-001/FIL-QA-003 dapat berjalan paralel sekarang; FIL-DEV-002 dan FIL-QA-004 meneruskan ke implementasi/verifikasi.

Revisi posisi terbaru (DEC-018): rail/sidebar mulai di bawah **PageHeader**, sejajar tepi atas komponen konten pertama; pada Permissions adalah card/table. Tombol Add permissions dan aksi header page tidak boleh tertutup. Acuan navbar/global-header+16 sebelumnya dibatalkan. Koreksi ini diteruskan ke Designer FIL-DES-003, Developer FIL-ANCHOR-001 dan QA FIL-QA-004, tanpa mengubah API/live-checkbox. Implementasi kini diterima pada kandidat DEC-020.

Revisi berikutnya (DEC-019): collapsed rail harus pendek mengikuti isi, bukan tinggi penuh; toggle menggunakan ikon sidebar existing. Pemilik juga melaporkan flicker saat refresh, sehingga diagnosis/perbaikan first-paint/hydration menjadi bagian acceptance kandidat. Anchor DEC-018 dan live multiselect tetap. Designer FIL-DES-004, Developer FIL-COLLAPSE-001/FIL-REFRESH-001 dan QA FIL-QA-004 menerima steering. Diagnosis/perbaikan dan retest kini selesai pada kandidat DEC-020; estimasi awal diagnosis adalah 0,5 hari fokus.

**Revisi filter selesai dan diterima untuk penggunaan lokal — DEC-020.** Kandidat runtime `7baa40b391212ceb142afe667b7882705bdf98930561f420d27b5a5d0b66f117` mempertahankan anchor komponen pertama setelah PageHeader, rail pendek mengikuti isi, ikon sidebar, multiple checkbox dan auto-apply. QA menyelesaikan retest independen: 95 browser pass/0 fail/50 skip viewport, API143 pass dan web38 pass; delapan cold/warm refresh stabil sejak frame visible. QA menutup S4-BUG-001/002/003, QA-FIL-001 dan QA-EVID-001. Designer menerima scoped Permissions rail/refresh Mac+Linux; Figma tetap In review. Hasil ini bukan full E2E final atau approval seluruh desain; atribusi dan batas bukti ada di [QA](qa.md).

Preview lokal finalcopy: **http://127.0.0.1:3453**, akun demo mengikuti README, database preview terpisah. Budget22route lulus tepat-byte; `/users`255800byte menyisakan200byte, diterima dengan gateCI256000 tetap. Tooltip intermiten lama tidak tereproduksi pada kandidat tetapi akar masalah belum terbukti; tetap monitoring. Rilis template keseluruhan, versi/distribusi dan konsolidasi review tetap mengikuti REL-001; tidak menghalangi penerimaan revisi UI yang diminta.

## Riwayat permintaan sebelumnya: review filter — superseded DEC-017

Pemilik meminta panel filter mandiri seperti referensi gambar: default collapsed, floating di kanan layar, tombol pembuka di luar header tab. Review source menemukan `FilterLayout` sudah shared dan default closed; yang berbeda adalah trigger di `Panel toolbar` dan panel sticky dalam gutter yang menyempitkan hasil. Arah produk diterima; detail UX masih menjadi keputusan Designer dan belum ada kode UI yang diubah.

Rekomendasi untuk direview Designer: launcher di tepi kanan yang membuka panel floating, kelompok filter yang dapat dibuka/tutup, applied badge/chips tetap terlihat saat panel tertutup. Pertahankan Apply/URL/Back; jangan menganggap referensi meminta facet counts atau kontrak multiselect baru. Kontrak minimum ada di [architecture](architecture.md#kontrak-filter-aktif--dec-017); penugasan FIL-DES-001/FIL-DEV-001/FIL-QA-001/002 ada di [backlog](backlog.md#permintaan-masuk--review-floating-filter).

Review dan handoff masuk pekerjaan sekarang. Jika implementasi diambil sebelum rilis MVP, tambahan estimasi Designer 0,5–1 hari, Developer 1–2 hari, QA 0,5–1 hari berpotensi menggeser jalur kritis 2–3 hari: target skenario **9–13 hari kerja**, bukan komitmen. Scope kandidat harus dicatat sebelum QA-REL-001; jika filter masuk, hasil verifikasinya ikut gate REL-001.

## Urutan empat role dan perubahan prioritas

Product Lead menyelesaikan batas/dependency; Designer mengeksplorasi kebutuhan dan state sebelum koreksi UX dikunci; Developer memeriksa setup/bundle dan memilih detail implementasi dalam kontrak; QA ikut menyusun AC sekarang, lalu memverifikasi kandidat dan retest. Designer, Developer dan QA dapat memulai tugas Ready secara paralel. [Handoff pertama](backlog.md#handoff-pertama) berisi input, output dan batas masing-masing.

Nama individu/kapasitas belum diketahui. Sesi sunny-designer, sunny-developer dan sunny-qa teridentifikasi. Setelah kegagalan awal `active writer`, retry atas instruksi pemilik berhasil: tool menerima handoff untuk ketiganya. Ini membuktikan pengiriman, bukan penyelesaian pekerjaan. Rencana QA Sesi 4 teramati di qa.md. Designer memiliki `design.md`, QA memiliki `qa.md`; Product Lead mengajukan koreksi melalui handoff. Konteks Core di `team.md` masuk PL-002. Konflik kebutuhan/prioritas diputuskan Product Lead; UX/visual oleh Designer; kontrak/invariant oleh Product Lead sebagai Architect; detail implementasi oleh Developer; hasil tes oleh QA.

Permintaan mendadak harus memiliki ID, owner, dependency, AC, effort dan tugas yang tergeser. Tambahan 2 hari Developer pada jalur kritis menggeser target hingga 2 hari sebelum retest, kecuali scope setara dipangkas. P0 keamanan/data mendahului pekerjaan lain. Product Lead memperbarui scope, target dan keputusan tanpa memasukkan scope diam-diam.

## Asumsi dan informasi terbuka

| ID | Belum tersedia / asumsi | Owner dan dampak |
| --- | --- | --- |
| A-01 | Persona berasal dari dokumen; riset/adopsi belum diukur. | Designer, DES-002; tidak menghalangi audit lokal. |
| A-02 | Nama, kapasitas dan kalender tim belum diketahui. | Product Lead, PL-002; menghalangi komitmen tanggal, bukan tugas Ready. |
| O-01 | Nomor/tanggal rilis dan distribusi belum dipilih; LICENSE belum ada. | Product Lead, PL-002/003 sebelum REL-001; jangan menebak lisensi atas nama pemilik. |
| O-02 | Status desain bertentangan; review projects belum tercatat. | Designer, DES-001/002; kebijakan terbaru adalah bukti tertulis, bukan verifikasi live Sesi 1. |
| O-03 | Budget pinned dan QA lulus; kandidat Batch A `/users` menyisakan400byte. | Developer DEV-002, QA QA-REL-001; gate resmi tetap256000byte; risiko400byte diterima DEC-023, target245KiB bukan blocker tambahan. |
| O-04 | Staging/provider nyata, restore drill produksi, RUM dan kapasitas representatif belum terbukti. | OPS-001/002 dan INT-001 tahap berikutnya; tidak menjanjikan kesiapan produksi. |

Rincian: [arsitektur](architecture.md), [backlog](backlog.md), [keputusan](decisions.md). Bukti/verdict pengujian tetap milik [QA](qa.md).


## Riset pengembangan berikutnya — DEC-021

8 November 2026. Permintaan pemilik: riset fungsi yang layak ditambahkan/disederhanakan setelah revisi filter; contoh menu Users redundant dan detail activity log. Ini audit source + pembanding publik, bukan implementasi fitur baru atau usability study. Review source-only Designer, Developer dan QA sudah diterima; tidak ada kode atau test run baru. Tidak mengubah kandidat filter DEC-020, source produk atau preview.

| Prioritas usulan | Kondisi yang benar-benar ada | Rekomendasi dan nilai |
| --- | --- | --- |
| P1 — satu menu Users | `lib/shared/nav.ts` mempunyai All/Active/Inactive, semuanya `/users` dengan query status. Filter multiselect, chips, saved/remembered views sudah tersedia. | Hapus duplikasi entry navigasi; status tetap di filter/views. Klik Users mempertahankan remembered-view existing, bukan diam-diam mereset ke All; URL lama dan G U tetap valid. Roles/Permissions tetap area terpisah karena tugasnya berbeda. |
| P1 — activity mudah dipahami | `activity-page.tsx` sudah menampilkan actor/action/target/time dan modal before/after. `diff-view.tsx` memakai key mentah, array diratakan jadi koma; payload RBAC added/removed bukan snapshot lengkap. Deskripsi/empty hint belum menyebut Projects. | Ringkasan siapa melakukan apa pada objek mana; field label bisnis, diff added/removed, create/delete dan aksi tanpa snapshot dibedakan. Pertahankan fallback field/action lama dan redaksi. Contoh: “Rina menonaktifkan Budi”, Status Active → Inactive. |
| P1 — detail audit dapat ditelusuri | Modal sekarang memakai local `useState`; API audit hanya dua GET list/CSV. Filter activity tersedia untuk actor text/action/time, belum target exact atau lookup entry by ID. | Copy link kejadian, reload/Back tetap membuka entry meski berada di page/range lain; filter exact actor dan target type+id; tautan target hanya jika dapat diakses dan masih ada. Metadata request dipisah dari perapian UI. |
| P1 — email lokal dan pesan yang jujur | `sendMail` fire-and-forget; mode log hanya menulis alamat masked+subject. UI create user tetap mengatakan invitation link “was sent”, termasuk ketika delivery belum terkonfirmasi. | Koreksi copy agar account created tidak berarti email delivered. Tambahkan panduan/profile inbox SMTP lokal opsional untuk mencoba reset/invite end-to-end. Tidak menjanjikan retry/delivery tanpa bukti atau menampilkan token di log. |
| P1 — lifecycle invitation | Create invite72jam dan single-use sudah ada. DTO user belum membawa invitation state; belum ada resend/revoke. Janitor membuang expired token; absence/password-null tidak cukup untuk menentukan accepted/expired/revoked. | Pending/accepted/expired/revoked berdasarkan state authoritative, resend mengganti link lama, revoke mengakhiri undangan. Status lifecycle terpisah dari status pengiriman dan Active/Inactive user. Memerlukan desain/kontrak/migration sebelum coding. |
| P1 — failure-path sign out | Client account menu menelan error logout lalu redirect; BFF membersihkan cookie setelah backend response tanpa memastikan revocation sukses. | Audit failure browser→BFF terpisah dari BFF→API; pastikan feedback/pemulihan dan klaim logout sesuai fakta. Ini risiko source, bukan verdict bug runtime; verifikasi sebelum cosmetic account cleanup. |
| P2 — account entry yang ringkas | Menu avatar memiliki Profile/Security/Sessions yang diulang MeNav; menu juga menampung theme/palette/density, sidebar mempunyai Profile. | Satu entrance Account settings dengan section ber-URL; Sign out tetap langsung. Security/Sessions/deep link/unsaved guard tetap. Quick theme diputuskan dari kebutuhan akses cepat; jangan memindahkan semuanya tanpa evaluasi. |
| P2 — penjelasan akses | User detail sudah menampilkan effective permissions; role detail sudah menampilkan add/remove dan dampak ke userCount. | Tambahkan asal permission dari role yang boleh dilihat, misalnya `project.edit` berasal dari Editor. Ini penjelasan, bukan engine otorisasi baru; jangan mengulang matrix/impact yang sudah ada atau menambah impersonation. |
| P2 — tooling penggunaan ulang | Setup dan panduan penambahan modul sudah ada; root scripts belum mempunyai doctor atau generator. | Doctor read-only untuk runtime/env-key/database/migration/integration mode. Setelah pola stabil, generator modul lokal dengan dry-run dan no-overwrite; kurangi wiring manual tanpa membuat framework baru. |

Tambahan pemilik yang **wajib**, bukan kandidat opsional: setiap permission yang berhasil didaftarkan melalui jalur resmi otomatis menjadi milik role Superadmin. Implementasi sudah ada: createPermissions melakukan catalog+grant+audit dalam transaksi; system seed menambahkan seluruh catalog ke Superadmin; effective permissions dibaca ulang per request. Akun aktif pemegang role Superadmin mendapatkan hak pada request berikutnya tanpa logout. Admin/Viewer existing tidak otomatis menerima hak baru. Nama di source harus diregistrasikan melalui seed saat modul ditambahkan; entry catalog sendiri tidak menciptakan endpoint/aturan bisnis. Catatan ini berdasarkan source/tes existing yang dibaca, bukan test run baru. Guard, account inactive, locked role dan aturan anti-escalation tetap berlaku.

Urutan rekomendasi: batch A satu Users + audit readability + pesan invitation yang jujur; batch B shareable audit/target filter + inbox lokal; batch C lifecycle invitation setelah state/races disepakati. Account cleanup dan permission explanation sesudah alur utama jelas; doctor/generator masuk jalur developer experience. Request context IP/device/requestId bernilai untuk investigasi tetapi sesudah detail dasar, bukan syarat membuat audit mudah dibaca. Provider baru, multitenancy, billing, notification center, realtime, impersonation dan workflow engine ditunda karena kebutuhan belum terbukti.

Forecast awal Product Lead untuk batch A: Developer2–4hari fokus, Designer0,5–1hari, QA1–1,5hari; termasuk buffer integrasi dan review gap invariant permission; target elapsed3–6hari kerja bila kapasitas tersedia dan dependency desain cepat, **bukan komitmen/tambahan otomatis ke rilis**. Batch B/C diestimasi per task di backlog; jangan menjumlah semua kandidat menjadi jadwal rilis. Kapasitas, frekuensi penggunaan, persona/adopsi, pilihan delivery dan volume audit aktual tetap unknown. Success criteria: satu jalur Users yang menjaga filter, admin bisa menjelaskan perubahan dari event tanpa membaca raw JSON, tautan entry dapat dibuka ulang secara berizin, dan pesan email sesuai fakta yang diketahui. Belum ada metrik waktu/usability baseline.

Pembanding ditinjau8November2026, dipakai untuk pola bukan keputusan mengganti stack: [WorkOS audit model](https://workos.com/docs/audit-logs) memisahkan actor/action/targets/context; [GitHub audit filters](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization) mendukung penelusuran actor/action/resource; [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) membahas atribut event/korelasi dan data yang dikecualikan. [GitHub invitations](https://docs.github.com/en/organizations/managing-membership-in-your-organization/canceling-or-editing-an-invitation-to-join-your-organization) memberi contoh pending/cancel; [Mailpit](https://mailpit.axllent.org/docs/) menyediakan inbox SMTP lokal/API pengujian; [Clerk account portal](https://clerk.com/docs/guides/account-portal/overview) mengelompokkan profile/security. [NN/g navigation](https://www.nngroup.com/articles/vertical-nav/) menekankan kategori yang jelas dan mudah ditemukan; rekomendasi menghapus tiga child Users adalah kesimpulan audit repo, bukan aturan universal dari artikel. [Django startapp](https://docs.djangoproject.com/en/dev/ref/django-admin/#startapp) adalah contoh tooling template, bukan usulan migrasi framework.

Feasibility Developer diterima (hari fokus, termasuk tes/docs, di luar QA/Designer): Users0,5–1; audit readability0,5–1; audit lookup/target1,5–3; request metadata1,5–2,5; inbox0,5–1; doctor1–1,5; invitation3–5; scaffold2–4. Batch A forecast2–4hari Developer tetap konservatif dengan buffer integrasi dan gap regresi auto-Superadmin. QA menambahkan audit failure-path Sign out sebagai discovery sebelum account cosmetic, belum temuan runtime/severity.


## Batch A diotorisasi — DEC-022

Pemilik memberi go untuk batch pertama: satu menu Users, activity readability, pesan undangan yang mencerminkan fakta, dan regresi auto-permission Superadmin. Designer menentukan spesifikasi/copy sebelum detail UI dikunci, Developer mengimplementasikan, QA menyusun oracle lalu memverifikasi kandidat, Product Lead menjaga kontrak/prioritas dan memutuskan penerimaan lokal. Handoff konkret terdapat pada backlog batch A. Research kandidat lain tetap usulan; shareable audit endpoint, request context, inbox/lifecycle invite, account cleanup dan DX belum menjadi implementasi batch ini.

Baseline runtime DEC-020 tetap rujukan regresi. Full check pinned, budget tepat256000byte, targeted E2E dan QA/Designer kandidat baru diperlukan sebelum pekerjaan dinyatakan selesai. Forecast2–4hari Developer fokus tidak menjadi janji tanggal karena kapasitas belum ditentukan; pergeseran karena defect/budget dilaporkan saat terbukti.

Kandidat Batch A tersedia untuk review di http://127.0.0.1:3454 (baseline3453 tetap), runtime-source `ca1f803c1d7cc72abc64d22b3ce757295c9a6cf69d7da9148b2cb4bb878d359c`, product/test-source `3790e085ee1738a5e6027690786158cbc7028193e89c34cf5ba23cc2864714ba`, build `6itnZmu8wVgOUoML63Na2`. Root menghitung ulang478/693files dan cocok; loginHTTP200. Bukti Developer finalfullcheck1576, browser63pass, CPU4cold30pass serta budget22route lulus; QA independen dan visual binding kini selesai; kandidat diterima melalui DEC-023.


## Hasil batch A — DEC-023

Empat perubahan selesai dan diterima untuk penggunaan lokal pada hash/build kandidat di atas: satu Users yang mempertahankan remembered views/status/URL, activity detail/CSV dengan label serta delta yang konsisten dan phone layout terbaca, feedback undangan yang tidak mengklaim delivery, serta regresi auto-grant Superadmin untuk API/seed/sesi aktif tanpa memberikan hak otomatis ke non-SA. Stabilitas shared menu/popover juga diperbaiki setelah race cold-open dibuktikan; fokus keyboard dan controlled-owner rejection dipertahankan.

QA menyatakan lima temuan batch A Closed / verified dan merekomendasikan penerimaan scoped lokal. Independen63browser+30CPU4cold,135API dan shared23/UI28/web11 lulus; Designer menerima13PNG final dan source/build binding. Developer fullcheck1576 lulus pada Bun1.4.3; budget22route diukur ulang QA tepat-byte, Users255600/headroom400. Batas bukti: macOS/Chromium emulation, bukan fullfinalLinux/WebKit/realdevice atau provider nyata. Risks/historical failures tetap tercatat di QA; source tetap beku, tidak ada commit/merge/deploy. Kandidat batch B/C dan keputusan distribusi/versi tetap terpisah dari selesainya batch A.


## Prioritas setelah integrasi — DEC-024, 9 November2026

Pemilik meminta langkah berikutnya. Pengecekan aktual menemukan CI untuk commit main `c459bb0d662cb756810f3030709d6fe0323aac0a` sudah selesai dengan failure: job check dan gitleaks success, E2E shard1/2/4 gagal dengan total5kasus, shard3 success. [Run42502573858](https://github.com/FarhanRiuzaki/Project-Starterkit/actions/runs/42502573858). Hasil lokal/QA sebelumnya tetap sah pada scope/platform yang dicatat; itu bukan bukti fullLinuxCI hijau.

Dua stale oracle terbukti dari source/log: ds-components masih mencari `.nav-tree-branch` pada Users setelah child Users dihapus; permissions.spec masih memakai label/helper invitation lama. Dua screenshot galeri mobile light/dark berosilasi tinggi37119/38012px, dan first-paint Users mobile dark/reduced mencatat blank region; tiga kasus ini belum ditetapkan sebagai produk vs harness/lingkungan. Jangan menyebut flake/fixed tanpa reproduksi atau menyetujui snapshot baru/timeout untuk meluluskan.

Rekomendasi: stabilisasi CI dahulu, lalu NEXT-AUD-002 (shareable detail dan exact actor/target investigation,1,5–3hari Developer), kemudian NEXT-INV-001 (lifecycle invitation3–5hari setelah model dan delivery-test strategy jelas). Account cleanup/access explanation/DX tetap berikutnya. Estimasi stabilisasi belum dikunci; diagnosis0,5hari fokus untuk tiga kasus non-oracle lalu reforecast berdasarkan akar masalah. Ini prioritas dan spesifikasi berikutnya; belum menjalankan implementasi tambahan atas pertanyaan “what next”.

Runtime preference pemilik: frontend hanya3000, API internal4000; preview3453/3454 dan API4453/4454 sudah dihentikan. Preview links345x pada riwayat menunjuk evidence masa verifikasi, bukan server aktif. Node24/Next dev pada3000 direstart dan cache dev lama diarsipkan; DB/akun tidak diubah. Rencana pengujian berikutnya harus menjaga dev3000/data; jangan menghidupkan preview host lain diam-diam.


## Batch dipilih — audit investigasi, DEC-025

Pemilik memilih nomor1 melalui “gas 1”: bangun copy link kejadian, filter actor/target persis, dan akses riwayat dari detail user/project. Detail entry tetap dapat dibuka di luar page/range/filter list; log snapshot bertahan saat record actor/target dihapus. History link memakai Last90days yang jelas, bukan klaim seluruh retention. Kejadian dipilih melalui entry query; pilihan entry tidak menjadi named/rememberedview.

Urutan fitur ini mendahului rekomendasi stabilisasi CI DEC-024 atas pilihan pemilik. Lima kegagalan CI tetap diketahui dan tidak disebut fixed; penerimaan baru memerlukan bukti scoped dan risiko CI tetap disampaikan. Invitation lifecycle dan metadata request audit belum masuk. Forecast Developer1,5–3hari fokus, Designer0,25–0,5 dan QA0,5–1 sebagian overlap, belum komitmen tanggal karena kapasitas belum tersedia. Tiga role menerima penugasan melalui thread koordinasi, Developer mulai API/tests sembari Designer/QA menyelesaikan handoff/oracle.

Pengujian tidak mengubah dev3000/API4000 atau akun/data pengguna: Docker internal tanpa published host ports memakai DB/cache/akun fixture sendiri. Tidak ada preview host baru, reset devDB, commit/merge/push dari pilihan ini.

Progress komponen: QA independen API/shared lulus188API +3probeQA +27shared pada230input hash59fc263d…135de, terverifikasi PL bersama evidence/envelope tanpa mismatch. Run memakai app.handle host dengan DB QA sendiri dan tanpa listen/port; bukan browser produksi. UI/URL final, production Docker browser, visual review, bytebudget dan final source binding masih dikerjakan, sehingga fitur belum dinyatakan diterima.

Candidate bytegate: build iyOjDEw-xlEJIvzpGFBpX meluluskan22route; Activity255997byte/headroom3, Users255965/35, Auth255742/258. Threshold256000 tidak diubah atau dibulatkan. Source dibekukan untuk verifikasi final, tanpa optimasi tambahan setelah gate lulus. Margin sangat sempit menjadi risiko eksplisit; QA/Designer final dan final source binding belum selesai pada catatan ini.

Review kandidat membuka AUD2-DES-001: detail opaque target dengan edgewhitespace/control perlu quoted presentation agar identitas tidak tampak menyatu. Koreksi wajib sebelum penerimaan visual; API/DTO/filter/CSV tidak berubah. Build kandidat lama tetap evidence baseline; source/build baru akan dibekukan setelah QA slot selesai, bytegate dan affected verification diulang. Status fitur masih dalam verifikasi, belum accepted.

R2 sesudah explicit QA slot return: build vw_fJi0Zpw9N0jU-Y-2sr berhasil,711product/486runtime, runtime4f29f9d4455c36eff8b7f6fda499cbbc53362f10d3ccacde9cf8ad031afc966e/product71796c39790608b06ed2d8e9f49d2a8cc89e220e6e73172e39ac61dd31d96ec8. Bytegate22 tetap identik; patch lazy formatter tidak menambah firstload pada build ini. Developer own18/fullcheck dan QA/Designer R2 review belum selesai pada catatan ini; R1 dipertahankan sebagai evidence finding.


## Hasil akhir audit investigasi — DEC-026

**GO penggunaan lokal NEXT-AUD-002**, kandidat R2 build`vw_fJi0Zpw9N0jU-Y-2sr`, runtime`4f29f9d4455c36eff8b7f6fda499cbbc53362f10d3ccacde9cf8ad031afc966e`, product`71796c39790608b06ed2d8e9f49d2a8cc89e220e6e73172e39ac61dd31d96ec8`. Activity log sekarang menyediakan Copy link/direct entry independen range/page/filter, exact actor dan target investigation dengan grouped chips, riwayat user/project90d dan known record links sesuai izin/availability. Cached403/404, deleted target, stale500, URL/Back/Close/focus, loading module/data dan failure recovery ditangani. User recent20 memakai type=user+id; entry transient tidak tersimpan sebagai named/rememberedview.

Developer fullcheck1619 dan browser18 lulus; QA independen API/shared dan R2 UI lulus serta AUD2-DES-001 Closed/verified, Designer final scoped visual accepted setelah actual mobile scroll dan settled userhistory dibuktikan. PL memverifikasi source/build/artifact/budget yang sama. Scope evidence adalah pinned runtime, PostgreSQL fixtures dan Chromium emulation; fullLinuxCI, WebKit/realdevice dan provider produksi bukan klaim keputusan ini. Catatan R1 failed/harness correction dan scroll0coverage retraction tetap ada.

Semua22route≤256000byte, Activity255997/Users255965/Auth255742: margin3/35/258byte diterima sebagai risiko lokal dan wajib diukur ulang pada perubahan berikutnya. Lima failure CI main lama tetap terbuka; localGO tidak mengubahnya menjadi pass. Tidak ada dependency/migration/index/env produksi baru, Figma edit atau commit/merge/push. Frontend tetap localhost3000, API internal4000; data/akun dev dipertahankan.

Setelah seluruh slot dikembalikan, verification Docker workbench+Postgres dihentikan tanpa menghapus volume, compiled images atau evidence. Pemeriksaan akhir login3000/ready4000 tetap200; hanya frontend host3000 dan APIinternal4000 milik dev yang dipertahankan. GitHEAD tetapc459bb0; tidak ada commit/merge/push.
