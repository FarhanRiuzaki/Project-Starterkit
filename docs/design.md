# Desain SunnyGo

Diperbarui 9 November 2026, **Sesi 2 — Designer**. Tugas aktif **NEXT-DES-003 / DEC-025 — audit investigasi**:
handoff dan scoped visual review R2 selesai, implementasi diterima untuk scope visual ini. Verdict final QA dan
QA NEXT-QA-004 Done, AUD2-DES-001 Closed / verified pada R2; rekomendasi GO lokal dikirim ke Product Lead.
Keputusan GO lokal Product Lead terpisah. **NEXT-DES-002 / DEC-022 — Batch A**:
handoff dan scoped visual review kandidat final selesai; acceptance visual diterima dan retest independen QA selesai.
**DEC-023: Product Lead menetapkan GO penggunaan lokal Batch A.** Rilis template keseluruhan tetap terpisah.
Rail/refresh FIL-DES-004 / DEC-019, anchor
FIL-DES-003 / DEC-018 dan multi/auto-apply FIL-DES-002 / DEC-017 tetap acuan. Retest baseline selesai untuk scope QA.
FIL-DES-001 di bawah merupakan riwayat yang **superseded** oleh instruksi pemilik terbaru. Referensi produk adalah
[brief](product.md), [backlog](backlog.md), [arsitektur](architecture.md), [keputusan](decisions.md) dan [QA](qa.md).
Scope mengikuti DEC-009/010: template siap dipakai lokal dan stabilisasi modul existing.

**Status terkini:** desain/handoff selesai; review visual matrix rail/refresh kandidat final Mac/Linux diterima.
QA FIL-QA-004 selesai dan temuan rail/evidence Closed / verified pada scope kandidat ini. Figma v1.0.4 tetap
**In review**, dengan verifikasi tersebut sudah dicatat di release index; persetujuan pemilik/release keseluruhan
belum diberikan. **DEC-020 sudah menerima revisi filter untuk penggunaan/review lokal**; keputusan rilis template
keseluruhan terpisah. Riwayat pending di bawah digantikan hanya untuk scope yang disebut pada hasil final.

Sumber desain: [Figma SunnyGo](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA). Arah saat ini adalah UI admin netral dengan brand SunnyGo, reusable components, semantic tokens, tray/card bertingkat, light/dark, palette dan density terpisah.

Rujukan rinci: [design system](standards/design-system.md), [UI standard](standards/ui-standard.md), [copy guide](standards/copy-guide.md), [pemetaan implementasi](standards/figma-implementation.md) dan [coverage komponen](standards/figma-component-coverage.md). Teks produk berbahasa Inggris; dokumen koordinasi tim boleh berbahasa Indonesia.

## Flow dan state

- Sign in → proof kedua jika diperlukan → dashboard atau tujuan internal yang diizinkan. Profil/security/session berada di akun; menu mengikuti permission.
- List → checkbox multi/search → auto-apply snapshot terbaru → hasil server. Scope aktif FIL-DES-002: rail/sidebar nonmodal desktop, phone launcher/sheet, tanpa Apply; page/sort/filter/range di URL, saved views milik pengguna, kolom tersembunyi di preferences. Chips tetap terlihat ketika collapsed. Baseline gutter dan FIL-DES-001 modal merupakan riwayat; implementasi baru belum disetujui.
- Detail → edit/create → validasi terhubung ke field, pending trigger dan feedback; perubahan belum tersimpan memakai leave guard.
- Delete dan bulk memakai ConfirmActionDialog dengan dampak. Perubahan tunggal yang reversible memakai Undo sesuai standar; aksi terblokir menjelaskan sebab.
- Setiap region data: loading sesuai bentuk, empty dengan petunjuk, error/retry, stale dengan data sebelumnya, dan data.
- `projects`: list/detail/create/edit, status Active/Archived, permission-aware actions dan activity; mengikuti komponen serta interaksi list bersama.

Phone 360–767 px (referensi 390), tablet 768–1279 (834), desktop ≥1280 (1440); CSS menentukan breakpoint. Tabel phone berupa cards, touch target diperluas, wide content scroll dalam card, keyboard/focus dan reduced motion dipertahankan.

## Tujuan pengalaman dan urutan flow

Pengguna diturunkan dari brief/source: administrator internal yang mengelola data dan akses, serta Developer yang
menggunakan projects sebagai contoh perluasan modul. Belum ada wawancara pengguna atau metrik keberhasilan usability;
ini asumsi kerja, bukan persona hasil riset.

| Urutan | Journey | Hasil yang dibutuhkan | Status desain/review |
| --- | --- | --- | --- |
| Fondasi | Sign in → second factor bila perlu → tujuan internal; akun dan akses mengikuti permission | Orang yang tepat dapat masuk tanpa kebocoran akses | Pola existing dipertahankan; tidak didesain ulang pada sesi ini |
| Fokus pertama | Projects → create/edit → validasi → save → detail | Satu project tersimpan dengan data valid; error dapat dipulihkan dan draft tidak hilang tanpa persetujuan | Handoff DES-002A/B siap; implementasi perlu koreksi dan retest |
| Pendukung | Projects list → filter draft → Apply → hasil; view/kolom/page | Hasil dan URL konsisten, dapat dikembalikan melalui Back | Source dan list desktop ditinjau; bukti lintas viewport dari QA S4, bukan run Designer baru |
| Pendukung | Detail → delete → konfirmasi dampak → list | Tidak ada delete tanpa konfirmasi; gagal tetap recoverable | Dialog desktop/phone ditinjau tanpa mengonfirmasi delete |
| Aktif lanjutan | Rail filter → checkbox multi/search → auto-apply | Hasil tidak reflow ketika expand; pilihan dan pemulihan tetap jelas | FIL-DES-002 / DEC-017 menggantikan FIL-DES-001; handoff aktif di bawah |

Prioritas pertama diambil dari DES-002/DEC-010: menutup risiko flow yang sudah ada, bukan menambah domain/fitur.
Bagian pendukung filter menjelaskan review baseline. Arah aktif kini FIL-DES-002 → FIL-DEV-002 → FIL-QA-004;
review Projects dan bukti FIL-DES-001 tidak meluluskan scope Bifrost baru.

## Status Figma dan versioning

**DES-001 selesai:** kebijakan [versioning](standards/figma-versioning.md) sudah mencatat migrasi baseline selesai.
Pemeriksaan live Sesi 2 membaca inventory 17 page sebelum revisi baru, teks release index `146:2`, serta tujuh section
baseline area 06 yang tetap terkunci. Nama area 00–14 sudah `v1.0.0`, index pertama dan archive terakhir. Bukti 86 lock,
526 master/set dan preservasi 13.490 relasi awal berasal dari migrasi sebelumnya, bukan audit ulang seluruh file sesi ini.

**DES-002 desain untuk review tersedia:** area 06 diduplikasi sebelum diedit menjadi
`06 · Coverage & enterprise UX · v1.0.1` (`152:17283`), ditempatkan sebelum pendahulunya. File kini mempunyai 18 page.
Area lain tetap memakai `v1.0.0`. Index mencatat perubahan patch dan pendahulunya. Status patch **In review**;
tidak ada persetujuan pemilik baru, publishing library atau native version-history checkpoint.

Baseline masters, token values/modes dan style lama tidak diedit. Revisi menambahkan keluarga Form tujuh state,
salinan dependency Textarea, ConfirmActionDialog, Notice, ErrorSummary dan header phone yang perlu reflow,
serta cerminan token CSS `--scrim` pada collection versi baru. Instance baseline tetap menunjuk master lamanya.

| Referensi | Frame / node |
| --- | --- |
| Index rilis | [Releases & versioning](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=146-2) |
| Flow dan handoff | [DES-002 / Projects safe forms](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=164-21067) |
| Semua frame review | [Projects review screens](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20338) |
| Create / required | [Create](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20339), [Required desktop](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-21317) |
| Nama duplikat | [Duplicate light](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20422), [Duplicate dark](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20609) |
| Edit → dirty Cancel | [Edit desktop](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-21234), [Confirm exit](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20509) |
| Pending save | [Saving](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20696) |
| Phone | [Edit 390](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20782), [Confirm 390](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20866), [Required 360](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-21055) |
| Recovery | [Failure phone](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-21143), [Stale tablet content](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20967) |
| Form master | [Content/Projects/Form](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=155-20457) |

Prototipe menghubungkan Create kosong → required, Cancel pada edit desktop/phone → konfirmasi, Cancel dialog →
draft yang sama, dan Leave page → frame detail konteks. Ini simulasi jalur keluar/validasi, bukan input interaktif,
penyimpanan API atau bukti save berhasil. Frame detail `159:21404` hanya tujuan konteks, bukan redesign detail.

## Fondasi visual untuk handoff pertama

- Pakai implementasi shell existing. Frame desktop selebar **1192 px adalah area konten** dalam shell 1440 dengan
  sidebar 248; tablet 770 adalah area konten dalam viewport 834 dengan rail 64. Header di Figma menjadi rujukan
  baseline; perubahan shell/nav bukan scope koreksi form. Range/refresh tidak muncul pada form Projects.
- Pertahankan semantic colors dan pola `bg → sheet → tray → card`, tanpa shadow pada card statis. Shadow untuk
  dialog/floating layer. Active memakai healthy, Archived memakai stopped; label + StatusChip dan legend dalam Panel.
- Inter untuk UI, Geist Mono hanya untuk nilai yang membutuhkan mono. Gunakan style/token existing; input touch
  16 px. Ukuran type, radius, garis dan warna mengikuti design-system, bukan nilai baru per screen.
- Header → panel berjarak 24; panel body 24 pada ≥768, 16 pada phone. Satu kelompok form, tanpa FormSection tambahan.
  Field measure desktop maksimum 576 px; card tetap mengikuti grid. Nama, deskripsi, status dan footer tersusun satu kolom.
- Reuse `Panel`, `Field`, `Input`, `Textarea`, `RadioGroup`, `Button`, `ErrorSummary`, `Notice`, `FormActions`,
  `ConfirmActionDialog`, `useLeaveGuard` dan toast. FormActions di bagian bawah form dan sticky bila form lebih tinggi
  dari viewport; fokus/keyboard tidak boleh tertutup footer. Label menjelaskan aksi, satu submit utama.
- Phone 360/390: lebar cair, dialog keluar bottom sheet, hit area pointer coarse ≥44×44, safe-area dan input 16 px.
  Tablet memakai rail; desktop memakai sidebar. Tidak ada horizontal page scroll. Warna/density tidak mengubah flow.

## State dan interaksi Projects

| State / trigger | Perilaku yang harus dibangun | Bukti / batas saat ini |
| --- | --- | --- |
| List loading / data | Skeleton berbentuk tabel/cards lalu server table; label view All/Active/Archived projects | Source dan list data desktop dilihat; loading bukan fault injection baru sesi ini |
| List kosong | `No projects yet` menjelaskan kapan data muncul; tanpa create permission jangan mengarahkan aksi yang tidak tersedia | Source; QA menutup kasus permission pada kandidat |
| Filter tanpa hasil | `No projects match`, arahkan ubah/reset filter; beda dari belum ada data | Source dan QA S4 |
| Error / stale list | Error dengan Retry; stale mempertahankan rows dan notice | Source; fault injection QA S4, bukan diulang Designer |
| Create normal | Name wajib; Description optional; status default Active; submit tetap aktif meski belum valid | Browser + Figma |
| Required / batas panjang | Validate canonical value setelah trim; Name 1–100, Description ≤500, whitespace-only Name tidak valid; fokus field pertama + linked summary | Required Name terverifikasi browser; boundary trim mengikuti kontrak dan S4-BUG-002 |
| Nama duplikat 409 | Kenali code `duplicate`, tampilkan pesan pada Name dan summary; `aria-invalid`/`aria-describedby`; fokus Name, simpan Description/Status | Copy server sudah baik; lokasi/fokus perlu DES-002B |
| Dirty Cancel / internal link | Sebelum keluar, dialog dampak. Cancel/Escape/Close mempertahankan seluruh nilai; Leave page membuang draft dan membuka tujuan yang tercatat | Internal link berhasil; Cancel form gagal dua kali, DES-002A |
| Pending | Spinner + `aria-busy`, cegah submit ganda dan Cancel; bekukan payload/field selama request agar input baru tidak hilang saat respons tiba | Figma Saving; sukses lambat/gagal perlu tes Developer/QA |
| Save gagal | Pesan recoverable dekat aksi; nilai tetap; submit bisa diulang setelah request selesai; duplicate tetap field-specific | Copy source dan Figma Failure; network failure belum dipicu ulang Designer |
| Stale edit | Simpan form/draft, tampilkan Notice live + Retry refresh; retry tidak menghapus input atau pindah fokus; hilangkan notice setelah berhasil | Gap source dikonfirmasi QA S4-BUG-001; Figma Stale siap sebagai expected UX |
| Save berhasil | Toast `Created <name>.` / `Saved <name>.`, cache diperbarui, navigasi ke detail hasil; status/description benar setelah reload | Kontrak/source + QA S4; tidak ada save record pada review Designer |
| Read-only permission | `project.view` membuka list/detail; `project.create/edit/delete` mengendalikan aksi/route; action yang tidak diizinkan disembunyikan. Rule block memakai alasan yang dapat dibaca | Kontrak/source dan QA; Designer tidak mengganti permission akun pengguna |
| 401 / 403 / 404 | Session berakhir mengikuti sign-in; forbidden/not-found punya jalan kembali yang diizinkan. Jangan menjanjikan tenant ownership | Standar + source; penolakan akses bukan uji live baru sesi ini |
| Delete | ConfirmActionDialog menyebut project/dampak/irreversibility; pending di trigger, gagal bisa diulang; sukses kembali ke list tanpa kilatan 404 | Dialog desktop/phone dilihat; tidak ada delete dilakukan Designer |
| Hover / focus / selected | Gunakan state existing Button/Input/Radio; focus ring terlihat, Tab logis, radio dengan keyboard, error summary bisa diaktifkan keyboard; selected tidak hanya warna | State library existing; keyboard/screen reader manual menyeluruh tetap gate QA |

Retry refresh pada edit adalah peringatan dan pemulihan kegagalan GET. API belum menyediakan optimistic concurrency;
desain ini tidak menjanjikan deteksi konflik edit atau menjadikan refresh sebagai transaksi pengunci. Freeze field
saat saving dan warning stale tidak menggantikan persetujuan Product Lead untuk perubahan kontrak concurrency.

## Hasil review implementasi — Sesi 2

Revisi source `2ba4b9f`, Node 24.21.0. Browser Chrome/macOS melalui Computer Use; preview produksi dari `.next-e2e`
di `localhost:3180`, API 4180, database existing berakhiran `_e2e`. Tidak ada reset, migrasi atau seed; tidak menyimpan
atau menghapus project. Akun seed demo dipakai hanya pada preview. Dev pengguna `:3000` sempat memberi 404 pada Projects;
hasil itu dicatat sebagai mismatch lingkungan/akses, bukan bug route hasil integrasi. Preview terpisah menampilkan modul.

| ID | Lokasi dan reproduksi | Aktual → expected | Dampak / status |
| --- | --- | --- | --- |
| DES-002A | Edit Apollo, ubah Name menjadi `Apollo draft`, tekan Cancel; ulang setelah membandingkan breadcrumb | Cancel langsung kembali ke detail, draft hilang. Breadcrumb menampilkan `Leave without saving`. Semua exit yang disediakan form harus memakai konfirmasi yang sama | **Mayor**, kehilangan draft lokal; 2/2. Data tersimpan tidak berubah. Koreksi siap handoff; triase prioritas/severity final oleh Product Lead/QA |
| DES-002B | Create, isi Name dengan project existing `Apollo`, submit | Pesan `Another project already has this name. Use a different one.` muncul di bawah Status; Name tidak mendapat error terkait/fokus. Expected: field Name + linked summary + fokus, nilai lain tetap | **Sedang**, pemulihan salah tempat; 1 run browser dan source konsisten. Belum diperbaiki |
| S4-BUG-001 | EditProject saat GET refresh gagal setelah data pernah ada | Source mengembalikan form tanpa Notice; QA sudah mereproduksi 2/2. Expected mengikuti state stale di atas | **Sedang**, gunakan ID QA yang sudah ada; Designer menyetujui expected UX, bukan mengklaim fault injection sendiri |
| S4-BUG-002 | Name valid 100 karakter setelah trim tetapi 102 raw dengan spasi tepi | Client memvalidasi raw sebelum save yang melakukan trim. Expected: validasi dan payload memakai normalisasi yang sama | **Sedang**, bukti QA S4; tidak menambah bug duplikat atau mengubah kontrak |
| DES-OBS-001 | Cancel pada dialog unsaved dari breadcrumb | Draft tetap; pada observasi AX fokus kembali ke container halaman. Expected kembali ke pemicu/focus target yang berguna | **Perlu retest QA**, satu observasi; belum dinilai sebagai defect keyboard terkonfirmasi |

