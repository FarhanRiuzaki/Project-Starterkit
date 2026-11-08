# Arsitektur minimum SunnyGo

Sesi 1, 8 November 2026. Audit source baseline `2ba4b9f`; target pertama adalah template lokal. Pertahankan implementasi modular monolith yang ada. Tidak ada kebutuhan MVP untuk layanan, database, cache atau broker baru. Detail aturan tetap di [AGENTS](../AGENTS.md), [API](api/README.md) dan standar UI.

## Batas sistem

Browser → Next.js BFF `/api/*` → API privat `/v1/*` → PostgreSQL.

| Batas | Tanggung jawab dan kontrak implementasi |
| --- | --- |
| `apps/web` | Next 16 App Router pada Node 24. Browser hanya same-origin `/api/*`; catch-all meneruskan data, route auth mengatur cookie sendiri. Page tipis memakai permission guard, title dan prefetch; screen/hook milik feature. Client tidak mengimpor server/database. |
| `apps/api` | Bun/Elysia, controller → service → Drizzle. API memutuskan otorisasi dan aturan bisnis; registry memasang health/auth/oauth/me/rbac/users/audit/dashboard/projects. Akses antar modul hanya melalui index, kecuali FK schema sesuai aturan repo. Kernel tidak mengimpor modul. |
| `packages/shared` | DTO/query/body zod, permission catalog, paging, activity vocabulary, redaksi dan brand. Kontrak adalah source of truth, JSON Schema/docs adalah hasil yang diperiksa terhadapnya. Client mengimpor contract sebagai type dan konstanta ringan dari file bebas zod. |
| `packages/ui` | Tokens → primitives/motion → DS → charts; tidak mengimpor domain aplikasi. API hanya memakai helper murni `lib/*`. Perubahan UI bersama diperlihatkan di `/ds`. |
| PostgreSQL 18 | Seluruh persistent/shared state: data, session, limiter/backoff dan OAuth state. Transaksi + row/advisory lock untuk invariant konkuren; tidak ada event bus. |

State shareable list/range/tab/page berada di URL; query keys hanya dibangun di `apps/web/src/lib/shared/queries.ts`, prefix sesuai pemilik data. Prefetch dan browser memakai key/URL yang sama. Feature web tidak mengimpor feature lain.

## Model data dan ownership

| Modul pemilik | Tabel utama | Relasi / invariant penting |
| --- | --- | --- |
| users | users, recovery_codes | Username/email unik tanpa membedakan case; credential/TOTP milik users, recovery terkait user dan single use. Tidak ada tenant. |
| rbac | roles, permissions, role_permissions, user_roles | User↔role dan role↔permission many-to-many; Superadmin terkunci, active Superadmin terakhir dilindungi; actor rank dan escalation diperiksa dalam transaksi. |
| auth | sessions, auth_challenges, user_tokens, rate_limits, login_backoff | Session/challenge/link terkait user. Hanya hash token disimpan; absolute/idle expiry; reset/invite single use. Limiter atomik dan shared; tabel limiter UNLOGGED, reset setelah crash adalah perilaku sengaja. |
| oauth | user_identities, oauth_states | Provider+subject unik; satu identity per user/provider; state hashed dan single use dengan binding browser. Linking membutuhkan session live dan recent proof; tidak membuat user/mencocokkan email otomatis. |
| me | saved_views | FK user; unik per user/path/nama tanpa membedakan case. Hanya pemilik yang membaca/menghapus; batas jumlah mengikuti kontrak yang ada. |
| audit | activity, auth_log | Append-only terhadap update; activity perubahan atomik dengan transaksi data. Retention purge oleh janitor, bukan janji penyimpanan selamanya. |
| projects | projects | UUIDv7; name unik melalui lower(name), description nullable, status active/archived, createdAt/updatedAt. Tidak memiliki owner/tenant atau membership. Akses berdasarkan permission organisasi tunggal. |
| health, dashboard | Tidak memiliki tabel domain baru | Health/readiness dan agregasi melalui API modul yang diperbolehkan. |