Required submit menampilkan summary dan memfokuskan Name. List, create, detail dan edit terlihat dengan hierarki yang
konsisten; form dilihat pada 360×844, 390×844 dan 834×1112 melalui device toolbar. Tidak terlihat overflow horizontal
pada form yang diamati; ini inspeksi visual, bukan pengukuran DOM/sertifikasi aksesibilitas. Browser dark, native keyboard
Back/Forward, timeout/offline, slow success, focus trap/return lengkap dan real-device tidak diverifikasi ulang sesi ini.
QA S4 mempunyai matriks terpisah; hasil mereka tetap beratribusi pada QA dan revisinya.

Validasi Figma mencakup screenshot komposisi, reflow 360/390, dark duplicate, phone bottom sheet dan tablet stale.
Warna error yang di-resolve dari token memberi contrast summary/field **4,88/5,56 light** dan **6,12/6,52 dark** terhadap
surface terkait; ini pemeriksaan pasangan warna tersebut, bukan audit seluruh kontras UI. UI review berupa text/vector/
component instances, tanpa full-screen raster. Audit final mencatat 13 frame, tujuh state form, 167 instances tanpa
master yang tidak terselesaikan, nol image fill dan tujuh tautan prototipe valid. Teks menggunakan Inter. Salinan dependency diperbaiki setelah ditemukan
fixed width di Textarea, ErrorSummary dan navbar phone.

Artifact lokal, gitignored: `.superpowers/scratch/designer/phone-360-required.png`, `phone-leave.png`,
`tablet-stale.png`, `desktop-duplicate-dark.png`, `figma-form-ledger.json`, `figma-review-ledger.json`,
`figma-final-audit.json`, `check.log`. Final audit menjadi rujukan ID setelah konversi instance ke slot Panel.
Browser native AX/screenshot ditinjau dalam sesi Computer Use; artifact PNG di atas adalah **Figma**, bukan capture runtime.
Full check dengan Bun **1.4.3** / Node 24.21.0 lulus: typecheck, lint zero-warning, 1.528 tes. Host Bun 1.4.4 tidak dipakai
sebagai bukti pin. Tidak menjalankan ulang seluruh E2E/build/budget pada tugas desain ini.

## Handoff ke Developer dan QA

| Item | Isi yang dapat dikerjakan |
| --- | --- |
| Task ID / flow | Parent DES-002 → koreksi DEV-003 setelah triase Product Lead. Urutan koreksi: DES-002A safe Cancel, DES-002B duplicate recovery, S4-BUG-001 stale warning dan S4-BUG-002 normalisasi |
| Referensi | Patch area 06 v1.0.1 dan frame di tabel; `features/projects/project-form.tsx`, `lib/client/use-leave-guard.ts`, kontrak shared projects, standar form/interaction |
| Komponen/state | Tabel state di atas; gunakan komponen existing. Figma family adalah komposisi ProjectForm, bukan permintaan tujuh komponen React/API baru |
| Interaksi / responsif | Cancel bersih kembali tanpa dialog; Cancel dirty memakai guard yang sama dengan anchor. Create kembali ke Projects (pertahankan URL list asal jika tersedia, fallback `/projects`); edit kembali ke detail project. Jangan mengandalkan history yang bisa menuju luar flow. Dialog phone bottom sheet; footer bawah, focus dan target coarse dipertahankan |
| AC visual | Pada 360/390/834/1440 light+dark, label/helper/error tidak terpotong; card/field sejajar; content tidak bergeser karena pending; kontrol fokus tidak tertutup; dialog menyatakan dampak dan aksi. Compare area konten, bukan mengganti shell existing dengan navbar baseline Figma |
| AC perilaku pertama | Ubah Name/Description/Status → Cancel → dialog; Cancel/Escape/Close → nilai sama; Leave page → tujuan internal tanpa mutation. Bersih → langsung kembali. Duplikat → fokus Name + error terhubung; field lain tetap. Refresh gagal → stale notice; Retry tidak membuang draft. Trim boundary sesuai API |
| Verifikasi | Tambah failing regression untuk Cancel sebelum fix; E2E keyboard/dialog dan form pada tiga viewport; retest IDs QA di revisi yang sama. Periksa light/dark dan race/pending, lalu Designer membandingkan screenshot/runtime lagi. Check/E2E/budget sesuai gate kandidat |
| Keputusan terbuka | Product Lead mentriase temuan dan Developer mengonfirmasi pendekatan guard/normalisasi serta estimasi. `useLeaveGuard` saat ini mengecualikan native Back/Forward dan command-palette/programmatic navigation; perlu keputusan terpisah untuk memperluas shared guard. Jangan mengklaim batas itu tertutup oleh koreksi tombol Cancel |

Status: **desain koreksi form siap untuk handoff, patch Figma In review; implementasi belum disetujui**. Feasibility
dinilai dari kontrak/source existing; belum ada penerimaan handoff atau persetujuan lintas role yang diklaim. Kode produk
tidak diubah Designer. Penutupan DES-002 dan persetujuan visual menunggu koreksi Developer, retest QA dan review ulang
Designer pada revisi hasilnya. Paket FIL-DES-001 berikut dikerjakan terpisah sesuai handoff Product Lead.

## FIL-DES-001 — filter mandiri dan overlay kanan

**Status historis: Superseded oleh FIL-DES-002 / DEC-017, bukan spesifikasi aktif.** Patch v1.0.1 dipertahankan;
implementasinya belum pernah disetujui Designer. Dasar scope saat disusun:
DEC-014, kontrak filter di architecture, dan handoff Product Lead. Referensi visual lokal
`/Users/riuzaki/Downloads/💻 Grooming v3/W7 Minimized/Filter Panel.png` diperiksa: kelompok yang mudah dipindai dan
disclosure dipakai; Outcome/Team/Model, checkbox multiselect dan facet counts tidak ditambahkan. Semua filter tetap scalar.
Pengguna menyusun beberapa kriteria sambil mempertahankan konteks hasil, lalu menerapkannya satu kali.

Keputusan inti: **launcher pada baris mandiri sebelum hasil; panel modal overlay kanan tanpa gutter pada ≥768;
phone bottom sheet**. Modal dipilih agar kontrol hasil yang tertutup tidak menerima klik atau fokus. Hasil tetap di
tempatnya dan terlihat melalui scrim. Tidak diperlukan toggle viewport-fixed yang dapat menutupi row actions.

### Tata letak dan collision

| Bagian | Spesifikasi final |
| --- | --- |
| Launcher | Satu baris mandiri di dalam FilterLayout, setelah PageHeader/Notice/KPI dan tepat sebelum result Panel; rata kanan, gap 16 ke Panel. Bukan tab, Panel toolbar atau header action. Baris tetap tersedia saat closed/open/count 0. Tombol secondary `Filters` + CountBadge applied bila >0; 32 px drawn, hit area coarse 44. Label aksesibel `Filters, N active`, `aria-haspopup=dialog`, expanded dan controls sesuai state. Ikon tidak wajib; gunakan label yang terlihat |
| Result Panel | Lebar dan posisi identik saat open/closed; tidak ada reserved gutter. Saved views, Columns dan export yang didukung tetap pada toolbar hasil. Applied chips + Clear filters tetap di dalam card |
| ≥768, termasuk tablet | Portal fixed pada viewport: **right 16, top 16, width 320**, tinggi hug sampai **100dvh − 32**; clearance bawah ≥16. Ini aturan baru, menggantikan breakpoint xl untuk bentuk filter. Radius/grey tray+card dan shadow overlay existing. Bukan anchored popover yang perlu flip ke kiri |
| <768 | Bottom sheet full width, bottom 0, max-height 90dvh, radius atas 16; footer mendapat safe-area bawah. Body padding 16, gunakan input 16 px dan target coarse 44. Tidak memaksakan panel desktop 320 pada phone |
| Scroll / collision | Header dan footer tetap dalam panel; hanya body fields yang scroll, min-height 0 + overscroll-contained. Tinggi pendek/keyboard tidak menyembunyikan footer atau field fokus; gunakan visual viewport/dvh yang tersedia. Tidak ada horizontal page scroll. Scroll lock harus memberi kompensasi scrollbar sehingga result bounding box tidak bergeser |
| Layer | Scrim dan panel pada layer dialog existing (z-50), panel di atas scrim; menu/select portal anak berada di atas panel. Background inert dan page scroll terkunci selama modal ada. Header time/refresh tidak dapat diaktifkan menembus scrim; jangan menambah filter modal paralel |
| Resize saat open | Satu DOM, breakpoint CSS md; tetap open, draft/group/fokus tidak direset. Perubahan right overlay ↔ bottom sheet mempertahankan field aktif. Jika group sengaja ditutup saat fokus di dalamnya, fokus pindah ke tombol judul group |

### Fokus, dismissal dan kelompok

- Saat primitive modal siap, fokus awal ke heading **Filters** (`tabIndex=-1`), dengan nama/deskripsi dialog.
  Jangan langsung membuka keyboard phone. Tab/Shift+Tab terperangkap; semua tombol dan field bisa dijalankan keyboard.
- Close **X**, Escape, dan klik scrim/outside menutup tanpa Apply, menyimpan draft lokal, lalu mengembalikan fokus
  ke launcher tanpa melompat scroll. Klik luar tidak meneruskan aksi ke hasil. Drag yang dimulai di dalam panel
  tidak dianggap outside click. Layer anak (select/menu/role search) menangani Escape/outside terlebih dahulu;
  Escape berikutnya menutup filter. Event dari portal anak tidak boleh dianggap klik luar filter.
- Search selalu terlihat dan tidak memiliki disclosure tambahan. Setiap field non-search menjadi satu group scalar,
  semuanya **expanded pada open pertama**, dapat ditutup independen, dan state group bertahan close/reopen dalam
  halaman yang sama. Tidak ada persistensi global/antarhalaman. Header group adalah tombol Enter/Space dengan
  expanded/controls, target coarse 44; label field tetap tersedia secara aksesibel tanpa duplikasi visual.
- Saat collapsed, tampilkan **nilai draft** saat ini (`Any` untuk default), bukan jumlah hasil. Satu pesan panel
  `Changes are ready to apply.` menjelaskan draft yang berbeda; badge launcher/header tetap **applied field count**.
  Nilai panjang wrap di header, tidak mendorong chevron/close ke luar. Field error membuka group agar error dan fokus terjangkau.

| Modul | Search yang tetap terlihat | Group / kontrol existing |
| --- | --- | --- |
| Users | Search users | Role: select/RoleSearch existing; Status: single-choice radio existing |
| Projects | Search projects | Status: select existing, bukan checkbox baru |
| Roles | Search roles | Tidak ada group artifisial untuk halaman search-only |
| Permissions | Search permissions | Module: select scalar |
| Activity | Search by user | Action: select scalar |
| Sign-in log | Search by user | Event dan Method: select scalar terpisah |
| Galeri | Contoh shared FilterLayout | Menunjukkan kontrak yang sama; tidak memakai angka facet dummy |

### Draft, Apply dan state pemulihan

1. Panel **default closed**, termasuk document load atau client navigation dengan URL berfilter. Count adalah jumlah
   field nondefault dari URL, bukan jumlah records/options atau draft. Chips tetap terlihat ketika closed.
2. Edit hanya draft lokal. Close/reopen mempertahankan nilainya; collapse tidak menghapus field. **Reset all mengubah
   draft ke defaults saja**, tanpa request/URL update dan tanpa mengubah state group. Pengguna masih perlu Apply.
3. Dirty membandingkan nilai canonical/trim dengan applied. Clean: submit disabled, label `Applied`, alasan
   `No unapplied changes`. Dirty: `Apply filters`. Enter mengambil seluruh snapshot draft termasuk keystroke terakhir,
   trim, satu URL/history push dan page kembali 1. Tidak ada preview count di label submit.
4. **Apply yang diterima menutup panel pada semua viewport**, fokus kembali ke launcher; daftar mengumumkan
   `Filters applied` / `Updating results` sesuai fase tanpa mengklaim request GET telah sukses. Baseline onApply adalah
   aksi URL sinkron; jangan menggambar proses save API filter palsu. Cegah duplikasi selama transisi URL bila ada.
   Close setelah Apply diterima tidak membatalkan snapshot tersebut.
5. Back, saved view, remove chip/Clear filters mengganti draft mengikuti applied terbaru, baik panel open maupun closed.
   Respons/ack Apply lama tidak menimpa state eksternal yang lebih baru. Pertahankan sort, page size dan header time
   yang tidak terkait; opening tidak mengirim Apply. Reopen selama GET tetap menampilkan snapshot applied yang benar.
6. Cold deferred primitive: launcher `aria-busy` + status `Loading filters`; jika chunk gagal, pesan recoverable dan
   **Retry filters** di baris launcher. Belum ada modal/focus trap sebelum primitive tersedia; navigasi tetap bisa dipakai.
   Hindari open terlambat setelah unmount/perpindahan halaman atau intent dibatalkan. Penyesuaian ini dikonfirmasi
   Developer untuk mempertahankan deferred boundary dan budget. Setelah shell siap, lazy fields dapat memakai skeleton,
   status loading, error + Retry dalam shell dengan Close tetap terjangkau. Role lookup error tetap di group Role;
   jangan mengubah pilihan ke default atau menyatakan options kosong sebagai hasil sah. Apply hanya aktif bila snapshot dapat divalidasi.
7. Region hasil tetap memiliki loading, empty, filtered-empty, error/retry, stale-kept-data dan data sesuai standar.
   Error GET setelah Apply tidak membuka filter lagi atau menghapus applied chips. Motion mengikuti token enter/exit;
   reduced motion fade saja. Hover/focus/selected/disabled memakai state primitive existing, bukan warna baru.

### Referensi Figma dan handoff

Area 14 diduplikasi sebelum diedit: **`14 · Proposal / Floating filters · v1.0.1`**, page `174:1974`, di depan `v1.0.0`.
File kini 19 page; area 06 v1.0.1 Projects tetap terpisah. Proposal baseline dipertahankan sebagai riwayat, bukan
spesifikasi implementasi overlay baru. [Review](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=177-2804)
menampilkan desktop closed/open dengan result width **1126 px pada kedua frame**, dark collapsed groups, tablet834,
phone360/390 dan viewport pendek. [Master overlay](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=176-3347)
dan [content states](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=176-2544) mereuse primitive/token existing.
Fixture tabel adalah preview, bukan data live/facet count. Screen konteks tidak mengotorisasi redesign shell.
Handoff Figma: [UX decisions & Developer/QA handoff](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=182-5141).
Audit final review: **2.087 descendant nodes**, termasuk **536 instances** dengan master terselesaikan, **nol image fill**,
font **Inter + Geist Mono** mengikuti baseline; tiga tautan prototipe desktop open/close valid. Family memiliki lima
state UI dan dua specimen responsif (phone/short viewport), bukan tujuh komponen React yang diminta.
Screenshot komposisi, launcher, handoff dan release entry ditinjau; koreksi dilakukan pada footer viewport pendek,
wrapping teks handoff, posisi master di luar review dan ikon launcher. Area14 baseline tetap mempunyai dua section
terkunci, 7 component/2 component set dan counts yang sama dengan sebelum patch. Tidak mengaudit ulang semua
13.490 relasi historis dari migrasi baseline.

Artifact desain lokal (gitignored): `.superpowers/scratch/designer/filter/{final-audit.json,composition-reviewed.png,
launcher-reviewed.png,handoff-reviewed.png,release-reviewed.png}`; session `5ebf143f-564a-4ee4-9b61-d0771a43afdc`.
Screenshot komposisi mendahului koreksi kecil ikon launcher; `launcher-reviewed.png` adalah bukti koreksi terakhir.
Ini pemeriksaan **Figma**, bukan uji runtime, full contrast/aksesibilitas atau gate rilis. Tidak ada run check/E2E baru
oleh Designer untuk paket dokumen/Figma ini; hasil DES-002 sebelumnya tidak dipakai untuk meluluskan kode filter baru.

| Handoff | Isi |
| --- | --- |
| Task / scope | FIL-DES-001 → FIL-DEV-001 → FIL-QA-002. Evolusi shared FilterLayout/ekstraksi FilterPanel; jangan buat implementasi per feature. API nama komponen final milik Developer. Empat dokumen Product Lead tidak diubah Designer |
| Komponen / state | Launcher, CountBadge, result chips, deferred modal, disclosure scalar, FilterSearch/QueryInput immediate, native select/RoleSearch/radio, skeleton/retry, fixed footer. Satu DOM untuk resize. Tidak menambah API, fields, facet counts atau multiselect |
| AC visual | 360/390/834/1440/1920 light+dark: launcher di luar header/tab, overlay kanan/sheet sesuai tabel, header/footer dan fokus terjangkau; text wrap; body scroll; no page overflow. Result bounding box dan lebar sama sebelum/sesudah open; scrollbar tidak menggeser layout |
| AC interaksi | Default closed walau URL aktif; open→draft→close→reopen nilai sama; Reset draft-only; groups independent, retained, summary draft vs badge applied; Apply atomik termasuk last key, closes all widths; nested Escape/outside, no clickthrough; resize mempertahankan state/fokus |
| QA | FIL-T01–07: URL/client navigation, geometry + focus/inert, draft/Reset/Apply, Back/view/chip race, dismissal/group keyboard, resize/keyboard/safe-area/long content, cross-module gallery/deferred/budget tepat-byte. QA menerima expected dan merawat qa.md; bukti baseline tidak meluluskan implementasi baru |
| Feasibility | Developer menerima satu deferred modal + satu DOM dan grouping; cold-load adjustment di atas disepakati. Tidak perlu perubahan kontrak backend. Risiko retest: nested portal event/focus, viewport keyboard, late URL ack dan scrollbar compensation |
| Gate penutupan | Developer menyerahkan revisi + checks/budget/E2E terkait; QA retest revisi yang sama; Designer melihat runtime dan membandingkan frame sebelum approval visual. Figma In review menunggu review/persetujuan, bukan klaim implementasi selesai |

Keputusan UX di atas telah disampaikan ke Developer/QA pada 8 November 2026. Handoff ini tidak mengubah prioritas,
kontrak teknis atau keputusan kandidat rilis milik Product Lead. Tidak ada kode produk yang diubah Designer.

## FIL-DES-002 — sidebar Bifrost, checkbox multi dan auto-apply

**Interaksi aktif / DEC-017; geometri anchor di bawah superseded oleh FIL-DES-003 / DEC-018.** Instruksi pemilik menggantikan FIL-DES-001: rail default collapsed di kanan,
sidebar nonmodal desktop, checkbox multi yang langsung berlaku, **tanpa Apply, radio kategori atau draft/unapplied**.
Clear all langsung membersihkan filter. Perluasan kontrak multi diotorisasi Product Lead; API/wire tetap milik
Product Lead/Developer, mengikuti DEC-017 terkini, bukan asumsi dari gambar atau handoff teknis sementara.

Dua referensi asli sudah dilihat: `/Users/riuzaki/Pictures/Screenshoot/CleanShot 2026-11-08 at 18.44.01@2x.png`
(expanded vs rail) dan `18.42.38@2x.png` (kelompok open). Bentuk yang dipakai: card tinggi, header Filters + badge +
Clear all + collapse, group dengan checkbox berlabel, serta rail ikon/badge/label vertikal. Outcome/Team/Model tidak
ditambahkan ke domain; angka facet tidak dibuat. Checkbox ini khusus filter list, bukan perubahan radio pada form,
theme/density atau saved-view picker. Roles tetap search-only.

### A — entry, geometry dan coverage

| Bagian | Expected aktif |
| --- | --- |
| ≥768 collapsed | Rail fixed **48 px**, right 16, top **batas bawah header shell yang dirender +16** (minimum16 bila header sudah di luar viewport), bottom 16. Icon toggle/collapse, filter icon, badge bila >0 dan label vertikal **Filters**. Satu button expand berlabel, expanded=false/controls; cluster atas punya target ≥44. Bagian rail kosong dekoratif, bukan ratusan titik Tab |
| Expanded | Mengganti rail dengan panel **320 px** pada offset top/right/bottom yang sama; tinggi mengisi ruang tersedia. Desktop/tablet **nonmodal**, tanpa scrim/inert/focus trap/scroll lock. Panel tetap open selama checkbox/search/group dioperasikan. Header fixed; body options scroll dengan min-height0/overscroll containment; **tidak ada footer Apply** |
| Clearance tetap | FilterLayout menyediakan **end clearance 64 px** (rail48 + gap16) pada ≥md. Ini slot tetap untuk melindungi Columns/row actions dari rail; hasil mempunyai rect identik collapsed/expanded. Expanded overlay tidak menambah gutter320 atau mengecilkan hasil lagi. Tradeoff ini diterima Product Lead, bukan klaim bahwa rect sama dengan baseline tanpa rail |
| Hasil tertutup panel | Bagian hasil yang masih terlihat tetap dapat dioperasikan. Opaque panel menerima pointer pada wilayahnya; jangan meneruskan klik ke kontrol tepat di belakangnya. Outside pointerdown pada area halaman terbuka **collapse sinkron lalu membolehkan aksi target**, tanpa menelan klik atau menarik fokus kembali |
| Fokus di luar | Focus memasuki page control di luar panel → collapse sebelum paint berikutnya sehingga fokus tidak tersembunyi di balik overlay; fokus tetap pada target. Ini juga berlaku untuk Tab keluar/programmatic focus. Jangan inert seluruh tabel. Header global tetap di atas offset panel dan dapat digunakan |
| Phone <768 | Rail diganti **launcher horizontal Filters + badge pada baris mandiri sebelum hasil**, tanpa end clearance. Alasan: rail vertikal akan menutup aksi card. Open menjadi modal bottom sheet fullwidth/max90dvh dengan header Close, safe-area dan body scroll; selection tetap auto-apply dan sheet tetap open. **Tidak ada Apply/footer** |
| Resize | CSS mengubah geometry. Radix boleh melakukan semantic remount ketika nonmodal ↔ modal; hanya satu control tree terlihat. Parent mempertahankan open, search, selected values dan group state; restore field fokus yang sama melalui stable id. Heading hanya fallback bila target hilang, atau pada initial open. Jangan menuntut identical DOM node atau memindahkan fokus ke heading pada setiap resize |

### B — focus, keyboard dan dismissal

- Open dari rail/phone launcher: heading Filters menerima fokus, tidak otomatis memunculkan keyboard. Desktop panel
  bernama/terhubung ke trigger, tidak mengaku modal. Phone memiliki dialog name/description, trap dan scrim standard.
- Collapse/Close atau Escape di dalam panel: collapse/close, flush search terakhir, fokus ke rail/launcher. Pada desktop,
  outside click/focus collapse **mempertahankan target focus/action**, berbeda dari Close eksplisit. Pada phone,
  outside scrim menutup dan mengembalikan fokus launcher, tidak clickthrough. Layer anak menangani Escape dulu.
- Checkbox Space men-toggle satu opsi, group header Enter/Space membuka/menutup group. Tab order mengikuti tampilan;
  focus ring tetap terlihat. Semua tindakan ≥44 coarse; input phone ≥16 px. Label vertikal rail tetap satu nama
  aksesibel normal, bukan dibacakan huruf per huruf. Fitur time/refresh global tidak dipindahkan ke sidebar.
- Semua group expanded pada open pertama; collapse independen dan tersimpan lokal di halaman selama close/reopen.
  Menutup group tidak melepas pilihan. Header menampilkan jumlah **opsi terpilih** dan summary label yang wrap;
  ini bukan facet count records. Search utama selalu terlihat; group error dibuka agar fokus/retry terjangkau.

### C — nilai, auto-apply, badge dan recovery

1. Multi: **OR dalam group, AND antar-group**; nol pilihan berarti unrestricted. Tidak ada opsi Any/radio pengganti
   checkbox. Memilih semua status tetap mempertahankan checks/URL, walau hasil setara unrestricted. Group: Users
   Role/Status; Projects Status; Permissions Module; Activity Action; Sign-in log Event/Method; Roles tidak punya group palsu.
2. Checkbox segera commit snapshot terbaru, **history push**, page1; sidebar tetap open. Rapid toggles menggabungkan
   state terbaru, bukan closure URL lama. Chip per opsi bisa dihapus tanpa melepas sibling. Badge = **total opsi checked
   +1 untuk applied search nonempty**, tidak menghitung date range atau pending text. Nama aksesibel `N active selections`.
3. **Search debounce300 ms**, history **replace**. Nilai input terlihat segera; Enter/blur/collapse flush. Checkbox
   menggabungkan search terbaru dan toggle dalam **satu push atomik**. Angka300 mengikuti handoff final Product Lead
   yang mengganti angka200 awal DEC-017. Tidak ada konsep Apply/Applied/Unapplied pada UI baru.
4. **Clear all langsung** mengosongkan input+seluruh group, cancel debounce, commit satu push/page1 bila applied berubah;
   sort/pageSize/header date tetap. Enabled bila ada applied selection **atau pending text**. Bila URL sudah defaults,
   pending text tetap dibersihkan tanpa redundant history/request. Group open/collapse tidak berubah.
5. Back, saved view, remove chip dan external state membatalkan timer lalu mengadopsi snapshot terbaru. Respons lama
   tidak boleh mengembalikan search/selection yang sudah dibersihkan. URL/query/prefetch/views canonical mengikuti
   kontrak aktif DEC-017; UI tidak memfilter satu page lokal sebagai pengganti list API.
6. Pending hasil: checked values/chips tetap, region mengumumkan `Updating results…` secara polite dan menjaga data
   sebelumnya bila tersedia. Sukses mengganti hasil tanpa menutup panel/memindah fokus. GET gagal tidak me-reset selection;
   kept rows diberi stale/error notice + **Retry**. Tidak mengklaim hasil lama cocok dengan filter baru tanpa notice.
7. Lookup options loading/error tetap lokal di group, bukan dinyatakan kosong sah; tampilkan skeleton/status atau
   pesan + Retry. Pilihan yang tidak ada di page opsi tetap tersimpan/terlihat dan dapat dihapus. Error lookup tidak
   menghapus pilihan, tidak menonaktifkan Clear atau group lain. Static group >6 opsi menampilkan6 dahulu lalu
   **Show more / Show less** tanpa facet count; selected yang tersembunyi ditunjukkan pada summary. Role options tetap
   server-paged/searchable; gunakan Load more hanya bila server mengindikasikan more, jangan mengarang total.
8. Maksimum **50 pilihan per group** mengikuti kontrak. Pada50, pilihan unchecked lain diblokir dengan alasan inline
   `Choose up to 50 roles. Remove one to add another.` (noun sesuai group); uncheck/Clear tetap bisa. Jangan truncate.
9. State panjang mengikuti handoff final Product Lead: automatic navigation remember **300 karakter**, named saved
   view **4096**. URL tetap bekerja; >300 bersihkan remembered query lama dan beri notice ringan bahwa sebagian state
   tidak diingat otomatis, arahkan **Save view**. >4096 Save view menampilkan error recoverable, tidak mengaku tersimpan
   dan tidak memotong pilihan. Parser/encoding dan batas detail tetap dirawat Product Lead/Developer.

### D — Figma, acceptance dan handoff

Patch **area14 v1.0.2** menduplikasi v1.0.1 sebelum perubahan. V1.0.1 dipertahankan sebagai desain **Superseded**,
bukan Approved. File kini20 page. [Review Bifrost](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=190-5669)
menunjukkan rail/open desktop, dark collapsed groups, tablet834, phone360/390, viewport pendek dan state updating/
results error/options loading/options error. [Master sidebar](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=189-5892)
dan [rail](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=189-5893) memakai primitive/token SunnyGo;
ikon FilterHorizontal/PanelRightClose diambil dari paket Hugeicons existing. Tidak ada raster layar sebagai desain.
Handoff Figma aktif: [FIL-DES-002 / Bifrost live filters](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=193-8299).
Final audit mencatat **2.486 descendant nodes**, **604 instances** dengan master terselesaikan, nol image fill,
font Inter/Geist Mono, dan dua tautan prototipe expand/collapse valid. Dua result rect identik: x281/y170,
**1062×527** pada desktop rail/open. Header `Clear all` 60×18, satu baris; separator header/group dan pilihan saat
lookup gagal diperbaiki setelah review. Komposisi + handoff ditinjau, sidebar setelah koreksi separator ditinjau
terpisah (`sidebar-reviewed.png`). Prototype tidak mensimulasikan API/debounce/typing.

Predecessor v1.0.1 dibaca dalam own-page context setelah revisi: review tetap2.087 nodes/536 instances, tujuh state
lama dan collection/mode counts sama. Masters/tokens/styles lama tidak diedit. Tidak ada publish library/native
version-history checkpoint. Artifact gitignored: `.superpowers/scratch/designer/filter-bifrost/{final-audit.json,
composition-reviewed.png,sidebar-reviewed.png,phone-reviewed.png,handoff-reviewed.png,release-reviewed.png}`;
session `df69f680-29ee-4c7e-bbbe-f1efa8d45b5f`. Phone setelah koreksi ikon Close juga ditinjau; screenshot komposisi
mendahului koreksi separator/ikon tersebut, sehingga screenshot sidebar/phone menjadi bukti koreksi terakhir.
Ini bukti desain Figma, bukan klaim runtime, full contrast atau gate pengujian kandidat.

| Item | Handoff aktif |
| --- | --- |
| Task | FIL-DES-002 + FIL-API-001 → FIL-DEV-002 → FIL-QA-004; QA merawat FIL-QA-003 delta. Implementasi modal/scalar sebelumnya tidak memenuhi scope ini |
| Komponen | Shared rail/FilterPanel, checkbox group/disclosure, QueryInput, selected chips/count, loading/retry, phone dialog; field options dari modul. Bukan implementasi sidebar terpisah tiap feature |
| AC bentuk | 360/390/834/1440/1920 light/dark: rail vertikal desktop; card tinggi+header Clear all+checkbox list; no desktop scrim/radio/Apply. Result rect sama rail/open dengan slot64 tetap; trailing actions tidak tertutup rail. Phone launcher/sheet tanpa footer, keyboard/safe-area terjangkau |
| AC perilaku | Default collapsed walau URL aktif; checkbox auto+panel stays; OR/AND; search300 replace/flush; Clear cancel; latest-wins Back/view/chip; focus-out/click-out desktop membolehkan aksi; explicit close/Escape restore; semantic resize continuity; >50/long-query recoverable |
| QA delta | FIL-QA-003/004 mencakup mode nonmodal vs modal, coverage rail/expanded, pointer dan Tab, checkbox multiple/group retention, debounce/rapid action/Clear/Back race, error kept rows/options, long query and off-page choices, canonical deep links/CSV/bulk lewat kontrak API. Nilai pass scope lama tidak diwariskan |
| Feasibility | Product Lead menerima slot64/rail48/phone row/300ms; Developer menerima Radix semantic remount dengan state/focus restore. Kontrak API tidak ditebak Designer; scoped API changes diotorisasi DEC-017 |
| Status / gate | Desain siap handoff, **Figma In review; implementasi belum disetujui**. Developer menyerahkan revisi/bukti, QA retest scope baru, Designer melihat runtime terbaru sebelum approval visual. Tidak ada source produk yang diubah Designer |

Review screenshot implementasi FIL-DES-001 sempat dimulai pada360/1440 light/dark dari artifact Developer; arahan baru
datang sebelum review lengkap. Tidak diberikan approval, tidak ada hasil visual lama yang dianggap lulus Bifrost.
Empat dokumen Product Lead dan qa.md tidak diedit untuk perubahan ini. Estimasi desain paket ini **0,5–1 hari fokus**
termasuk review ulang, tanpa menjanjikan tanggal kandidat; prioritas/release tetap milik Product Lead.

### Review implementasi FIL-DES-002 — putaran awal (historis)

Oracle anchor pada putaran ini **superseded oleh DEC-018**, bukan dipakai untuk menutup temuan sebagai fixed.