Schema ada di `apps/api/src/modules/*/schema.ts`; migrasi 0000–0005 tersedia, termasuk indeks pencarian projects. Diagram relasi rinci tidak diperlukan untuk menambah layanan baru karena tidak ada layanan baru yang direncanakan.

## Kontrak konkret contoh projects

Sumber: `packages/shared/src/contracts/projects.ts`, `projects.ts`, `paging.ts`, controller/service/rules projects dan [endpoint table](api/README.md#endpoints). Ini mendokumentasikan perilaku yang sudah ada, bukan API baru.

| Method dan browser path | Permission | Input | Output / kegagalan bisnis |
| --- | --- | --- | --- |
| GET `/api/projects` | project.view | page, pageSize, q, sort=name/-name/createdAt/-createdAt, status=active/archived opsional | 200 `{items,total,page,pageSize,totalCapped?}`; q mencari name secara literal, sort default name. |
| POST `/api/projects` | project.create | name wajib setelah trim (1–100), description opsional max 500/default kosong, status default active | 201 ProjectDto; duplicate 409 bila nama sama tanpa membedakan case. Description kosong disimpan null. |
| GET `/api/projects/{id}` | project.view | UUID | 200 ProjectDto; ID tak valid atau tidak ditemukan → 404. |
| PATCH `/api/projects/{id}` | project.edit | Subset name/description/status; field tidak dikenal ditolak | 200 ProjectDto; no-op tidak menulis activity; duplicate 409, tidak ditemukan 404. |
| DELETE `/api/projects/{id}` | project.delete | UUID; konfirmasi dampak di UI | 200 `{ok:true}`; hard delete dengan snapshot activity, bukan soft delete/Undo; berikutnya 404. |

ProjectDto: `{id,name,description,status,createdAt,updatedAt}`, timestamp serialisasi ISO. Create/update/delete dan activity memakai transaksi yang sama. Update/delete mengambil row lock; unique index menjaga dua create nama yang sama agar tepat satu berhasil. Tidak perlu endpoint `/status` atau kontrak bulk baru untuk contoh ini.

List umum: page 1–1000, pageSize 15/25/50/100 (default 15), whitelist sort, tie-break id; capped count 100.000 dengan `totalCapped`, CSV maksimum 10.000 baris. UI menampilkan total capped sebagai N+, perubahan selain page kembali ke page 1, Back memulihkan state. Project filter saat ini **scalar**, bukan array/multiselect.

## Keamanan, validasi dan kegagalan

- BFF menyimpan sealed HttpOnly/SameSite Strict cookie berisi token+csrf atau challenge sementara. Profil/permission datang dari API per request. API hanya menerima internal token yang benar, selain health GET raw path yang tepat; API tidak dibuka ke browser.
- Mutasi penuh melalui catch-all memerlukan CSRF constant-time; auth POST memerlukan same-origin, logout juga CSRF. Header request/response menggunakan allow-list. Body maksimal 64 KB di kedua lapis.
- Route biasa: query 400 → guard 401/403 → body 400 → UUID/existence 404 → rules → perubahan + activity dalam transaksi → DTO. Auth/OAuth mempunyai pengecualian terdokumentasi; jangan memaksakan urutan route CRUD pada sign-in.
- Error publik `{error:{code,message}}`; gunakan code/status yang sudah ada. Exception tak dikenal memberi fixed 500 internal; detail hanya ke log yang diredaksi. 429 mengirim Retry-After. Jawaban privat no-store.
- Permission/deactivation berlaku pada request berikutnya. Aturan yang bergantung row berubah harus dibaca sesudah lock dalam transaksi. Reset/recovery/state hanya sekali pakai; password argon2id, TOTP encrypted AES-256-GCM berprefix versi.
- BFF timeout 10 detik, retry GET sekali untuk connection error, tanpa retry otomatis mutation. Salah/tidak ada permission tidak boleh membaca/mengubah data. CSV menetralkan formula; query parameter terikat dan sort whitelist.
- CSP nonce, redaksi log, redirect internal, batas rate dan konfigurasi TLS mengikuti source/AGENTS. Perubahan terkait wajib membawa kasus gagal yang berlaku, bukan sekadar happy path.

## Rail dan refresh aktif — DEC-019

Collapsed rail kini hug-content: tinggi mengikuti ikon/badge/label/padding, tidak mengikuti bottom viewport atau tinggi expanded panel. Pakai keluarga SidebarCollapseIcon/SidebarExpandIcon existing dengan arah right-panel yang benar; expanded panel dan anchor DEC-018 tetap. Designer menentukan ukuran/fallback kecil di FIL-DES-004, Developer implement FIL-COLLAPSE-001. Collapsed compact mode CSS pada viewport height≤399, normal hug≥400; jangan mengganti railheight berdasarkan pengukuran JS sesudah hydration. AvailableH<160 hanya untuk explicit-open controlledscroll/expanded anchor.

Refresh flicker adalah laporan pengguna yang perlu reproduksi FIL-REFRESH-001. Audit source menunjukkan launcher SSR/inline, initial top/room dan perpindahan portal/hydration sebagai hipotesis; jangan menganggapnya root cause tanpa frame/trace. Perbaikan harus menjaga first paint/SSR→hydration/ready stabil, tanpa wrong-position/full-height flash, blink/remount visual atau duplikasi launcher. Jangan memakai delay/fade/hiding untuk mengakali tes; preserve prefetch/query/theme/session dan motion user-triggered/reduced-motion. QA retest cold/warm/lightdark/URL berfilter plus toggle/resize pada kandidat yang sama, reuse no-flicker suite dan tambahkan pemeriksaan rail yang belum tercakup.

## Anchor filter aktif — DEC-018

Revisi pemilik: rail dan expanded filter dimulai **di bawah PageHeader, top sejajar komponen konten utama pertama** (Permissions: card/table). Tidak ada extra gap16 terhadap komponen. Header judul/deskripsi/aksi tetap bebas; rail/open memakai anchor yang sama. Ini mengganti oracle shell-header bottom+16/top72/top80 lama, tanpa mengubah auto-apply/multiselect/API DEC-017.

Shared FilterLayout/result wrapper menyediakan anchor; mekanisme ref/measurement milik Developer, geometry scroll/sticky/clamp/phone milik Designer (FIL-DES-003). Detail Designer: first visible surface termasuk Notice bila mendahului card/KPI; top rail/panel sama dengan bbox surface tanpa gap tambahan. Scroll bounds max(16, contentTop, visiblePageHeader.bottom); header hanya batas perlindungan. Konten belum masuk viewport berarti rail secara alami offscreen/clipped di owning surface (tanpa JS visibility/notTab atau aria-hidden semata karena offscreen); fokus keyboard boleh native-scroll surface ke layar, tanpa fallback hoist. Demo /ds mengikuti owning demo surface. Hindari hardcoded route offset dan token global navbar sebagai anchor. Saat reflow/notice/loading/resize/scroll, posisi dan fokus tetap aman. QA membandingkan bbox rail/open dengan actual component, serta pointer/keyboard PageHeader actions, pada kandidat baru melalui FIL-QA-004. DES-FIL-002A lama superseded sebagai expected, bukan dinyatakan fixed.

## Kontrak filter aktif — DEC-017

Instruksi pemilik terbaru mengganti rancangan modal + Apply + scalar menjadi **sidebar nonmodal dengan collapsed rail kanan, auto-apply dan multiple checkbox**. Kontrak rinci/limit/encoding ada di DEC-017; bagian review filter di bawah adalah riwayat arah lama yang superseded dan tidak lagi menjadi oracle implementasi baru.

| Endpoint / pemakai | Category multivalue | Predicate dan kompatibilitas |
| --- | --- | --- |
| `/api/users`, BulkUserFilter | role, status | OR membership role dengan EXISTS tanpa rows duplikat; OR status; AND dengan q/group lain. Scalar lama tetap singleton. Body assignRole.role tetap scalar. |
| `/api/projects` | status | IN active/archived, AND q; create/edit status domain tetap radio/scalar. |
| `/api/permissions` | module | OR prefix module valid, AND q; query-bound/whitelisted tanpa SQL identifier dari pengguna. |
| `/api/audit/activity` dan CSV | action | OR exact action, AND user dan range existing; list/count/export memakai predicate sama. |
| `/api/audit/auth` dan CSV | event, method | OR masing-masing enum, AND antar-group/user/range. |
| `/roles`, `/ds` | Search-only / contoh shared | Jangan menciptakan facet domain; gallery merepresentasikan shared sidebar/live controls. |

Boundary final: evolusi hook raw-URL context existing memakai queryValues dengan allow-list enam key kategori; getAll raw mempertahankan comma/Unicode, scalar lain tetap first value. Tidak ada plugin baru, plural JSON wire atau implicit JSON decoding. Search300ms history replace; checkbox+flush dan Clear satu push.

Wire canonical repeated key, contoh `/api/projects?status=active&status=archived&page=1&pageSize=15&sort=name`; string legacy diterima. Max 50 raw values per field sebelum dedupe; empty array/absent = Any, unknown enum/nonstring/overlimit = 400 sebelum guard. Role/action string valid yang tidak dikenal tetap no matches seperti sebelumnya. Server/client/prefetch/API request/saved views harus melestarikan seluruh nilai. Tidak menggunakan CSV delimiter untuk nama role.

Checkbox auto-commit terhadap state terbaru dan push history; search 300 ms replace (Enter/blur/collapse flush). Clear all membatalkan debounce, membersihkan search/category, page 1, mempertahankan sort/size/header time/refresh. Tidak ada Apply/reset-draft atau close otomatis setelah toggle. Back/view mengganti state dan membatalkan pending search. API/CSV/bulk wajib memfilter seluruh dataset, bukan subset page yang sedang terlihat; query key canonical mencegah respons lama mengubah hasil aktif.

Named saved-view cap server 4096 karakter; automatic remembered preference tetap 300 per halaman. Di atas 300, clear remembered page lama dan jelaskan fallback/named-view, tanpa truncate atau memperbesar cookie; di atas 4096 Save view gagal recoverable, filter URL tidak hilang. Role options paged dan pilihan lintas page tetap. Badge = jumlah checkbox terpilih + search nonempty; chip per opsi. Facet counts tidak dipalsukan/tidak dihitung dari satu page.

Designer menetapkan geometri/fokus/phone dan patch Figma terbaru di design.md. Tests FIL-QA-003/004 mencakup multiselect OR/AND, validation-before-guard, list/CSV/bulk equivalence, rapid toggle/debounce race, legacy views/URL roundtrip, rail default/clear, responsive/keyboard dan budget tepat-byte. Failing regression sebelum logic/contract change; regenerate api:schemas dan endpoint docs. Tidak ada migration/dependency baru yang direncanakan.

<a id="kontrak-ui-dan-review-filter"></a>

## Riwayat kontrak UI dan review filter — superseded DEC-017

Gunakan komponen/state/tokens yang sudah ada, satu DOM responsif melalui CSS; breakpoint md/xl, lima state per data region, feedback pending/result/error dan fokus keyboard. Designer memiliki detail UX/visual, Developer memiliki implementasi, QA memiliki verdict.

**Temuan review source 8 November:** `packages/ui/src/ds/filter-layout.tsx` sudah komponen bersama dan default `open=false`. Namun panel desktop adalah `sticky` di flex gutter (`w-80`, `gap-6`), sehingga hasil menyempit ketika terbuka. Trigger diserahkan melalui render prop lalu dipasang pada `Panel toolbar` oleh users/projects/roles/permissions/audit. Ini belum memenuhi arahan baru pemilik tentang floating kanan layar dan trigger di luar header tab/panel. Di bawah xl memakai deferred dialog/sheet. Review ini belum memeriksa browser live.

**Arah kebutuhan pemilik:** panel filter mandiri, collapsed secara default, floating di kanan layar, trigger di luar header tab. Contoh gambar menunjukkan kelompok yang dapat dibuka/tutup dan opsi yang mudah dipindai. Posisi trigger tepi kanan dan panel overlay adalah rekomendasi untuk divalidasi Designer; bukan desain final yang sudah diterapkan.

Kontrak minimum untuk FIL-DES-001 → FIL-DEV-001 → FIL-QA-002 (perencanaan QA paralel melalui FIL-QA-001):

1. Shell/komponen filter memegang open/close, layout, fokus dan draft/apply; tiap modul memasok field/label/nilai melalui kontrak yang sudah ada. Pilih evolusi `FilterLayout`/ekstraksi `FilterPanel`, bukan implementasi terpisah per feature. Nama API komponen final milik Developer setelah spesifikasi Designer.
2. Panel awal tertutup bahkan bila URL berisi filter. Badge/chip menunjukkan **applied** values ketika tertutup; open/collapse bersifat UI lokal, bukan menghapus filter. Jangan memperluas scope menjadi persistensi global antar halaman.
3. Pertahankan Apply atomik, reset draft, close menyimpan draft dalam halaman, Escape/close mengembalikan fokus dan URL/Back/saved views/page reset. Snapshot applied tidak boleh tertimpa respons Apply terlambat. Header date/refresh tetap memakai pola yang ada.
4. Desktop floating tidak boleh mengubah lebar hasil; Designer menentukan offset/layer dan perlindungan fokus/kontrol yang tertutup overlay. Trigger terlihat, berlabel, memiliki expanded state dan badge; tidak ditempatkan lagi di header tab/Panel toolbar. Perilaku tablet/phone, klik luar dan sticky footer diputuskan Designer; fallback sheet yang ada adalah titik awal, bukan panel sempit yang dipaksa ke phone.
5. Jangan mengubah semua field menjadi checkbox multiselect: kontrak role/status/module saat ini scalar. Screenshot bukan permintaan menambah field Outcome/Team/Model, jumlah facet, atau endpoint baru. Facet counts belum disediakan kontrak; hilangkan bila tak ada data, jangan hitung dari satu page atau memakai angka dummy. Multiselect/counts membutuhkan task dan kontrak tersendiri jika kemudian diminta.
6. Update standar/galeri dan tes lama yang mengunci lokasi toolbar/gutter setelah keputusan Designer; dokumentasikan perubahan produk. Arahan pemilik menggantikan lokasi trigger dalam standar lama untuk perubahan ini; tidak perlu meminta ulang izin perubahan lokasi. Jaga deferred overlay, keyboard, coarse hit target 44 px, token dan budget ≤250 kB.

## Fondasi operasional

Migrasi forward-only dengan checksum/advisory lock; jangan edit migrasi yang sudah diterapkan. Migrator/system seed sebagai schema owner, API produksi DML-only. Setup/bootstrap harus idempotent. Check/test hanya DB khusus `_test`, E2E hanya `_e2e`; jangan reset database pengguna.

Health/readiness, graceful shutdown, request-id/log redaction dan janitor tersedia. Backup/restore, monitoring eksternal, rotasi/recovery encryption key dan SMTP delivery belum dibuktikan sebagai operasi produksi. Mail dikirim setelah commit secara fire-and-forget: kegagalan tercatat, tanpa outbox/retry persisten; terima batas ini untuk template lokal, nilai ulang sebelum SLA delivery dijanjikan. Jangan menambah queue tanpa kebutuhan.

Provider mock/log cukup untuk demonstrasi lokal, tidak membuktikan provider nyata. Production menolak mock dan membutuhkan SMTP TLS; rencana staging/provider ada di OPS-001/002 dan INT-001. Pemilihan provider tidak diperlukan untuk memulai MVP lokal.

## Review berisiko tinggi dan skenario QA

| Perubahan / invariant | Review Product Lead sebagai Architect | Skenario yang diberikan ke QA |
| --- | --- | --- |
| Session/auth/credential/OAuth | Recent proof, lock/recheck, single use dan boundary BFF/API | Session dicabut saat callback/write menunggu lock; credential berubah saat login/reset; replay TOTP/recovery/state; timeout/provider error; tidak ada auto-link email. |
| Permission/guard | Check order dan transaksi tidak membuka escalation | Anonymous 401, missing permission 403 sebelum read; revoke/deactivate berlaku request berikutnya; Admin vs Superadmin; dua revoke active Superadmin terakhir tepat satu menang. |
| Kontrak/route/query/export | Backward behavior, DTO/schema/docs, safe paging | Query salah 400 sebelum guard, body salah sesudah guard, non-UUID 404; sort liar/deep page; CSV formula/leading whitespace; CSRF/origin/traversal/redirect. |
| Schema/migration | Forward-only, ownership, constraint dan rollout | Fresh DB dan upgrade; checksum tampered ditolak; concurrent migration; duplicate create tepat satu menang; tidak ada audit untuk transaksi rollback/no-op. |
| UI filter/panel bersama | Pertahankan URL/query contract; review desain oleh Designer | Default closed, trigger bukan tab/header, hasil tak menyempit; URL aktif saat closed; checkbox auto-apply/multiselect; search300ms replace/checkbox-flush push; Clear membatalkan timer; Back/view switch; keyboard/Escape/focus, resize, long content, light/dark, 360 px tanpa overflow, budget. |
| Outage | Error publik tetap, data lama/retry recoverable | DB down: readyz 503/routes fixed 500; API timeout; stale content tetap; chunk failure hanya panel; tidak ada secret dalam error/log. |

QA memetakan skenario ke tes existing terlebih dahulu, menambah tes hanya untuk gap/perubahan perilaku yang relevan. Run API suite serial dalam satu database. Budget membandingkan gzip byte tanpa rounding: batas default 250×1024 = 256.000 byte, tepat batas lulus dan +1 byte gagal; rounding hanya untuk tampilan (S4-BUG-003/DEC-015). Pinned full check, build/budget dan E2E kandidat dicatat dengan revisi/versi/command/artifact. Sesi 1 hanya menjalankan full check host, bukan seluruh gate rilis.

## Kompatibilitas yang diwarisi

Combobox mendukung command/select (`value: string[]`, `onValueChange`) serta input pencarian (`ComboOption`, `onChange`/`loadOptions`). FileUpload mempertahankan mode files/onFilesChange dan transfer callback upload; itu tidak menambahkan endpoint/storage. Regression suite keduanya dipertahankan. Saved views dan editor filter users dimuat saat dibuka untuk budget; jangan membatalkan pemisahan tanpa pengukuran.

Keputusan dan tradeoff ada di [decisions](decisions.md); urutan serta AC di [backlog](backlog.md).

Verifikasi implementasi filter DEC-017/018/019 diterima untuk penggunaan lokal melalui DEC-020 pada runtime-source `7baa40b391212ceb142afe667b7882705bdf98930561f420d27b5a5d0b66f117`. QA memverifikasi kontrak raw/BFF/API, URL/history/prefs dan geometri/refresh; detail atribusi serta batas coverage ada di [qa.md](qa.md). Tidak ada migration/dependency baru; budget tepat-byte tetap256000byte.


## Kontrak awal kandidat berikutnya — DEC-021

Status: proposal hasil riset, belum mengubah runtime DEC-020. Prioritaskan reuse module `audit`, `users`, `me`, `rbac` dan kernel mailer; tidak ada alasan menambah service/queue/vendor auth baru.

- **Auto-Superadmin wajib:** `rbac/createPermissions` meregistrasikan catalog, grant locked role Superadmin dan audit pada transaksi sama; `seedSystem` mengisi seluruh catalog ke Superadmin secara idempotent. Sessions membaca union role permissions pada request berikutnya. Official writer baru wajib menjaga invariant ini; source permission baru diterapkan melalui system seed. Tidak ada guard bypass berdasar username/role label; Admin/Viewer existing tetap memerlukan grant eksplisit. Gap tes khusus ada di NEXT-RBAC-001; tidak ada retest baru saat riset.
- **Users navigation:** hanya hapus tiga view child Users, bukan primitive children semua navigasi. Pertahankan `viewHref` remembered state, `/users?status=active`/inactive/multiple, URL/history/query/prefetch dan izin existing.
- **Audit presentation:** `ActivityDto` existing cukup untuk tahap readability. Formatter domain di feature audit/shared vocabulary, bukan UI primitive yang mengenal user/project. Perlakukan RBAC added/removed sebagai delta, jangan menampilkan seolah snapshot lengkap; unknown action/field fallback masked. Rekaman audit tetap immutable dan perubahan data+activity atomik.
- **Audit detail draft:** GET `/v1/audit/activity/:id` melalui BFF `/api/audit/activity/:id`, `audit.view`, UUID invalid/missing/purged →404, no permission →403 sebelum read. Response memakai `ActivityDto`; controller service dimiliki audit, tidak membuat Next route baru. Query UI `entry=<id>` membuka detail independen dari current list page/range, preserve filter/sort/page/refresh dan history. Key detail dibuat di `lib/shared/queries.ts`, client API same-origin; loading/error/404/forbidden/retry dan pemulihan fokus disepakati Designer/QA sebelum coding. Sign-in detail bukan otomatis ikut scope endpoint ini.
- **Target investigation draft:** extend ActivityQuery dengan exact `actorId` dan pasangan `targetType`+`targetId`; validasi pair/length/UUID actor sebelum guard sesuai check-order repo. Predicate yang sama untuk list/count/CSV, AND dengan filter existing. Index existing `activity_target(targetId,at)` diaudit sebelum menambah index composite; tidak menambah search backend/pg_trgm tanpa pengukuran. Link target hanya mapping type+permission+internal route yang dikenal; audit record tetap terbaca bila target deleted/forbidden.
- **Request context tahap berikutnya:** source ctx sudah punya `requestId`, `client.ip`, `client.ua`; activity schema/DTO belum menyimpannya. Penambahan membutuhkan nullable migration dan kontrak/redaksi/retention; event lama null/tidak tersedia, tidak diubah atau disimpulkan dari auth log yang berdekatan. Stage hasil event dijelaskan, misalnya 2FA setup dimulai bukan enabled; failure tetap kanal auth/security/error yang tepat, bukan sukses activity palsu.
- **Invitation discovery:** auth memiliki user_tokens single-use72jam, janitor menghapus expired, reset consume menghapus row. Lifecycle durable harus ditentukan terpisah dari token availability, user status dan email delivery; tetap auth-owned/public module boundary, bukan join lintas module ad hoc. Resend/consume/revoke serta email/deactivate perlu lock/recheck satu sumber state; token hanya hash. Jangan menyatakan expired/accepted hanya dari no token atau password-null karena LDAP/OAuth-only. Model/endpoint baru belum dikunci, wajib menyepakati schema/API/permission/retention sebelum implementasi NEXT-INV-001.
- **Mail minimum:** patch copy memakai fakta account-created response, bukan klaim delivered/queued; log transport tetap tidak mengekspos link. Inbox SMTP lokal opsional memakai adapter SMTP existing tanpa mengaktifkan provider produksi/menambah dependency default. Durable outbox/retry delivery bukan implicit scope; jika diperlukan perlu keputusan terpisah.
- **Tooling:** doctor read-only/no secret; generator memakai local template, dry-run/no overwrite/validasi path dan wiring eksplisit. Tidak ada perubahan DB/seed/build/preview dari sesi riset ini.

Failure-path Sign out masuk discovery NEXT-SIGNOUT-001: browser→BFF gagal tidak sama dengan backend API revocation gagal; source logout UI catch+redirect dan BFF cookie destroy setelah backend response perlu oracle/targeted test terpisah. Redirect/login bukan bukti session server dicabut. Jaga CSRF/same-origin/OAuth binding/cache clearing; jangan menambah klaim global sign out atau mengubah semantics auth saat merapikan menu. Ini risiko source, belum verdict bug QA.


Batch A DEC-022 mengaktifkan hanya nav cleanup, presentation audit existing DTO, truthful invitation copy dan penguatan regresi SA. Tidak ada kontrak wire/API/schema baru yang diperlukan sebagai default. Domain semantic formatters tetap di feature audit/shared vocabulary; masked snapshot tetap sumber, tidak menampilkan nilai yang tak pernah direkam. List/detail/CSV tetap konsisten semantik; bila helper diff shared diubah, jaga legacy/unknown/null/array semantics dan uji pengaruh CSV. Perubahan permission source hanya bila gap invariant terbukti; auto-grant harus tetap transaksi dan tidak memakai shortcut bypass guard. Pertahankan SSR/rail stable, dynamic account menu/error recovery serta exact-byte budget.

Batas semantic set Batch A: hanya field roles/permissions dan payload delta yang dikenal diperlakukan sebagai himpunan; array unknown tetap mempertahankan urutan. Null, string kosong dan key absent tidak digabung tanpa label yang menjelaskan. Snapshot masked tidak dapat membuktikan secret berubah antar dua nilai; formatter tidak mengarang detail yang tidak direkam. Fault-injection pengujian atomic catalog/grant/audit dibatasi fixture DB test terisolasi, tanpa production API seam.


## Implementasi batch A diterima — DEC-023

Satu pure shared `audit-changes.ts` menyediakan model presentation UI/CSV; legacy `audit.ts` exports tetap, unknown action lookup memakai own-property check. Detail semantic dimuat di existing EntryDialog, bukan first-load module; absent/null/empty, known set/delta, masked evidence, unknown array JSON dan literal comma-role tetap berbeda. CSV header/predicate/DTO/store tidak berubah. AuditTable menyimpan trigger terhubung untuk pemulihan fokus Escape/Close.

Shared deferred-overlay mempertahankan fresh intent yang datang sesudah preload resolved tetapi sebelum queued closed handoff commit. Functional state preserve intent, cached late transfer, refocus dari current active stand-in, defaultOpen initial false tidak menolak explicit press; controlled open false tetap dapat menolak dan callback tepat sekali. Test10cases baru dipisah dari DOM suite lama yang dipertahankan. Tidak ada delay/expiry/guard bypass, migration, dependency atau endpoint baru.

Runtime `ca1f803c1d7cc72abc64d22b3ce757295c9a6cf69d7da9148b2cb4bb878d359c`, build `6itnZmu8wVgOUoML63Na2` diterima lokal melalui DEC-023 setelah QA independen dan scoped visual Designer. Source+test fingerprint cocok sebelum/sesudah QA; bukti dan batas cakupan di qa.md. Source review root mengacu exactbaseline product0b2f dan22changed files, bukan historical scan-source yang berbeda dari freeze DEC-020.