Designer melihat **10 screenshot runtime baru** `developer-session-3/browser/rail-{360,390,834,1440,1920}-{light,dark}.png`
(gitignored), bukan screenshot modal lama. Source HEAD masih `2ba4b9f` + perubahan working tree Developer;
belum kandidat immutable. Source `filter-panel(-impl)`, `filter-layout`, `filter-group-content` dan tes terkait dibaca.

- Header Filters/Clear all/collapse satu baris, separator, ringkasan selected dan warna light/dark tampak konsisten.
  Phone memperlihatkan sheet tanpa footer Apply; desktop/tablet tidak memiliki scrim. Tidak terlihat horizontal
  overflow pada screenshot yang diamati. Ini penilaian screenshot, bukan pengukuran DOM baru oleh Designer.
- **DES-FIL-002A — koreksi anchor, dampak sedang:** screenshot Projects desktop/tablet menempatkan top panel di128.
  Header yang terlihat berada pada y8 dengan tinggi56; expected **bottom64 +16 =80**. Token root `--topbar-h=112`
  tidak sama dengan token scoped `.app-shell=56`; portal dialog berada di luar scope itu. Source dan screenshot
  mendukung diagnosis, Developer diminta membuktikan/fix dengan anchor khusus filter tanpa mengubah token global.
  QA diminta memeriksa header dengan/tanpa time controls, scroll dan resize. Catatan awal72 mengabaikan inset8 dan
  dikoreksi ke80 sebelum triase; spesifikasi sekarang tegas memakai **rendered header bottom+16, min16**.
  Frame v1.0.2 In review diluruskan dari y72 ke80 sebagai klarifikasi inset pada request yang sama.
  Bukti Figma setelah klarifikasi: `filter-bifrost/open-anchor-reviewed.png`; manifest hash10 screenshot runtime
  tersimpan di `filter-bifrost/runtime-review-initial.json` agar capture yang ditinjau dapat dibedakan dari retest berikutnya.
- **Bukti visual belum lengkap:** seluruh10 capture memperlihatkan sidebar open dan group Status collapsed.
  Bentuk rail collapsed/default dan checklist multi yang expanded/checked belum dapat diluluskan dari gambar itu.
  Developer diminta mengirim kedua state tersebut pada1440/360 light/dark sebelum review visual lengkap.
- `rail-second.log` Developer dibaca: **12 pass**, termasuk10 kasus geometry/axe/auto-checkbox/Clear,
  satu kasus7 consumers/outside focus dan satu semantic resize. Attribution tetap Developer; tes saat itu memeriksa
  width/right/bottom, belum top terhadap actual header. Hasil ini bukan run independen Designer atau QA-REL sign-off.

**Status: review visual parsial; implementasi belum disetujui.** Menunggu koreksi anchor, screenshot state yang
kurang, verifikasi QA dan revisi kandidat. Tidak ada kode produk, baseline Figma, gate atau hasil tes yang diubah Designer.

## FIL-DES-003 — sejajar konten pertama setelah PageHeader

**ANCHOR AKTIF / DEC-018.** Revisi eksplisit pemilik: filter mulai **di bawah PageHeader dan sejajar komponen
konten pertama**, tanpa extra gap. Screenshot Permissions memperlihatkan rail lama menutup Add permissions;
referensi sudah dilihat di `/var/folders/37/2l2h6lpd40s91fsn0wn83gsc0000gn/T/orca-paste-1794140895820-f2505d88-6f75-44a5-95ef-d0ac73a21a28.png`
Seluruh oracle global shell
header +16 /72/80 **superseded**, bukan ditandai fixed. Perubahan ini hanya anchor/scroll/collision/responsive;
checkbox multi, auto-apply300ms, Clear all, lebar48/320 dan slot64; kontrak API tetap mengikuti FIL-DES-002 / DEC-017.

### Geometry untuk Developer dan QA

| Kondisi | Expected final |
| --- | --- |
| ≥md normal | `rail.top = expandedPanel.top = firstContentSurface.top`, **tanpa +16 tambahan**. Ambil batas luar card/table/KPI, bukan thead/toolbar/header shell. Contoh Figma y170 adalah contoh, bukan konstanta runtime |
| Penentuan surface | Komponen visible pertama setelah **PageHeader lokal terdekat**. Notice/banner halaman yang mendahului KPI/table ikut dihitung; hidden sibling dilewati. Loading skeleton, error dan empty tetap memakai region yang sama. Nested contoh `/ds` tanpa PageHeader lokal memakai own filter-results, bukan komponen pertama seluruh galeri |
| Bounds / scroll | `top = max(16, surfaceRect.top, visiblePageHeader.bottom)`. Header yang pinned/masih terlihat menjadi lower bound agar heading/actions tidak tertutup, bukan anchor baru. Update saat scroll container pemilik, viewport/ResizeObserver/layout, wrap heading, font siap, Notice muncul/hilang; rail/panel memakai ukuran yang sama tanpa reset nilai/group/fokus |
| Ruang bawah | `availableH = viewportHeight − top −16`. Right16/bottom16 tetap, expanded width320 dan rail48; tidak ada tambahan gutter/reflow ketika expand. Hasil punya lebar/document position sama, kecuali pergeseran viewport akibat controlled scroll di bawah |
| Belum terukur / below fold | Initial desktop rail **hidden dan tidak menerima Tab sampai anchor benar-benar terukur**; jangan pernah memakai fallbacktop16 di atas PageHeader. Jika surface masih di bawah fold dan availableH<44, tetap hidden sampai ruang cukup. Ini penting di `/ds`; jangan mengangkat rail ke atas komponen lain. Phone button tidak disembunyikan oleh aturan pengukuran desktop |
| Available44–159 | Rail tetap di lokasi yang sama, tetapi cluster menjadi **satu tombol44 px** filter icon+badge dalam lebar48; chevron/label vertikal disembunyikan, nama aksesibel Filters/N active selections tetap. Tidak membuat launcher baru yang menutup card |
| Explicit open dengan available<160 | Gulir **surface anchor yang sebenarnya** ke safeTop16 pada owning scroller, biarkan PageHeader keluar viewport secara alami; ukur ulang sebelum fokus heading. Reduced motion instant. Ini scroll yang menjaga document layout, bukan mengecilkan hasil. Jika tidak dapat memperoleh ruang, jangan hoist panel ke atas PageHeader; jaga Close/body scroll terjangkau. Contoh viewport400/surface170 menyisakan214, tidak membutuhkan auto-scroll |
| Collapse sesudah scroll | Tidak menggulir halaman kembali. Selection/group/search tetap. Jika background scroll membuat anchor open sepenuhnya di bawah fold, collapse + flush; pertahankan fokus background, atau arahkan ke heading lokal yang terlihat bila fokus sebelumnya di panel yang disembunyikan |
| Phone / resize | <768 tetap row launcher + live modal bottom sheet, tanpa footer Apply. Resize mempertahankan semantic continuity/fokus yang disepakati. Saat masuk ≥md, hitung first surface terkini sebelum menampilkan rail/panel; tidak memakai posisi phone atau token header lama |

### Collision, implementasi dan handoff

- **Add permissions, Create project dan seluruh title/description/action PageHeader harus tetap terlihat dan dapat
  ditargetkan** pada rail maupun panel expanded, termasuk header multiline, breakpoint834/1440/1920 dan scroll.
  Rail/open bertop sama; tidak ada gap buatan sesudah komponen pertama.
- Rail dan portal panel menggunakan koordinat viewport yang sama. Developer menemukan ancestor transform dari
  PageTransition menggeser fixed rail pada normal motion; penggunaan portal rail ke body diterima untuk menjaga
  pengukuran aktual, satu visible tree dan fokus. Jangan mengubah TopBar/global `--topbar-h` untuk anchor filter ini.
  Source mechanism tetap milik Developer; nearest local PageHeader + first visible sibling surface diterima,
  dengan fallback own results untuk galeri lokal.
- QA **ANCHOR-T01–08 / BIF-T13b** menguji Permissions title/action closed/open, actual bbox tanpa angka hardcoded,
  Notice/KPI/hidden/loading/error, `/ds` below fold, short-height compact + controlled scroll, normal/reduced motion,
  fokus sebelum/sesudah settle, resize dan first/unmeasured paint. Jangan membuang assertion saat animasi; bandingkan
  geometry sesudah settle dan pastikan aksi/fokus juga tidak terganggu selama transisi.
- Parent task FIL-DES-003 → **FIL-ANCHOR-001** → QA kandidat terbaru. Hasil12-pass yang memakai anchor shell lama
  dan perbandingan screenshot sebelum revisi tidak meluluskan DEC-018. Tidak ada perubahan kontrak/filter API baru.

### Referensi dan status

Page **`14 · Proposal / Floating filters · v1.0.3`** (`203:8491`) diduplikasi dari v1.0.2 sebelum perubahan; file kini21
page. V1.0.2 dipertahankan, tidak ditimpa. [Review anchor](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=203-9242)
dan [handoff aktif](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=203-9335) memuat13 contoh viewport/anchor,
termasuk Permissions loading dengan action yang tidak tertutup pada closed/open, railcompact dan scroll retained.
Frame Permissions adalah referensi geometry/loading, bukan redesign data atau shell Permissions. Variabel, master dan
style v1.0.2 lama tetap direuse tanpa diedit; hanya dependency contoh loading/compact/Module pada pagebaru ditambahkan.

**Desain/handoff siap; Figma In review, implementasi belum disetujui.** Developer sudah menerima geometry bertahap
dan QA sudah merawat oracle baru. Empat dokumen Product Lead/qa.md dan kode produk tidak diedit Designer. Menunggu
kandidat anchor terbaru, bukti runtime dan retest untuk approval implementasi.

## FIL-DES-004 — rail hug-content, ikon sidebar dan refresh stabil

**RAIL/FIRST-PAINT AKTIF / DEC-019.** Pemilik meminta collapsed rail pendek sesuai isi, bukan track penuh.
Referensi sudah dilihat: `/var/folders/37/2l2h6lpd40s91fsn0wn83gsc0000gn/T/orca-paste-1794141615486-83870cc3-ee9b-430d-82c0-5bba688fdca4.png`.
Anchor first content setelah PageHeader tetap DEC-018, expanded height tetap; multi/auto-apply tetap DEC-017.

### Anatomi dan ikon final

| Bagian | Expected |
| --- | --- |
| Regular collapsed | Lebar48, **height auto/hug-content**, padding vertikal12/gap12; toggle16, filter16, CountBadge18 bila >0, box label vertikal44. Inter14/500/line20. Items center, minimal4 px ruang samping untuk badge beberapa digit. **Tidak ada bottom16, h-full, min-height viewport, flex-stretch atau track kosong** |
| Ukuran acuan | Figma156 px dengan badge /126 tanpa badge, termasuk border1. Angka ini hasil anatomi, bukan fixed CSS height. Source Button dapat menambah border transparan sehingga runtime128 tanpa badge masih konsisten bila berasal dari content+padding/border, bukan ruang kosong tambahan |
| Compact | **CSS viewport-height≤399 px** pada desktop:48×44, filter16 di atas badge18, gap2, centered; tanpa toggle glyph/label vertikal. Tanpa badge: icon center. ≥400 memakai regular hug. Ini menggantikan keputusan JS availableH-based collapsed-height agar SSR tidak hug→compact setelah hydration |
| Expanded | Tetap width320, top sejajar first content, body scroll/header tetap, bottom16 sesuai DEC-018. Expanded tidak ikut dipendekkan. AvailableH<160 tetap memicu controlled scroll hanya pada **explicit open**, bukan perubahan collapsed height saat mount |
| Expand ke kiri | Right filter closed memakai **SidebarCollapseIcon** (`PanelLeftOpenIcon`, glyph ke kiri) untuk aksi **Expand filters** |
| Collapse ke kanan | Expanded memakai **SidebarExpandIcon** (`PanelLeftCloseIcon`, glyph ke kanan) untuk aksi **Collapse filters**. Alias awal bernama menurut left nav; arah aksi right filter yang menentukan penggunaan, bukan nama alias. Jangan memakai chevron generik/keluarga baru |
| Phone | Launcher horizontal dan modal sheet auto-apply tetap; Close tetap X. Tidak mengganti phone Close dengan ikon sidebar |

### First paint, refresh dan motion

- SSR/hydration, cold/warm refresh dan client route masuk harus mulai **collapsed**, anchor ke first surface yang
  benar, count/theme/state konsisten. Jangan sempat menampilkan expanded, track panjang, fallbacktop16 di atas
  PageHeader, node ganda atau reparent jump. Slot64/layout hasil stabil sejak SSR.
- Rail tidak memainkan **entry pop/fade/translate sendiri** pada refresh. Tidak ada hide→show loop atau perubahan
  tinggi setelah hydration pada viewport yang tetap. Preferensi implementasi yang diterima: transparent absolute lane
  dalam owning first-surface wrapper, child inline sticky dengan height hug; expanded tetap portal saat user open.
  Pointer events hanya pada kontrol yang terlihat, bukan seluruh lane transparan.
- Penempatan inline yang secara alami masih di luar viewport **tidak diangkat** ke header. Aturan lama JS availableH<44
  hide/notTab superseded: jangan menambah visibility switch yang memicu flicker. Keyboard focus ke trigger yang berada
  di luar viewport boleh menggulir **own surface** ke dalam viewport secara natural. Bukan reparent/global hoist.
- Jika posisi belum dapat diketahui, satu insertion statis di posisi yang benar dengan slot stabil adalah fallback;
  jangan pernah mengecat posisi salah. **Menyembunyikan sampai hydrated saja bukan pembuktian flicker fixed**.
- User-explicit expand/collapse tetap memakai motion tokens existing. Reduced motion opacity-only/tanpa perpindahan
  spasial. Perubahan compact399↔regular400 saat resize adalah responsif yang disengaja, menjaga fokus/values; pada
  refresh di viewport tetap mode tidak boleh berganti. Tidak menghapus semua motion aplikasi karena dugaan.
- Gerak startup seluruh page yang tetap dipertahankan harus dibedakan dari rail yang beranimasi/toggle sendiri:
  ukur rail relatif ke anchor **dan** own/ancestor opacity, transform serta animationName sampai SETTLED, bukan hanya
  status READY. Tidak ada independent height/opacity cycle, false toggle atau anchor mismatch selama frame terlihat.

### Handoff dan bukti review

FIL-DES-004 → **FIL-COLLAPSE-001 / FIL-REFRESH-001** → **FIL-QA-004** / Designer rereview, sesuai ID canonical backlog.
Istilah FIL-HUG-001 / FIL-FLICKER-001 pada pesan handoff awal adalah alias kedua task tersebut, bukan tugas tambahan.
Developer menerima padding/icon map,
CSS399/400 dan stable inline SSR; QA merawat HUG/REFRESH oracle. Pengujian: count0/active/multi-digit, cold/warm,
hydration lambat/CPU throttling, dark/light, normal/reduced,399/400 dan desktop/phone; user toggle tetap berfungsi,
fokus/hit target≥44, tidak menutupi PageHeader/first surface, klik lane kosong tidak menghalangi hasil.

Figma **v1.0.4** page`211:10173` menduplikasi v1.0.3; file kini22 page. V1.0.3/1.0.2 dipertahankan.
[Review current](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-10924),
[handoff rail/refresh](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-11089) dan
[empat rail variants](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=213-10336).
Toggle glyph diambil langsung dari Hugeicons yang diimpor `icons.ts`; badge18 adalah cerminan code existing, tanpa
mengubah badge28 Figma lama. Dependency baru terbatas pada rail/icons/badge untuk request ini.

Anatomi regular/compact0/53 ditinjau di `filter-hug/anatomy-reviewed.png`; komposisi menunjukkan rail pendek,
anchor tetap dan expanded tetap tinggi. Source filmstrip Developer awal juga ditinjau, tetapi paket
`sticky-first-artifacts` berisi JPEG short rail dan tail full-height yang tidak cocok dengan JSON height128;
ini dicatat sebagai **konsistensi evidence**, belum defect produk baru. Developer diminta clean run manifest dan
diagnostik own/ancestor motion; delta0/satu node saja tidak cukup untuk sign-off flicker. Tidak ada run browser baru
atau klaim independent QA dari Designer. Bukti Figma tidak membuktikan motion runtime.

**Desain siap handoff; Figma In review. Approval implementasi tetap pending** kandidat yang dapat ditelusuri,
filmstrip konsisten, retest QA dan review Designer. Tidak ada kode produk/four Product Lead docs/qa.md diedit Designer.

Audit akhir v1.0.4: **15 contoh viewport + anatomi rail/state specimens**, **4.518 descendant nodes**, **1.099 instances**
dengan master terselesaikan, nol image fill, Inter/Geist Mono dan tujuh tautan prototype valid. Regular156/126 dan
compact44 terukur di master; anchor card/rail/open tetap sama dan lebar hasil1062 di contoh desktop. Master/UI lama
tidak diedit. Own-page audit v1.0.3 tetap**3.872 nodes/936 instances**, rail lama714 sebagai riwayat; collection/mode
counts unchanged. Handoff dipisahkan dari area review agar tidak menimpa contoh. Tidak ada publish library/native
history checkpoint.

Artifact gitignored: `.superpowers/scratch/designer/filter-hug/{final-audit.json,composition-initial.png,
anatomy-reviewed.png,handoff-reviewed.png,release-reviewed.png}`. Screenshot komposisi mendahului koreksi kecil placeholder
Permissions; koreksi memakai property QueryInput pada instance baru. Session `ded1af30-2c4e-41bf-8303-4578fcb773f3`.
Scope v1.0.3 terarsip di `filter-anchor/final-audit.json` dan `permissions-open-reviewed.png`. Semua bukti ini adalah
Figma; tidak menggantikan review flicker/candidate. Handoff aktif sudah dikirim per bagian ke Developer/QA/Product Lead.

### Review runtime parsial — 8 November 2026

Designer melihat screenshot Developer berikut pada source kerja sebelum koreksi border terakhir:
Permissions1440 light closed/dark open; Projects834 light closed,1920 dark closed,390 light closed dan360 dark
checked. Rail sudah pendek dan sejajar first card, judul/action tidak tertutup; expanded Permissions memiliki pencarian
serta kelompok Module, dan phone mempertahankan launcher horizontal/sheet dengan dua checkbox aktif tanpa Apply.
Ini penerimaan visual untuk sampel tersebut, **bukan approval kandidat akhir**. Path dan SHA-256 screenshot yang
benar-benar dilihat tersimpan di `filter-hug/runtime-partial-review.json` agar nama file yang dipakai ulang tidak
dianggap bukti immutable. Compact outer44 masih menunggu hasil koreksi border dan capture baru Developer.

Clean capture `browser/refresh-captures/cold-900-empty-no-preference-1794143657945` juga diperiksa:
`frame-005.jpg`, `settled.png`, manifest dan JSON16 samples. Lima belas sample visible memiliki anchor delta0,
own opacity1/transform none/animation none; gerak yang tercatat berasal dari ancestor page/shell startup dan
berakhir setelah READY412 ms, SETTLED456,5 ms. Filmstrip terpilih konsisten dengan rail pendek128 pada run itu.
Temuan ini menjelaskan sampel cold/light/normal tersebut saja. Manifest memiliki `sourceRevision:null` dan
Developer masih mengoreksi border; final packet perlu source fingerprint/candidate dan retest, termasuk kondisi
lain, sebelum QA-FIL-001 dapat ditutup. Tidak menyatakan seluruh refresh bebas flicker.
Nilai revision null sendiri bukan alasan menolak bukti bila pemetaan source fingerprint ke build/candidate tersedia.

Crop galeri `final-artifacts/gallery/diff-regions.json` tidak dipakai untuk approval filter: Developer mengoreksi
bahwa crop tersebut menunjukkan penambahan FilterIcon pada icon catalog. Suffix20.723 baris identik adalah area
kosong, sehingga tidak membuktikan seluruh komponen di bawahnya sama. Review filter galeri memerlukan viewport
yang benar-benar memperlihatkan contoh filter. Tidak ada defect produk baru disimpulkan dari keterbatasan artifact.
Developer kemudian menyediakan `browser/gallery-filter-{desktop,mobile}-{light,dark}.png`; keempatnya sudah dilihat
Designer. Rail desktop sejajar card dengan height hug, launcher phone berada sebelum stacked cards, dan konten/sort
tetap terbaca pada light/dark tanpa tabrakan yang terlihat. Bukti ini cukup untuk layout closed pada viewport yang
ditampilkan; tidak membuktikan interaksi, seluruh isi galeri atau koreksi border desktop terakhir. SHA-256 empat
artifact ditambahkan ke ledger review parsial.

### Review kandidat Linux final — rail/refresh diterima untuk matrix yang tersedia

Paket canonical Developer `final-artifacts/refresh-linux-index.json` dengan SHA-256
`247b51c9db37038d2fe4ca428eea48133bd275c55082920a3947beefa24585e0` sudah diperiksa Designer.
Kedelapan manifest cocok pada runtime fingerprint
`7baa40b391212ceb142afe667b7882705bdf98930561f420d27b5a5d0b66f117`, build`pPqSrrRBoEB-UWyhRGPFX`
dan probe archive/hash yang sama. Daftar JPEG pada setiap folder sama persis dengan manifest, seluruh SHA-256
JPEG dan probe cocok. Ini menggantikan paket lama untuk review border/refresh Linux; riwayat review parsial tetap ada.

Matrix ini berisi cold/warm pada1440×900 empty/light/normal,1440×900 active/dark/reduced,
1440×399 empty/light/normal serta1440×400 active/dark/reduced, CPU throttle4. Seluruh sample visible sampai sesudah
SETTLED menunjukkan satu node/copy, delta anchor0, height126/156/compact44 stabil, own opacity1/transform none/
animation none. Startup motion ancestor page/shell pada normal motion tetap ada; rail tidak menjalankan entry
motion sendiri. Ini matrix terpilih, bukan seluruh kombinasi viewport/theme/motion/state.

Designer melihat **settled screenshot seluruh delapan run**, serta `frame-005.jpg` cold/warm900 empty. Rail pendek,
badge dan compact terbaca; top mengikuti card dan action Permissions tetap terbuka. **Review visual rail/refresh
diterima untuk matrix Linux dan fingerprint tersebut.** Tidak ada temuan visual baru pada bukti yang diperiksa.
Log `frozen-linux.log` mencatat36 pass dari eksekusi Developer; Designer memeriksa artifact, tidak menjalankan
ulang suite dan tidak mengklaim independent QA pass. Ringkasan audit/hash tersimpan di
`filter-hug/final-linux-refresh-review.json`.

Status gabungan tetap **Figma In review / approval implementasi penuh pending** hasil kandidat Mac, review QA
independen serta keputusan release Product Lead. Penerimaan terbatas Linux ini tidak menutup QA-FIL-001 atau
QA-EVID-001 atas nama QA dan tidak mengubah status publishing/checkpoint Figma.

### Review kandidat Mac final — matrix rail/refresh diterima

Paket `final-artifacts/refresh-mac-index.json` SHA-256
`a74bc10aeeecb91ad1310441db97239ab5aef6d4531c763bbfe32881570d4d62` memakai runtime fingerprint sama dengan Linux
di atas, build Mac`Cp4GjCl9aN94ZxtW5Fxq0`. Designer memvalidasi delapan manifest/source/build/probe, exact JPEG set
dan seluruh hash, serta data visible sampai setelah SETTLED. Satu node/copy, anchor delta0, height126/156/44 dan
own opacity1/transform none/animation none konsisten; index mencatat console/browser errors kosong. Matrix kondisi
sama dengan Linux, bukan pengujian seluruh kombinasi atau seluruh flow.

Delapan settled screenshot sudah dilihat, ditambah cold900 frame005 dan warm900 frame005/010. Frame warm005 masih
sebelum konten terlihat; frame010 dan screenshot settled memperlihatkan rail pendek yang mengikuti card dan startup
page. Tidak ada collision pada title/action Permissions atau temuan visual baru. **Matrix Mac dan Linux tersebut
diterima secara visual pada runtime fingerprint final yang sama.** Ringkasan tersimpan di
`filter-hug/final-mac-refresh-review.json`. Log Developer `frozen-mac.log` mencatat13 pass; bukan eksekusi QA/Designer.

`completion.json` Developer membekukan kandidat pada8 November2026,13:35:24 UTC, product fingerprint
`0b2fb1e94c8ad765f2daeaa3fad3d211ca0ecf7c26b945af366553fea1bd216d`. Pemeriksaan Designer atas artifact ini
tidak mencakup seluruh task dalam completion packet. **Figma tetap In review; approval implementasi penuh dan
release menunggu retest independen QA serta keputusan Product Lead.** Status pending kandidat Mac pada catatan
sebelumnya sudah dipenuhi untuk matrix rail/refresh ini; tidak menyatakan seluruh implementasi disetujui.

### Konsolidasi setelah retest QA independen

Designer membaca hasil final di [QA — kandidat beku](qa.md#retest-kandidat-beku--fil-qa-004--qa-rel-001):
runtime/product fingerprint tetap sama sebelum/sesudah retest. QA melaporkan95 browser pass/50 viewport skip,
143 API pass dan38 web pass, ditambah probe terpisah. Ini cakupan targeted, bukan full browser final.
Delapan refresh independen QA serta pemeriksaan anchor/actions/focus/resize terkait lulus; **QA-FIL-001 dan
QA-EVID-001 Closed / verified** sesuai keputusan QA. S4-BUG-001/002/003 juga ditutup oleh QA; tidak mengubah
atribusi review Designer menjadi eksekusi tes QA. Headroom bundle200B dan monitoring intermittent tooltip tetap
tercatat pada gate lokal QA; Designer tidak menutup risiko itu.

**Keputusan Designer:** review visual FIL-DES-003/004 diterima untuk bukti anchor/hug/icon/refresh yang sudah
dilihat pada fingerprint final, dengan retest perilaku independen QA sebagai pendukung. Tidak ada permintaan
redesign tambahan. Ini menyelesaikan review visual delta tersebut, bukan seluruh task completion packet atau
persetujuan release/deployment. Release index Figma`218:3` telah diperbarui langsung dengan hasil Designer/QA,
build Mac/Linux dan batas scope; **status In review dipertahankan sampai persetujuan pemilik** sesuai standar
versioning. Hanya metadata verifikasi index yang diubah; tidak membuat patch desain baru atau mengubah v1.0.4,
predecessor, master, token dan style. Keputusan release lokal/konsolidasi distribusi tetap milik Product Lead.

Product Lead kemudian menetapkan [DEC-020](decisions.md#dec-020--penerimaan-revisi-filter-untuk-penggunaan-lokal):
**GO penggunaan/review lokal revisi filter**, preview`http://127.0.0.1:3453` pada kandidat yang sama. Ini memenuhi
keputusan lokal yang sebelumnya pending; REL-001/QA-REL-001 untuk template keseluruhan tetap terpisah. Figma
In review dipertahankan sesuai keputusan itu, tanpa desain atau rerun tambahan.

## NEXT-DES-002 — Batch A: navigasi, activity dan copy invitation

**Desain tertulis siap implementasi / kandidat baru belum disetujui.** Otorisasi [DEC-022](decisions.md#dec-022--go-implementasi-batch-a)
mencakup NEXT-NAV-001, NEXT-AUD-001, NEXT-MAIL-001 dan regresi invariant NEXT-RBAC-001. Handoff NAV/MAIL dan tiga
bagian AUD sudah dikirim langsung ke Developer/QA sebelum spesifikasi ini selesai. NAV/RBAC dapat berjalan sekarang.
Designer memakai pola/token existing dan aturan responsif di atas; tidak mengedit source produk atau empat dokumen
Product Lead/qa.md. Figma **tidak diubah untuk handoff ini**: referensi shell/rail tetap
[v1.0.4](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-10924), spesifikasi delta di bawah authoritative.
Tidak mengklaim frame Batch A baru tersedia. Bila kebutuhan visual baru memerlukan Figma, duplikasi area terdampak
ke patch berikutnya sebelum edit sesuai [versioning](standards/figma-versioning.md).

### Tujuan dan alur

- Admin menemukan satu Users, memahami filter yang dipulihkan, lalu mengubah status melalui filter/chips/views.
- Pembaca activity mengenali siapa melakukan apa pada record mana, lalu membaca perubahan yang benar-benar tercatat.
- Admin membuat akun melalui invitation dan memahami bahwa keberhasilan create tidak membuktikan email dikirim/diterima.
- Regresi Superadmin membuktikan permission baru berlaku pada request sesi berikutnya; tidak membutuhkan kontrol/UI baru.

### NEXT-NAV-001 — satu Users

Label/icon tetap **Users**, urutan Access tetap Users → Roles → Permissions. Satu destination pada sidebar expanded,
collapsed/tablet rail, drawer phone dan command palette; shortcut G U tetap. All users/Active users/Inactive users
bukan child navigation. Ini tidak menghapus dukungan primitive child untuk modul lain.

Klik Users tetap melalui remembered view existing, tidak diam-diam reset All. URL lama `?status=active`,
`?status=inactive`, multi-status, saved views dan Back tetap bekerja. Tidak ada tambahan status tab di PageHeader.
Judul/chips/filter badge yang sudah ada menerangkan scope; Clear all mengikuti defaults existing (bukan selalu All).
Jika saved view kosong/tidak valid, gunakan fallback parser existing; tidak membuat storage kedua atau reset preference.
Fokus/aria-current/tooltip rail mengikuti satu destination; phone drawer menutup sesuai perilaku nav existing.

### NEXT-AUD-001 — hierarki dan komponen

Gunakan AuditTable, Panel, DataTable, EntryDialog/Dialog, CopyValue, format waktu dan typography/surface tokens existing.
List mempertahankan kolom/sort/filters/paging/export serta action label manusia existing; phone action tetap title
dan actor/target/waktu tetap terbaca. Tidak membuat link target, tombol Copy link, endpoint detail, IP/device/requestId
activity atau state inbox/lifecycle.

Copy halaman:

| Lokasi | Copy final |
| --- | --- |
| Description | Changes to users, roles, permissions, profiles and projects: who made them, to which record, and when. |
| Empty hint | Entries appear here when someone changes a user, role, permission, profile or project. |
| Detail title | `actionLabel(action)` existing; unknown action dipertahankan sebagai teks |
| Summary setelah title | `By {actor.name} · {target type label}: {target.label}` |
| Missing snapshot | Field values were not recorded for this event. |
| Recorded values tanpa perbedaan semantik | No field changes are shown for the recorded values. |

Target type yang dikenal ditulis User/Role/Permission/Project/Profile hanya jika nilai type memang sesuai; unknown
type/label/ID ditampilkan aman sebagaimana tercatat, tidak diasumsikan route atau diambil dari record terkini. Nama
atau target kosong tidak diisi identitas fiktif: gunakan ID/type yang tersedia, lalu Unknown user/Unknown target
jika benar-benar tidak tersedia. Actor dan target adalah data event, bukan klaim record tersebut masih hidup.
Ringkasan tidak memakai HTML dari payload. Waktu absolut tetap memakai formatter/timezone aplikasi, waktu relatif
dan ID tetap sekunder; raw action/field key serta ID tidak dijadikan headline. Copy entry ID tetap tersedia.

Detail mempertahankan modal/bottom-sheet existing, title/Close yang dapat diakses, body scroll dan fokus panel
saat dibuka; Escape/Close mengembalikan fokus ke trigger existing. Summary berada sebelum metadata/detail changes.
Desktop/tablet dapat memakai label-value rows serta Before/After sejajar. **Phone <768:** metadata label di atas
value; setiap field change ditumpuk **field → Before: value → After: value**, tanpa field column lebar tetap.
Create/delete memakai satu sisi yang relevan. Satu DOM yang berganti melalui CSS; tidak menggandakan ID/live region.
Long keys/IDs/JSON/array membungkus di region sendiri, tidak menambah horizontal page scroll pada360/390. Label/value
tetap body-sm/caption tokens, bukan font diperkecil untuk memaksakan tiga kolom. Gaps/padding mengikuti dialog/field
existing; tidak menambah warna status untuk Added/Removed, keduanya memakai teks eksplisit dan surface tokens.

### Semantik changes — tidak menebak snapshot

| Bukti event | Presentasi |
| --- | --- |
| Known create + after object | **Initial values**; field yang tercatat di after, bukan Before kosong palsu |
| Known delete + before object | **Values before deletion**; tidak menyatakan semua field/record turunan ikut terhapus |
| Update + before/after object | **Changes**, field yang berbeda; Rename sebagai Name Before/After |
| `user.assign_role` dengan string-set roles lengkap di kedua sisi | **Roles added** / **Roles removed**, selisih set |
| Known permissions full-set di kedua sisi | **Permissions added** / **Permissions removed**, selisih set |
| `role.create` / `role.update` dengan after.added/removed string arrays yang sah | Delta permissions eksplisit; bukan snapshot lengkap. Tampilkan **Permissions added** / **Permissions removed**; perubahan Name tetap field tersendiri |
| `role.delete` dengan before.permissions | **Permissions before deletion**, tidak diberi label permission records deleted |
| `permission.create` dengan after.created sah | **Permissions added**, dari nilai created yang tercatat |
| Kedua snapshot tidak tersedia | Copy missing snapshot, sambil mempertahankan actor/action/target/time |
| Snapshot object tersedia tetapi tidak ada perbedaan semantik | Copy recorded-values/no-field-changes; tidak menyatakan event tidak terjadi |
| Unknown action/key, scalar/nested/legacy shape | Fallback value/JSON aman dan masked, pertahankan nama mentah yang belum dikenal; jangan blank, crash atau paksa menjadi known delta |

Roles/permissions yang **dikenal sebagai set string** mengabaikan reorder-only. Added/removed ditampilkan
deterministik, dedupe exact; bukan case folding atau locale-normalization baru. Array unknown tetap diperlakukan
sebagai nilai tersimpan, tidak diasumsikan set. Full-set subtraction membutuhkan field pada **kedua sisi** hadir dan
valid; missing side tidak dianggap `[]`. Create after-only Roles tetap Initial values/Roles, bukan derived Roles added.
Delete before-only Permissions tetap Permissions before deletion. Explicit `role.create/update` after.added/removed
adalah bentuk delta berbeda yang dapat dipresentasikan tanpa merekayasa full before set.
Recognize delta hanya untuk action/shape yang dikenal. Nilai nonstring,
struktur tidak lengkap yang tidak membuktikan full snapshot, atau overlap added/removed yang ambigu menggunakan
fallback masked; jangan mengarang daftar selisih. Role create/delete tidak menandai seluruh before/after kosong
sebagai update biasa. Empty delta sah memakai **None** bila grup ditampilkan; dapat menghilangkan grup kosong ketika
grup lain sudah menerangkan perubahan, tetapi tidak menggantinya dengan missing-data warning.

| Nilai field yang benar-benar diketahui | Copy |
| --- | --- |
| Key tidak ada di sisi object | Not recorded |
| `null` | Not set |
| String kosong | Empty text |
| Array kosong | None |
| Boolean | Yes / No; khusus isActive = Active / Inactive |
| Nested empty object | `{}` sebagai nilai, bukan None/null |
| Mask credential | Marker masked existing; nilai asli tidak boleh diungkap |

Perbedaan presence/null/empty tidak disatukan dengan dash yang sama. Snapshot keseluruhan null/tidak tersedia
bukan objek berisi field null. Field credential yang sama-sama masked tidak membuktikan perubahan isi secret;
action password/2FA tetap menerangkan event yang tercatat, tidak membuat diff nilai secret. Masking rekursif existing
tetap berlaku pada fallback, raw field, nested JSON dan CSV; tidak menawarkan toggle untuk membuka nilai secret.
JSON API/stored event tidak ditulis ulang atau dinormalisasi untuk display. CSV mempertahankan kolom/wire existing
dan formula safety; label/summary boleh readable tetapi fakta delta/presence/masking harus konsisten dengan UI.
Tidak ada API baru dalam handoff ini; setiap gap kontrak dibawa ke Product Lead.

Field labels yang diketahui:

| Key | Label | Catatan |
| --- | --- | --- |
| name / username / email | Name / Username / Email | String tersimpan |
| isActive | Status | Active / Inactive |
| isLdap | Directory sign-in | Yes / No; false tidak membuktikan password/local provider |
| roles / permissions | Roles / Permissions | Set hanya bila shape sah |
| invited | Invitation requested | Tidak berarti sent/delivered/accepted |
| connected | Connected accounts | Nilai tersimpan, bukan provider diverifikasi ulang |
| twoFactorEnabled | Two-factor authentication | Yes / No |
| description | Description | Pertahankan empty/null semantics |
| createdAt / updatedAt | Created / Updated | Formatter tanggal hanya untuk nilai sah |
| session / provider | Session / Provider | Tetap redacted sesuai aturan field/value |

Field lainnya menggunakan key mentah yang aman, bukan tebakan label. Ini dictionary presentation, bukan enum kontrak.
Array harus mempertahankan batas item: satu nilai `"a, b"` tidak boleh tampak sama dengan dua nilai `"a"`, `"b"`.
Gunakan safe JSON pada unknown/ambiguous arrays atau quoted items yang membedakan struktur; raw DTO tetap.
Empty string di daftar role/permission tidak dianggap token delta yang sah; fallback masked mempertahankan evidence.

### NEXT-MAIL-001 — copy berdasarkan fakta create response

| State/lokasi | Copy dan perilaku |
| --- | --- |
| Method option | **Invite by email** |
| Active helper | The user chooses a password using a link valid for 72 hours. Email delivery isn't confirmed here. |
| Inactive helper | Activate this user to use an invitation. |
| Create success title, semua method | `Created {created.name}.` — nama dari response |
| Invite-only success description | Email delivery isn't confirmed here. |
| Password/directory success atau edit | Feedback existing; tidak menampilkan disclaimer invite pada method lain |
| Create pending | Busy/disabled/spinner existing, satu submission; tidak menampilkan success sebelum response |
| API validation/permission/duplicate/network error | Field/form error existing, draft tetap. Tidak mengklaim akun dibuat atau email gagal. Network error bukan bukti akun pasti tidak ada; jangan retry mutation otomatis |

Mode SMTP/log tidak mengubah copy menjadi sent/delivered/queued. Tidak ada action resend/revoke, status pending/
accepted/expired, delivery badge, token/link preview atau instruksi melihat secret pada log. Helper menjelaskan
expiry sebagai perilaku invitation existing, bukan jaminan delivery. Forgot/reset anti-enumeration dan email content
tidak diubah. Copy cukup membungkus pada phone; tidak memotong disclaimer atau mengandalkan tooltip.

### Acceptance visual, state dan status handoff

| Area | Acceptance kandidat baru |
| --- | --- |
| NAV | Satu Users visible dan satu fokus destination pada tiap mode; remembered multi-filter/chips/count jelas; G U/Back/deep URL lama tetap; Roles/Permissions tidak berubah |
| Activity data | Actor/action/target/time terbaca; create/update/delete/no-snapshot/reorder/delta/legacy/null-empty dibedakan; ID/keys sekunder; tanpa klaim secret yang tak dibuktikan |
| Activity responsive |360/390,834,1440 light/dark; metadata/change blocks tidak overflow; Before/After tetap berlabel; Close/body scroll/fokus keyboard dan reduced motion existing terjaga |
| Activity loading/empty/error | Data-region loading/empty/error/retry/stale existing tetap; description/hint menyebut Projects. Detail tidak menambah request/state endpoint baru; data snapshot berasal dari row existing |
| MAIL | Invite method/copy/disabled/error/success teruji; tidak ada false sent/delivered/queued, tidak ada secret di feedback; success method lain tidak terpengaruh |
| Shared | Existing tokens/components, status tidak color-only, touch target≥44, no new dependency; rail/refresh/form/account regressions dipilih QA berdasarkan delta |

**Terbuka:** Developer menilai bentuk formatter/shared CSV dan fallback data legacy, mengeskalasi gap feasibility
tanpa mengubah kontrak diam-diam. QA memfinalkan oracle semantik dari handoff ini. NAV/RBAC tidak perlu menunggu
seluruh formatter. **Desain siap; implementasi belum disetujui.** Menunggu kandidat Batch A baru yang dibekukan,
artifact viewport/theme/state dan hasil QA; penerimaan baseline DEC-020 tidak dipakai meluluskan Batch A.

Review source parsial Designer: NAV dan invitation copy sesuai handoff, formatter UI berada di lazy EntryDialog,
shared semantic model dipakai CSV, metadata/change fields phone memakai satu DOM/CSS. Empty/presence/masking dan
full-set versus explicit delta terlihat mengikuti aturan. Gap delimiter array dan empty delta token di atas sudah
disampaikan ke Developer/QA sebelum freeze. Ini inspeksi source, bukan hasil browser atau approval implementasi.
Rereview source setelah koreksi: unknown arrays memakai JSON, known sets dengan comma/newline/edge whitespace
juga JSON; blank member ditolak untuk known delta. Assertions mencakup satu-versus-dua item serta permission kosong.
Nested credential null dipertahankan berbeda dari masked value, sedangkan masked→masked tidak menciptakan diff.
Kedua gap Designer terselesaikan pada source yang dibaca; Developer melaporkan9 unit pass. Tidak ada eksekusi tes
atau approval visual baru oleh Designer dari catatan ini; kandidat freeze/runtime masih menunggu.
Standar navigasi `ui-standard.md` §5b dan `design-system.md` bagian sidebar telah disinkronkan: children opsional
generik, Users satu destination dengan remembered view; contoh Users subtree lama dihapus dari aturan aktif.
Developer juga menemukan fokus Close/Escape detail audit tidak kembali ke row trigger karena dialog controlled
tanpa Trigger. Expected tetap fokus ke tombol pembuka yang masih tersedia; source fix dan failing browser regression
dilaporkan Developer, retest/runtime review masih pending. Ini koreksi terhadap acceptance existing, bukan pola baru.

### Review awal artifact audit Batch A — belum kandidat beku

Designer melihat delapan screenshot Developer di `developer-batch-a/browser-focused-audit/`:360 light index0/1/2/5,
390 dark long-values,834 light index6 dan1440 dark index0/3. Ini contoh test-only recorded events, termasuk shape
legacy/presence, bukan klaim semua payload berasal dari aksi produksi. Sampel menunjukkan metadata/change fields
phone bertumpuk, Before/After berlabel, JSON/nama field panjang membungkus, null/masked/empty text berbeda, initial values dan
values before deletion jelas, serta summary/Close tetap terbaca. Unknown/reorder/no-snapshot tetap memakai copy
sesuai bukti. **Tidak ada koreksi visual tambahan pada delapan sampel yang dilihat.**

Source/runtime dilaporkan Developer`819f0cb…509db`, tetapi freeze/build binding final masih menunggu investigasi
account cold-Enter. Developer melaporkan focused audit9 pass; bukan run Designer atau QA independen. Static PNG
tidak membuktikan focus return, console/axe ataupun seluruh responsive matrix; BA-QA001 tetap menunggu verifikasi
QA. SHA-256 delapan file yang benar-benar dilihat dan batas review tersimpan di
`.superpowers/scratch/designer/batch-a/preliminary-audit-review.json` agar penggantian nama file dapat ditelusuri.
Penerimaan visual/kandidat akhir belum diberikan dari paket awal ini; Figma tetap tidak diubah untuk Batch A.

### Review interaksi source — BA-TEST001 queued account open

Patch Developer pada shared deferred overlay ditinjau Designer: explicit Enter/Space/ArrowDown yang terjadi setelah
preload resolve tetapi sebelum stand-in diganti harus tetap membuka sekali. `defaultOpen=false` adalah initial
state, bukan larangan terhadap tindakan open berikutnya. `open=false` pada controlled owner tetap otoritatif;
source assertions mencakup owner yang menolak request serta callback tepat sekali. Handoff fokus/key-open existing
dipertahankan. **Arah UX patch diterima pada review source**, tanpa perubahan visual/Figma atau flow baru.

Ini bukan verifikasi runtime, penutupan BA-TEST001, atau pembuktian akar race dari trace tunggal. Final candidate
harus mengikat shared primitive baru ke fingerprint/build yang benar; account loading→Profile, failure/retry,
Escape/outside/return focus, expiry dan consumer menu/popover terdampak tetap mengikuti regresi berbasis risiko QA.
Catatan hasil run sebelumnya tidak dilabel ulang green dan delapan PNG awal tetap pre-freeze.

### Review visual final Batch A — NEXT-DES-002 selesai dalam scope

Paket Developer `developer-batch-a/{completion.json,fingerprint.json,artifact-index.json,HANDOFF.md,source-delta.json}`
dibaca. Fingerprint antar completion/index/manifest cocok: runtime
`ca1f803c1d7cc72abc64d22b3ce757295c9a6cf69d7da9148b2cb4bb878d359c`, product/test
`3790e085ee1738a5e6027690786158cbc7028193e89c34cf5ba23cc2864714ba`, build
`6itnZmu8wVgOUoML63Na2`, frozen8 November2026,16:15:53 UTC. SHA-256 artifact index
`85116c96db08e6c22e3f3b03fd0f2ce15e66571cc2eae2d4e66dd5e69a7fcbae`.
Designer memvalidasi ukuran/hash **362 file yang diindeks**, bukan inspeksi visual362 file, dan mencocokkan
**22 source delta files** terhadap hash akhir tanpa mismatch. Ini menggantikan binding pre-freeze untuk keputusan
visual berikut; riwayat artifact awal tetap disimpan.

**13 PNG final benar-benar dilihat** dari `browser-verified-browser/`:

| Area / artifact | Yang diperiksa |
| --- | --- |
| `batch-a-nav-collapsed.png`, `batch-a-nav-drawer-390.png`, `batch-a-nav-drawer-834.png` | Satu Users, leaf rail, label/order nav, multi-status/role chips di hasil, tanpa submenu status |
| `batch-a-invite-phone.png`, `batch-a-invite-success.png` | Invite by email/helper membungkus; create success dan disclaimer delivery tepat, tidak terpotong |
| Audit360 light index0,360 dark index5 | Phone Before/After stacked; Name dan explicit delta; Values before deletion/Permissions before deletion |
| Audit390 light index6,390 dark long-values | Initial values, Invitation requested; nested null/masked, status, empty text dan batas item JSON/long keys |
| Audit834 light index9,834 dark index2 | Raw unknown action aman/Not recorded; reorder-only no-field-changes copy; metadata tablet dan Close |
| Audit1440 light index4,1440 dark index3 | Legacy scalar→masked JSON dengan wrapping; no-snapshot copy berbeda dari unchanged; summary/title/ID hierarchy |

Setiap audit filename memakai prefix`batch-a-audit-`. Screenshot audit edge cases memakai recorded fixtures
test-only; tidak diklaim semua payload berasal dari writer produksi. Detail summary mempertahankan target type
yang tercatat meskipun fixture sengaja memakai target Role untuk beberapa action. Tidak mengoreksi evidence menjadi
identitas/target yang diperkirakan. Create/delete/delta/legacy/fallback terlihat sesuai handoff; close/header/body
tetap terbaca dan tidak ada overflow/tumpang tindih yang terlihat pada sampel tersebut.

**Keputusan Designer: scoped visual acceptance diberikan** untuk NEXT-NAV-001, NEXT-AUD-001 dan NEXT-MAIL-001
pada fingerprint/build ini. Tidak ada koreksi visual tambahan atau redesign diminta. Handoff dan review visual
NEXT-DES-002 selesai dalam scope tersebut. Figma tidak diubah untuk Batch A; tidak ada frame/release patch baru
yang diklaim. Existing Figma v1.0.4 dan statusnya tetap mengikuti keputusan sebelumnya.

Log final Developer`verified-browser.log` yang dibaca mencatat63 pass; completion juga melaporkan fullcheck1576,
CPU4 account30 dan budget22 route lulus. Semua hasil itu **eksekusi Developer**, bukan Designer/QA independen.
Account Enter focus JSON final dibaca sebagai bukti tambahan, bukan pengganti pengujian keyboard sendiri. Static
review tidak menutup BA-QA001/BA-TEST001, membuktikan semua focus/race states, menguji seluruh362 artifact,
Linux/WebKit/perangkat nyata, atau memberi approval seluruh RBAC/security/release. NEXT-QA-003 dan keputusan
penerimaan lokal tetap milik QA/Product Lead. Preview kandidat`http://127.0.0.1:3454`, baseline3453 dipertahankan.
Ledger scope, fingerprint,13 image SHA dan audit hash:
`.superpowers/scratch/designer/batch-a/final-visual-review.json`.

### Konsolidasi QA final Batch A

Hasil akhir [NEXT-QA-003](qa.md#next-qa-003--hasil-akhir-kandidat-batch-a) dan
`qa-batch-a/final/completion.json` sudah dibaca Designer. Runtime/product/build sama dengan kandidat visual di atas,
QA menghitung ulang sebelum/sesudah tes dan melaporkan tidak berubah. QA independen: core63 dan CPU4 stress30
browser executions, API135, shared23/UI28/web11 lulus; probe tambahan terpisah. Ini bukan full E2E atau jumlah
unique scenarios93. **BA-REV-001/002/003, BA-QA-001 dan BA-TEST-001 Closed / verified** sesuai keputusan QA,
termasuk nested-null/masking, batas item array, unknown action, focus return kedua audit log dan queued account open.
Status pending/Open historis di atas digantikan hasil ini hanya untuk scope/fingerprint yang sama.

**NEXT-DES-002 selesai: desain/handoff dan scoped visual acceptance NAV/AUD/MAIL; QA independen mendukung
perilaku kandidat final.** Tidak ada perubahan desain tambahan. QA merekomendasikan GO lokal Batch A; keputusan
penerimaan Product Lead masih terpisah dan tidak diturunkan dari review Designer. Batas viewport/browser/provider,
headroom400B dan transport-stall historis tetap mengikuti catatan QA, tidak dihapus atau dilabel ulang fixed.
Figma tetap tidak diubah untuk Batch A; REL-001/QA-REL-001 template keseluruhan tidak diluluskan oleh catatan ini.

### Keputusan lokal Batch A — DEC-023

Product Lead menetapkan [DEC-023](decisions.md#dec-023--penerimaan-lokal-batch-a): **GO penggunaan lokal Batch A**
pada runtime/product/build final di atas. NAV/AUD/MAIL dan invariant RBAC diterima berdasarkan review owner
masing-masing. Ini memenuhi keputusan lokal yang sebelumnya pending; tidak ada desain atau rerun tambahan.
Klarifikasi atribusi bukti Developer: CPU4 cold30 memakai build terpisah`DLFj3jpR2A3pRRrO1eVgj` dengan runtime sama,
bukan run build visual final`6itnZmu8wVgOUoML63Na2`; QA memiliki stress independen pada kandidat final sendiri.
Preview diterima`http://127.0.0.1:3454`, baseline3453 tetap. Batas/risiko QA dan histori failures tetap berlaku;
REL-001/QA-REL-001 keseluruhan terpisah. Tidak ada perubahan Figma, commit, merge atau deployment dari keputusan ini.

## NEXT-DES-003 — Audit investigasi: entry link, exact filters dan history

**Handoff tertulis siap implementasi; review kandidat pending.** Pemilik memilih opsi audit investigasi melalui
[DEC-025](decisions.md#dec-025--pemilik-memilih-audit-investigasi-sebagai-batch-berikutnya), scope NEXT-AUD-002.
Developer memiliki API/shared/code; Designer menetapkan UX/copy; QA memiliki oracle/verdict. Bagian entry, copy,
states, history, exact-filter actions dan target availability sudah dikirim bertahap langsung ke Developer/QA.
Ini bukan approval implementasi dari handoff. CI main known-red tetap isu terpisah, tidak dinyatakan hijau.

Referensi memakai pola AuditTable/EntryDialog, Dialog phone, FilterLayout/chips, CopyValue/clipboard, Failure/Notice,
PageHeader/Panel serta token existing. Semantik recorded evidence Batch A tetap. **Tidak ada edit/frame Figma baru
untuk task ini**; [Figma existing](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-10924) menjadi
acuan shell/rail, delta authoritative pada spesifikasi ini. Bila kemudian diperlukan perubahan Figma, duplikasi area
terdampak ke patch berikutnya sebelum edit. Tidak ada actor/target lookup service atau form UUID manual pada MVP.

### Tujuan pengalaman dan batas scope

Pembaca dapat membuka satu event dari link tanpa mencari page/range yang memuatnya, menelusuri activity actor atau
target secara exact, dan melihat history dari user/project. Event tetap dapat dibaca setelah record asal hilang.
History user berarti aksi **pada user tersebut**, bukan aksi **oleh user tersebut**. Copy link tidak membagikan
state internal dialog atau menjanjikan record/izin masih tersedia bagi penerima.

Scope hanya Activity log. Sign-in log tidak memperoleh GET-by-ID/deep link baru secara otomatis. Tidak menambah
request context/IP/UA, inbox/lifecycle invitation, actor picker/manual target form, route target yang diperkirakan,
dependency, atau pola Apply global baru. Frontend host **hanya3000**, API4000 existing tetap; preview345x lama adalah
evidence historis dan tidak direstart. Verifikasi memakai tooling Docker internal tanpa published ports/fixture DB
terpisah sesuai koordinasi Product Lead/Developer/QA; tidak mereset DB dev, meminjam sesi atau menebak akun dev.

### Tiga jenis state URL

| State | Aturan |
| --- | --- |
| `entry=<uuid>` | Identitas detail transient. GET-by-ID independen dari list page/range/filter; bukan predicate list/count/CSV, bukan filter badge, bukan remembered atau named saved view |
| `actorId` | Exact recorded actor UUID. Satu logical filter; tetap tersimpan pada views/preferences menurut aturan existing |
| `targetType` + `targetId` | Satu logical filter berpasangan, exact/opaque; dipasang/dihapus atomik, count1, persisten pada views/preferences |

Actor UUID-shape mengikuti kontrak. Target nonempty, type≤64 dan ID≤512 sesuai kontrak, tanpa trim/casefold atau
truncation. Scalar repeats memakai nilai pertama sesuai keputusan Product Lead. Deteksi entry memakai **presence**:
`?entry=` atau malformed first value tetap membuka state404, tidak diam-diam dianggap tanpa dialog. Entry malformed
tidak diselamatkan oleh nilai kedua yang valid. UUID canonicalization harus mempertahankan identitas yang sama;
target opaque tidak ikut dinormalisasi. Entry dihapus sebagai **query key**, bukan substring di nilai filter.

GET detail tidak dibatasi predicate list. Entry di luar90hari/page aktif atau saat background list kosong/error
tetap dibaca berdasarkan ID. List/query-key/export tidak menerima `entry`; detail memakai key audit-owned sendiri.
Loading/error list tidak mengubah identitas detail, dan kegagalan target availability tidak menggantikan detail.
Malformed exact filters mengikuti validation/error contract, tidak dibuang/di-trim/di-slice sehingga hasil menjadi
lebih luas tanpa penjelasan. Background list invalid menampilkan error/filter-clear path; entry valid tetap independen.

### Open, Close, Back dan fokus

| Peristiwa | Perilaku |
| --- | --- |
| Row **View entry** | Selesaikan pending search menurut commit/blur existing, lalu PUSH current committed URL+entry. Pertahankan range/filter/sort/page/pageSize/refresh. Jangan ada late search update yang membuang entry |
| Browser Back / Forward | URL menjadi sumber kebenaran: Back dapat menutup detail, Forward membuka lagi. Jangan membuat second local selected-row state yang menentang URL |
| Close/X/Escape/scrim, setelah list-open PUSH yang terbukti milik sesi ini | Back hanya bila provenance origin+current entry URL masih cocok dan mengembalikan list yang diketahui; bukan menebak dari history.length |
| Direct entry, reload, atau navigasi dari user/project | Close memakai REPLACE untuk membuang hanya entry, tetap pada Activity list dengan query lain. Jangan arbitrary Back ke situs/halaman sebelumnya. Browser Back biasa masih boleh kembali ke source user/project |
| Entry A→B | Tampilkan loading B, tidak mem-flash payload/title/actor A; response lambat A tidak menggantikan B |
| Range/filter/page berubah sementara entry tetap di URL | Entry tetap terbuka dengan ID sama; jangan menutup karena row keluar list. Dialog modal membuat background inert; perubahan via history/URL tetap deterministik |
| Navigasi ke route lain | Dialog Activity dilepas mengikuti route; tidak mengikutkan entry ke link record atau halaman lain |

Fokus sekali ke panel dialog pada mount, termasuk loading/direct/error, bukan otomatis ke Copy link. Ready/refetch
tidak merebut fokus lagi. Close kembali ke actual row trigger bila masih terhubung, visible dan enabled; jika tidak
ada/tersembunyi/row hilang atau direct link, fokus **Activity log h1** secara programatik (`tabIndex=-1`, bukan extra
Tab stop), bukan BODY. Retry mempertahankan fokus logis; bila tombol Retry hilang sesudah sukses, panel menjadi
fallback. Fokus bukan alasan menggulir ke page row yang sudah tidak ada. Close/scrim tidak meminta konfirmasi karena
detail read-only. Query response/history terbaru selalu menang; tidak ada delayed close/open setelah route berganti.

Klarifikasi pre-chunk nonmodal: ketika URL **sudah memiliki entry**, memilih row B mengganti entry A dengan
**REPLACE**, bukan PUSH di atas A. Provenance Back-to-known-list hanya boleh ditransfer dari A ke B bila exact
current URL/marker A masih membuktikan owned list-open; trigger fokus diperbarui ke B. Jika tidak, provenance dibuang
dan Close B hanya REPLACE-remove entry. Alur owned list C→A→replace B: Close/Back kembali C, Forward membuka B,
bukan A. Direct A→replace B: Close tetap Activity list, bukan back ke origin tak dikenal. Same-ID open no-op.
Ini menutup kasus row lain masih clickable selama opening Notice; module/data/copy callback A yang lambat tidak
menghidupkan A atau mengambil fokus sesudah B/Cancel/route leave.

### Komposisi dan responsive

Header title/summary/Close tetap keluarga EntryDialog. Dalam body: utility **Copy link**, metadata event, kelompok
**Investigate**, kemudian Changes sesuai Batch A. Group investigation menampung actor/target actions dan Open record
yang memenuhi syarat; helper **Other filters and the time range stay in place.** menjelaskan aksi filter. Tidak
menjejalkan seluruh action ke satu header phone. Buttons membungkus, target sentuh≥44, labels eksplisit, body scroll
mempertahankan header/Close terjangkau. Metadata/change values phone tetap stacked; desktop/tablet boleh sejajar.
360/390 tidak horizontal page scroll; ID/opaque values panjang membungkus aman. Loading memakai skeleton/placeholder
existing dengan width dialog stabil, bukan entry lama atau height viewport hardcoded baru. Tidak ada overlay bertumpuk
baru, font kecil untuk memaksakan kolom, ikon baru, warna status tambahan atau animasi entry terpisah.

### State dan copy final

| State | Copy/perilaku |
| --- | --- |
| Loading entry | **Loading activity entry…**; Close selalu tersedia, status loading diumumkan secukupnya; tanpa field event lama |
| Ready200 | Action title/recorded summary dan semantic changes Batch A; Copy link/investigation sesuai syarat |
| Invalid/missing/purged404 | **Activity entry not found**. **This entry isn't available. Check the link or return to the activity log.** Close; tidak membedakan purged/missing atau menampilkan cached fields |
| Forbidden403 | **Access denied**. **You don't have permission to view activity entries.** Hapus field/action detail yang tertahan; Close. Jangan menyatakan record dihapus |
| Network/500 tanpa prior success | **Couldn't load this activity entry**; error text aman existing, **Retry** dan Close. Retry ID yang masih aktif saja |
| Same ID prior200, network/500 refetch | Data sebelumnya boleh tetap dengan Notice **Couldn't refresh this activity entry; showing the last loaded details.** Retry. Ini tidak berlaku untuk403/404 atau pergantian ID |
| Session401 | Perilaku session/reauth existing; tidak membuat flow sign-in kedua di dialog |

Copy link hanya tersedia setelah ready200. Nilai yang disalin adalah canonical same-origin
`/audit/activity?entry=<uuid>` sebagai absolute URL; tidak menyertakan page/range/filters/refresh dari pengirim.
Address bar tetap mempertahankan list context pengirim. Label **Copy link**; sukses **Link copied.**, polite feedback
tanpa memindahkan fokus. Gunakan clipboard helper/fallback existing; kegagalan seluruh metode memberi
**Couldn't copy the link. Select and copy it below.** dan URL read-only/selectable yang membungkus/scroll internal.
Fokus tetap pada Copy, field tersedia berikutnya melalui Tab; tidak memaksa keyboard phone atau menampilkan false
Copied. Tidak membuat tooltip-only action atau toast+live-region ganda. Tidak mengekspos URL token/auth/session.

### Exact actions, chips dan Clear

**Final keputusan Product Lead menggantikan saran awal clear-user:** semua filter lain termasuk free-user text tetap
dipertahankan (AND), tidak ada silent clear agar hasil terlihat lebih banyak. Filter actor/target baru mengubah
hanya field yang dimaksud, page→1, serta membuang entry dalam **satu PUSH**; sort/pageSize/range/action dan filter
lain tetap. Pending debounce dibatalkan ke committed URL terbaru sebelum explicit action supaya tidak hidup kembali.

| Action | Syarat dan efek |
| --- | --- |
| **View actor activity** | actorId recorded valid UUID; set actorId saja, keep remaining filters/range AND, close entry/page1 |
| Actor ID tidak tersedia/invalid | Blocked reason **An exact actor ID wasn't recorded for this entry.** Tidak mengganti ID dengan nama atau unknown actor gabungan |
| **View target activity** | Exact type+ID nonempty/bounded64/512; set pasangan atomik, keep remaining filters/range AND, close entry/page1 |
| Target ID terlalu panjang | **This recorded target ID is too long to use as an exact filter.** Record tetap terbaca; tidak memotong string supaya API menerima |
| Target type/pair invalid | **An exact target isn't available for this entry.** Tidak membuat partial pair/query invalid |

Actor chip berlabel **Actor ID: {uuid}**; target satu grouped chip **Target: {type} · {id}**. Nama snapshot boleh
menambah konteks, tidak menggantikan ID/menjadi predicate atau diambil dari user terkini. Unknown type tetap raw
safe text. Collection membungkus di phone; full identity tetap dapat dibaca tanpa bergantung hover. X Actor hanya
menghapus actorId; X Target menghapus kedua field sekaligus. Setiap logical filter berkontribusi satu pada badge,
di samping hitungan search/action existing; entry tidak dihitung. Clear all mengikuti filter defaults existing dan
**mempertahankan time range**; tidak menyisakan separuh target. Exact filters tersimpan pada named/remembered views,
entry tidak. Zero results karena AND dengan filters lain adalah hasil sah; tampilkan empty state/filter chips jujur.
Tidak ada manual actor UUID/type/targetID input, lookup API, local pair draft atau Apply baru dalam MVP.

Developer feasibility diterima: internal JSON-encoded virtual field boleh memakai FilterLayout existing untuk satu
target chip/count tanpa shared variant baru. URL/API/saved preferences tetap hanya real actorId/targetType/targetId;
virtual field tidak menjadi kontrak persisten. Label recovery malformed URL membedakan presence: actorId kosong
**Actor ID: Empty value**, actorId absent tidak membuat chip; target field absent **Missing type/Missing ID**,
field hadir tetapi kosong **Empty type/Empty ID**. Literal opaque dengan whitespace/control yang ambigu memakai
JSON-quoted representation aman, bukan trim atau penggabungan visual. Existing400+chip-clear tetap recoverable,
target clear atomik dan entry valid tetap independen. Ini penerimaan pendekatan source, bukan runtime approval.

### History dari user/project

Semua entrance history dan user recent-entry links **audit.view gated**. Tanpa izin, jangan tampilkan link atau
meminta data audit. User yang boleh membaca record tetapi tidak audit tidak memperoleh recent activity baru dari UI.

| Entrance | URL/perilaku |
| --- | --- |
| User Recent activity | Tetap latest20, count/empty existing. Tambah explicit row Link **View entry**, action/time/actor tetap; URL Activity `range=90d&targetType=user&targetId=<userId>&entry=<eventId>` |
| User **View history** | Header/trailing action panel Recent activity; visible support **Activity · Last 90 days**. URL sama tanpa entry. Masih tersedia saat recent20 kosong |
| Project **View history** | Secondary action di detail di samping existing Edit, membungkus pada phone; visible support **Activity · Last 90 days**; `range=90d&targetType=project&targetId=<projectId>` |

History navigation adalah scope90d yang eksplisit: tidak merge remembered audit actor/free-user/action filters atau
range dari halaman lain. Ini berbeda dari entry context actions yang mempertahankan filters. Jangan menyebut all
history/all retention atau meluaskan rentang diam-diam. Recent20 dapat memiliki entry di luar90d; detail entry tetap
terbaca walau background90d list kosong. User history wajib type=user **dan** ID agar collision target lintas tipe
tidak bercampur. Same ID project bukan history user. URL asli record tidak membawa `entry`; browser Back dari audit
dapat kembali ke detail source. Komposisi tidak mengubah permission/rank/guard CRUD atau mengimpor sibling feature.

### Open record — availability terpisah dari evidence

Hanya target type **user/project**, UUID sah, permission **user.view/project.view**, dan existing record read200
boleh menyediakan **Open user/Open project** ke internal `/users/<id>` atau `/projects/<id>`. Tidak ada mapping role,
profile, permission, unknown type atau compound IDs. Tidak melakukan availability read jika izin/shape tidak memenuhi
syarat. Data current record hanya membuktikan availability, bukan mengganti nama/field snapshot atau membuktikan
record tidak pernah berubah. Link same-window; Back dapat kembali ke URL entry.

| Availability | Tampilan di group Investigate |
| --- | --- |
| Checking | Stable action space/indikasi checking ringan existing, tidak menahan rendering event |
|200 | Open user / Open project |
|404 | Record unavailable. |
|403 | Record access unavailable. |
| Network/500 | Couldn't check record availability. + **Retry check** |

Tidak pernah menghapus detail audit yang sah karena lookup target gagal/deleted/forbidden/offline. Retry check
tidak me-refetch entry yang berbeda; response target A tidak membuka link pada entry B. Permission revocation atau
availability403/404 menonaktifkan link sebelumnya, bukan menyajikan cached200 sebagai hasil terkini. Server target
tetap mengotorisasi tiap request; link bukan jaminan akses permanen. Unsupported/unauthorized target tetap teks
recorded tanpa invented route; exact target investigation tetap boleh bila bounded dan audit.view tersedia.

### Acceptance dan handoff

| Area | Acceptance kandidat |
| --- | --- |
| Detail URL | Direct/reload/Back/Forward/Close/scrim/entry switch, malformed/empty/duplicates; independen list/range/paging/error; entry tidak masuk filters/export/views/prefs |
| Focus/race | Mount focus panel; no A flash/late overwrite; Retry/Close fallback h1/actual trigger;403/404 clear data; async lookup/copy tidak mencuri fokus atau hidup sesudah route berubah |
| Investigation | Actor exact+target pair exact AND text/action/range; chip IDs/counter1/1/clearatomic/Clearallrange; opaque values literal/no truncation; CSV/list/count predicate sama |
| History | Recent20 links dan View history90d user/project; audit.view gate; type+ID collision; older-than-range entry; source Back dan Close policy berbeda jelas |
| Target availability | user/project UUID+permission+read200 saja;404/403/network tidak mengubah evidence; unknown/compound/over512 readable tanpa invalid action |
| Responsive/state |360/390/834/1440 light/dark, pointer/keyboard, reduced motion, long IDs/JSON, loading/empty/error/stale/success/copy-fail; no overflow, Close terjangkau, existing rail/firstpaint tetap |

Kontrak validation/saved-view sanitation detail milik Product Lead/Developer, oracle QA tetap membedakan presence/
empty/null/legacy dari Batch A. Developer diminta mengangkat feasibility gap sebelum mengunci UI; tidak menambah
API/lookup/form atau mengendurkan budget secara diam-diam. **Desain siap handoff; implementasi belum disetujui.**
Review final akan mengikat source/build/artifact kandidat baru; evidence Batch A atau known-red CI tidak dijadikan
pass fitur ini. Tidak ada browser run/DB mutation/source product edit atau klaim frame Figma baru oleh Designer.

### Klarifikasi pre-chunk loading — feedback sebelum modul detail tersedia

Review source menemukan dynamic ActivityEntryDialog belum menyediakan fallback sebelum chunk termuat; skeleton
Loading entry baru ada sesudah modul tersedia. **Null fallback tidak memenuhi feedback tindakan.** Designer
menetapkan dua tahap, diterima Product Lead, agar tidak memindahkan DiffView/semantic formatter atau dependensi
dialog berat ke first load:

| Tahap | UX minimal |
| --- | --- |
| Chunk belum tersedia | Lightweight in-page Notice **Opening activity entry…** + visible **Cancel**, dalam Activity content sesudah PageHeader. Ini status nonmodal, bukan fake dialog; no trap/inert/autofocus. Direct link juga mendapat feedback |
| Row-origin pending | Trigger terpilih yang masih rendered menampilkan **Opening…** dan aria-busy; feedback tetap terlihat saat notice di atas fold. Tidak membuat push/open kedua |
| Chunk siap, API loading/ready/error | Notice dilepas, existing dialog/sheet mengambil alih dan fokus panel sekali. State/copy API loading/error di atas tetap berlaku |
| Chunk gagal | **Couldn't open this activity entry.** + **Reload page** pada URL yang sama + Cancel; **Retry opening** boleh bila loader memiliki retry aman. Tidak ada pending tanpa recovery |

Anchor DEC-018 tetap: opening/failure Notice menjadi **first visible child di dalam owning FilterSurface** sesudah
PageHeader, bukan sibling di luar surface. Rail sejajar outer top Notice tanpa gap tambahan; saat Notice hilang,
first remaining visible Notice/card menjadi anchor. Constant clearance64 tetap, tanpa double padding atau offset
global TopBar. Ini penerapan pola existing, bukan geometry baru; QA membandingkan actual bbox pending/ready/cancel/resize.

Cancel dan Escape pending memakai close/provenance policy yang sama. Escape tidak mengambil alih overlay lain
yang telah menangani event/defaultPrevented. Pending nonmodal tidak menambahkan focus trap atau role modal palsu.
Actual cancel mengembalikan fokus trigger/h1 setelah URL entry dibuang. **Handoff sukses notice→dialog tidak
menjalankan close/returnFocus**, agar tidak melompat ke h1 lalu dialog. Module resolve yang terlambat sesudah Cancel,
entry switch atau route leave tidak membuka entry lama atau mengambil fokus. Source callback/boundary tetap milik
Developer; chunk cache boleh terisi tanpa menampilkan entry yang sudah dibatalkan.

Loading feedback muncul sebagai state nyata, tanpa timeout/delay/hide untuk menutupi cold load. Hover/focus preload
boleh membantu tetapi tidak menggantikan fallback. Tidak mengimpor EntryDialog yang masih membawa DiffView hanya
untuk fallback; exact-byte budget tetap. QA memverifikasi held chunk, row/direct URL, cancel/Escape/late resolve,
failure recovery dan focus saat actual modal hadir. Ini klarifikasi handoff/source, bukan defect runtime terverifikasi
atau approval kandidat. Tidak ada Figma atau source produk diubah Designer.

### Review kandidat awal NEXT-DES-003 — koreksi identity display pending

Paket `developer-audit-2/{candidate.json,handoff.txt}` dibaca. Kandidat runtime
`754e741a7b57976e805e5d05aba885ee45e73e87078a7fde1cdd5124105a0080`, product
`775acb7adcaa576bec0807b86c307972a5aa30bb21fa093e245599f319db0bed`, build
`iyOjDEw-xlEJIvzpGFBpX`. SHA candidate metadata
`632a4e0c1dfca8d317ffafe3e54106ed020b2c85387a48ba53661bb0f68f2f7e`.
Designer mencocokkan710 source leaf hashes dengan host serta15 screenshot hashes tanpa mismatch, lalu melihat
**seluruh15 PNG yang tercantum**:8ready detail360/390/834/1440 light/dark,4wrapped-filter views dan3chunk
pending-row/pending-direct/failure. Ini verifikasi source/image artifacts, bukan pengujian browser atau compiled
image ulang oleh Designer. QA/Product Lead memverifikasi binding compiled build secara terpisah.

Pending/failure Notice sejajar rail di first surface, row Opening/Cancel dan failure Reload page jelas. Grouped chip
membungkus pada phone/tablet, count1 dan empty state tetap terbaca. Ready Copy link/metadata/summary/Close terbaca
dan body long ID scrolls. Sebagian controls berada di bawah scroll phone; screenshot awal tidak otomatis membuktikan
scrolled Investigate/Open record, history entrances atau clipboard fallback. Capture tambahan diminta ke QA saat
retest internal pada kandidat yang sama, tanpa host preview atau rerun baseline.

| Lokasi | Observed / expected / impact |
| --- | --- |
| Target metadata pada ActivityEntryDialog; contoh ready360/1440 light/dark, konsisten pada viewport lain | ID opaque masih raw inline dengan normal HTML whitespace, sehingga edge spaces/newline tampak collapse; chip exact sudah JSON-quoted dengan benar. Expected: quote/escape ambiguous recorded target type/ID dalam presentation detail, ordinary UUID tetap sederhana, tanpa mengubah recorded bytes/DTO. Dampak: identitas yang berbeda dapat terlihat sama, bukan permintaan taste/redesign |

Developer mengonfirmasi temuan source/PNG; Product Lead menerima **AUD2-DES-001 / P1**, koreksi sebelum visual
acceptance. Scope terbatas presentation lazy detail: ambiguous opaque type/ID JSON-quoted seperti chip, ordinary
UUID unchanged, tanpa perubahan DTO/predicate/CSV semantics. QA menyelesaikan run/capture kandidat frozen sebelum
slot dikembalikan; Developer tidak me-rebuild workbench aktif. Sesudah patch diperlukan source/build freeze baru,
budget ulang (lazy chunk hash tetap dapat memengaruhi margin3byte), affected retest dan PNG bound baru.
**Belum ada scoped visual approval final.** Bukti kandidat lama/finding dipertahankan, bukan ditimpa.
Ledger bukti/finding15PNG: `.superpowers/scratch/designer/audit-2/initial-candidate-review.json`.
Developer melaporkan18browser dan fullcheck1617 pass; hasil itu bukan eksekusi Designer atau verdict QA final.
Headroom Activity3byte/Users35byte dicatat pada paket, bukan alasan merelaksasi gate atau memperluas refactor.

Rereview source patch AUD2-DES-001: formatter local `recordedIdentity` berada di lazy ActivityEntryDialog dan
dipakai terpisah untuk target type/ID, mengikuti quoting chip untuk edge whitespace/control/separator. React tetap
melakukan HTML escaping; ordinary type/UUID mempertahankan display semula. Dua assertions metadata dibaca untuk
quoting, full513 ID, escaping/immutability dan unquoted ordinary UUID; Developer melaporkan red→green/typecheck/lint,
bukan run Designer. **Arah source patch diterima; temuan belum ditutup secara runtime.** Menunggu slot QA selesai,
freeze/build/budget baru dan screenshot bound koreksi; PNG kandidat lama tidak digunakan mengklaim patch verified.

### Rereview visual R2 — AUD2-DES-001 correction terlihat

R2 `developer-audit-2/{candidate-r2.json,handoff-r2.txt}` memakai runtime
`4f29f9d4455c36eff8b7f6fda499cbbc53362f10d3ccacde9cf8ad031afc966e`, product
`71796c39790608b06ed2d8e9f49d2a8cc89e220e6e73172e39ac61dd31d96ec8`, build
`vw_fJi0Zpw9N0jU-Y-2sr`; compiled digest dilaporkan
`6a4360af5a6a278960f9de89b37c5c2b8a54fe242d726bd398fcd12c4e149742`.
SHA metadata`d11256b2490292b8664fd0d50fba9f22abfeacc3e29e449b495d80a26f5d589a`.
Designer memvalidasi711 host source leaf hashes dan15 PNG hashes, tanpa mismatch. Sebelas PNG baru benar-benar
dilihat (8ready width/theme dan3pending/failure); empat filter PNG identik SHA dengan yang sudah dilihat pada R1,
sehingga bukti visual unchanged tersebut direuse dengan identitas file terverifikasi.

**AUD2-DES-001 koreksi terverifikasi secara visual pada R2:** batas quote dan escape whitespace/control terlihat
di Target metadata pada360/390/834/1440 light/dark, tanpa merusak hierarchy/wrapping. Enam supplemental PNG QA dari
`qa-audit-2/candidate-r2-probes-artifacts/` juga dilihat: opaque identity, project history phone, Investigate+Open
project, clipboard fallback, changes dan audit-only viewer. Ordinary UUID tetap unquoted, helper90d dan fallback
URL/copy-failure terbaca; audit-only viewer tidak mendapat Open record. Tidak ada koreksi desain tambahan dari
area yang jelas terlihat.

Penerimaan visual keseluruhan masih menunggu satu capture User Recent activity/history serta klarifikasi QA
apakah phone Changes screenshot berada pada settled scroll atau transisi (header/Close tidak jelas pada capture
itu). Ini permintaan verifikasi evidence, **belum temuan produk baru**. QA memverifikasi perilaku/posthash dan
menentukan closure temuan; correction tidak diluluskan dari source-only. Developer18/fullcheck1619/budget22 adalah
hasil Developer, bukan eksekusi Designer. Binding compiled image dibaca Product Lead secara terpisah.
Ledger: `.superpowers/scratch/designer/audit-2/r2-visual-review.json`; tidak ada browser host/Figma/source edit.

### Hasil final visual R2 — NEXT-DES-003 / NEXT-AUD-002 diterima

**Scoped visual acceptance diberikan pada kandidat R2 di atas. AUD2-DES-001 resolved untuk review Designer.**
Ini menggantikan status visual pending pada catatan sebelumnya, tanpa meluluskan scope lain atau remote CI.
Handoff dapat diimplementasikan tanpa keputusan UX besar yang masih terbuka; implementasi kandidat ini sudah
terlihat pada artifact aktual. Formal closure temuan/test tetap milik QA, keputusan GO lokal tetap Product Lead.

Empat capture final di `qa-audit-2/candidate-r2-settled-artifacts/` dilihat penuh: User Recent activity/history,
settled known-user entry, dan phone dialog sebelum/sesudah body scroll. History entrance menampilkan konteks
**Activity · Last 90 days**, **View history**, last20 dan **View entry** termasuk entry2020. Detail settled tetap
menampilkan entry tersebut di luar range background90d, recorded identity terbaca dan **Open user** tersedia.
Project history/Open project, audit-only viewer, copy-failure recovery, wrapped exact chips, pending/failure rail
serta opaque Target correction sudah ditinjau pada bukti R2 sebelumnya; tidak ada koreksi visual tambahan.

Facts final viewport390×844 menunjukkan inner body scrollTop **0→331**, sementara header tetap y116–192 dan
Close32×32 tetap x338/y136, seluruhnya di viewport. Before/after PNG memperlihatkan Initial values dapat dicapai
sementara Close tetap terlihat. QA melaporkan focused check2pass, termasuk focus/click Close→Activity h1.
Capture lama dengan scrollTop0 tidak dipakai sebagai bukti scrolling; capture known-user saat route transition
juga tidak dipakai untuk acceptance layout settled. Tidak ada defect baru dari ambiguitas capture tersebut.

Ledger `.superpowers/scratch/designer/audit-2/r2-visual-review.json` mengikat SHA empat capture final dan facts,
711 source leaves serta15 candidate PNG yang sudah diverifikasi. Sebelas candidate PNG baru dilihat; empat filter
PNG reuse sah karena SHA identik dengan R1 yang sudah dilihat. Enam supplemental QA PNG ditinjau, dengan final
settled captures menggantikan ambiguitas transisi/scroll. Product Lead/QA memverifikasi compiled image dan QA
melaporkan source/build/API posthash unchanged; Designer tidak mengklaim menjalankan browser/test atau memverifikasi
compiled image sendiri. Hasil Developer: fullcheck1619, browser18, budget22; hasil QA independen dicatat oleh QA.

Batas: evidence runtime Linux Docker Chromium/emulasi, bukan real device/WebKit/screen-reader manual atau remote
CI penuh. Known-red CI sebelumnya tetap tercatat. Headroom Activity3byte/Users35byte tetap risiko perubahan berikutnya;
gate256000byte tidak dilonggarkan. Tidak ada product-source edit, host runtime/DB mutation, port baru atau Figma edit
oleh Designer. **Figma v1.0.4 tetap In review**; review ini tidak mengklaim frame baru, publish atau native checkpoint.

QA final telah dicatat di [docs/qa.md](qa.md): **NEXT-QA-004 Done**, **AUD2-DES-001 Closed / QA verified R2**,
rekomendasi GO lokal scope NEXT-AUD-002 dikirim ke Product Lead. QA mengikat completion/evidence pada
`.superpowers/scratch/qa-audit-2/r2/completion.json`; source/build tetap frozen. Tidak ada koreksi visual atau
product failure terbuka yang dilaporkan dalam scope R2 ini. Keputusan penggunaan lokal belum disimpulkan dari
rekomendasi QA; keputusan Product Lead dan status remote CI tetap terpisah.
