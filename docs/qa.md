# QA SunnyGo

## Sesi 4 — 9 November 2026 / NEXT-QA-004

**NEXT-QA-004 Done — rekomendasi GO lokal scope NEXT-AUD-002 pada kandidat R2.** Retest independen selesai;
seluruh assertions produk yang dijalankan lulus dan Designer memberi final scoped visual acceptance.
AUD2-DES-001 **Closed / QA verified pada R2**, bukan ditutup dari klaim Developer. Lima probe yang sebelumnya
tertahan harness/oracle telah dikoreksi dan lulus pada build baru. Riwayat R1 gagal tetap dipertahankan.
Hasil hanya untuk scope NEXT-AUD-002 dan kandidat R2 di bawah; known-red CI/template release tetap terpisah.

Acuan: [DEC-025](decisions.md#dec-025--pemilik-memilih-audit-investigasi-sebagai-batch-berikutnya),
[backlog batch audit](backlog.md#batch-investigasi-audit--dec-025-dipilih-pemilik),
[kontrak arsitektur](architecture.md#kontrak-implementasi-audit-investigasi--dec-025-aktif), dan
[handoff Designer NEXT-DES-003](design.md#next-des-003--audit-investigasi-entry-link-exact-filters-dan-history).
Handoff tertulis menjadi acuan delta; tidak ada perubahan Figma untuk batch ini. Review visual R2 dicatat di bawah.
Keputusan final mempertahankan free-user search pada actor action menggantikan saran awal Designer untuk
menghapusnya. Temuan/hasil batch sebelumnya di bawah tetap historis, tidak dipindahkan menjadi hasil batch ini.

### Scope, revisi dan lingkungan

Scope: GET detail Activity, exact actor/target filters, URL/history/focus/cache detail, copy link, user/project
history entrypoints, record availability, serta dependency recent-user type predicate dan transient saved views.
Sign-in detail endpoint, manual UUID/type/ID form, lookup service, invitation lifecycle dan request metadata bukan
scope. Perbaikan lima kegagalan CI DEC-024 merupakan pekerjaan terpisah. QA tidak mengubah kode produk.

Baseline HEAD `c459bb0d662cb756810f3030709d6fe0323aac0a`; kandidat R1 dibekukan dan diuji dengan identitas di bawah.
Developer menyiapkan patch R2 di host atas izin PL selama slot R1; frozen container/build R1 tidak diubah.
R2 kemudian dibekukan dan diverifikasi QA terpisah. Pembacaan source/test sendiri bukan bukti eksekusi.

Frontend host yang diizinkan hanya **localhost:3000**, API4000 existing. Preview3453/3454 dan API4453/4454
historis telah dihentikan, tidak direstart. Runtime/data/akun dev tidak direset, login tidak ditebak, live cookie,
session dan secret tidak disalin ke harness. Pemeriksaan read-only Docker menunjukkan engine tersedia, tidak ada
container berjalan, image `starterkit-dev:local` dan `postgres:18` tersedia; QA belum menjalankan container.

Lingkungan retest yang disepakati: Docker internal milik Developer, **tanpa published host ports**, private network,
PostgreSQL18 dengan DB/seed fixture khusus, browser internal, Bun1.4.3 dan Node24. Gunakan snapshot source beku
tanpa live `.env`, volume dependencies/cache/build terpisah. Harness lama yang membaca live DATABASE_URL atau
mount checkout beserta env/cache dev tidak dipakai apa adanya. API tests memakai DB khusus berakhiran `_test`;
replay QA mendapat fixture/DB sendiri dan slot serial, bukan menjalankan reset bersamaan dengan Developer.

### Pemetaan acceptance criteria ke skenario

Prioritas di bawah adalah **urutan pengujian berdasarkan risiko**, bukan perubahan prioritas produk. P0 mencakup
authorization, kehilangan identitas/predicate dan kebocoran cached evidence; P1 mencakup alur investigasi,
aksesibilitas dan regresi terkait. Ini peta skenario, bukan tanda semua cakupan sudah lulus; eksekusi per lapisan
dicatat pada hasil subset dan R1 di bawah. Area pending tidak dianggap lulus.

| ID / risiko | Acuan acceptance dan skenario / oracle | Metode yang direncanakan |
| --- | --- | --- |
| AQ4-01 / P0 | GET `/v1/audit/activity/:id`: internal-token gate existing; no session401, no `audit.view`403 sebelum audit lookup. Untuk matched route, guard mendahului invalid-ID404. Authorized invalid UUID404 tanpa audit query; valid unknown/purged404. Session/role reads bukan audit lookup. | API integration dengan spy/fixture dan BFF authenticated replay |
| AQ4-02 / P0 | Existing ActivityDto memakai stored actor/target snapshot, bukan live joins. Actor/target dihapus atau diganti nama: detail200 dengan evidence lama. Entry sendiri dipurge:404. Pemegang global `audit.view` boleh membaca event orang lain; tidak menciptakan ownership rule baru. User tanpa izin tidak boleh membaca event miliknya sendiri. | API integration real stored fixtures dan browser |
| AQ4-03 / P0 | Invalid actor UUID, pair missing/empty, type65/ID513 atau NUL menghasilkan400 sebelum guard/session. Boundary1/64/512 diterima; nil/uppercase UUID-shape actor sesuai kernel, bukan stricter UUID-version validator. Scalar repeats first termasuk empty-first; action tetap OR multivalue. | Shared contracts + API integration, authorized/anonymous cases |
| AQ4-04 / P0 | Target opaque exact: permission/session/composite/non-UUID, whitespace tepi, newline, Unicode, comma, SQL/HTML-like text dan prototype-like strings tidak trim/casefold/truncate. U+0000 ditolak; control lain tetap literal. UUID-looking target beda case adalah identitas berbeda; actor UUID beda case identitas sama. Query parameterized, rendering escaped. | Boundary fixtures, API list/CSV, shared tests dan UI probes |
| AQ4-05 / P0 | Rows/count/CSV memakai predicate sama: actor AND paired target AND existing free-user/range AND action OR. Fixture lebih dari satu halaman (misalnya21 match/page15), near misses actor lain bernama sama, targetID sama/type berbeda, prefix/case ID, action dan range berbeda. Bandingkan set IDs/count/CSV, pagination/sort stabil dan valid-no-match kosong. | API integration parity + browser pagination/export |
| AQ4-06 / P0 | Raw URL `actorId=`, pair kosong/separuh/oversize tetap error400, tidak berubah menjadi unfiltered pada SSR/client/export. Invalid prefetch tidak membaca list; client key membedakan invalid URL. Unrelated sort/action/page update mempertahankan raw presence/value. Explicit chip clear menghapus key walau normalized empty sama default, target atomik/page1; Back memulihkan invalid URL/error. | Shared request/table-state/prefetch tests + browser invalid→interact→clear→Back |
| AQ4-07 / P0 | Detail key/path audit-owned, independen page/range/filter/empty/error list; offpage/offrange entry tetap terbaca. Past-end list correction mempertahankan entry. Entry absent dari list query/count/CSV. Malformed/empty first `entry` membuka generic404, tidak diam-diam hilang atau fetch collection; uppercase entry memakai lowercase BFF detail path. | Shared key/prefetch tests + network assertions dan direct browser loads |
| AQ4-08 / P0 | A→B: old A fields/title/error tidak tampil sebagai B; delayed A200/404/500 tidak mengganti B. Same-ID refetch403/404 menyembunyikan cached fields/actions dan menampilkan terminal state. Same-ID500 boleh stale data dengan Notice+Retry; initial500/new ID tidak boleh data ID lain. | Deterministic delayed/fault browser responses + API permission-revocation case |
| AQ4-09 / P0 | Permission dicabut mid-session diterapkan next request; detail cached200→403 tetap aman. API401 mengikuti login redirect existing dengan return URL termasuk entry. Retry selalu latestID dan tidak mengubah list context. | API sessions/guard regressions + browser cache/failure replay |
| AQ4-10 / P1 | Row View entry menyelesaikan pending search menurut commit/blur existing lalu satu PUSH URL committed+entry; range/filter/sort/page/size/refresh tetap. Back menutup, Forward membuka. Bila current URL sudah memiliki entry, row A→B REPLACE pada slot itu, bukan PUSH; same-ID open no-op. Transfer owned list-origin hanya bila exact currentA URL/marker membuktikannya, memakai actualBtrigger; jika tidak, clear origin. Owned C→A→replaceB: Close/Back ke C, Forward ke B, A tidak resurrect. Owned Close/Escape/scrim Back hanya jika provenance dan current URL cocok; bukan history.length. | Browser history length/URL assertions, normal dan pending-search input |
| AQ4-11 / P1 | Direct URL/reload/user-project source: Close REPLACE menghapus hanya entry dan tetap Activity list; browser Back biasa dapat kembali sumber. DirectA→replaceB tidak memperoleh owned origin; CloseB tetap Activity list dan tidak Back keluar aplikasi. Navigasi route melepas dialog. Background URL changes mempertahankan ID jika entry ada, tidak ada delayed reopen/close. | Browser direct/reload/source/history sequences |
| AQ4-12 / P1 | Fokus sekali ke loading/error panel; ready/retry tidak merebut fokus berulang. Close ke actual row trigger hanya bila connected+visible+enabled, selain itu Activity h1 `tabIndex=-1`, bukan BODY. Retry yang hilang kembali ke panel. Tab trap/Escape/scrim mengikuti Dialog phone existing. | Keyboard/focus probes desktop/phone, row removed/hidden dan direct load |
| AQ4-13 / P1 | Copy link hanya ready200: absolute same-origin `/audit/activity?entry=<uuid>` tanpa list params/credentials, address bar context tetap. Success `Link copied.` polite tanpa focus move. API clipboard gagal→fallback; semua gagal menampilkan exact failure copy+read-only selectable URL, tidak false success; focus Copy lalu nextTab field. | Clipboard controlled capabilities/failures + actual helper path, browser assertions |
| AQ4-14 / P0 | View actor activity set actorId saja; View target activity set paired target atomik. Keduanya preserve free-user dan semua filter/range/sort/size lain (AND), page1/remove entry dalam satu PUSH. Cancel pending debounce, pakai latest committed URL, tanpa draft resurrect; zero result sah. | Browser network/URL/history/timer sequences + shared state tests |
| AQ4-15 / P1 | Actor logical count1, pair count1, entry0. Chip target satu identity dan X hapus kedua key; Clear all preserve range/refresh existing. Empty/missing raw labels dapat dibedakan dan direcover. Tidak ada manual rail UUID/type/ID fields, virtual internal pair key tidak bocor ke URL/API/views. | Browser chip/badge/clear + serialization unit |
| AQ4-16 / P1 | Invalid/missing actor tidak diinfer dari nama; unknown target types tetap literal. Target ID>512 tetap detail-readable tetapi filter blocked dengan reason, tidak dipotong; invalid pair/type memakai blocked reason Designer. Values whitespace/control terlihat tanpa collapse identity atau unsafe markup. | Legacy fixture browser + shared helper tests |
| AQ4-17 / P0 | Exact fields persist pada named/remembered views, entry tidak. Activity `/me/views` raw save strips key entry; legacy DTO read dan client viewLink juga strip tanpa update/migration row. Strip key-specific, bukan substring dalam target value; path lain tetap existing. Legacy remembered entry tidak membuka dialog. | API views integration + shared prefs/viewLink + browser save/reopen |
| AQ4-18 / P1 | Existing remembered300/named4096 length limits tetap. Unicode/long exact URL yang melebihi storage cap memberi hasil limit/recovery jujur, tidak truncate identity/relax cap; URL tidak dibuang. View ownership/CSRF/IDOR tetap existing. | Boundary unit/API regression + browser storage limit path |
| AQ4-19 / P0 | User recent activity `targetType=user AND targetId=userId`: same UUID project/other-type tidak masuk, aksi actor=user tetapi target lain tidak masuk. Recent20 tetap20 terbaru. Tanpa audit.view DTO recentActivity null dan tidak ada history affordance. | API users integration collision+permission fixtures |
| AQ4-20 / P1 | User recent View entry menuju clean exact user target+range90d+entry; entry lebih tua90d tetap readable. Header View history/support `Activity · Last 90 days`, tetap ada saat recent empty. Project secondary View history exact project+90d tanpa entry/actor/q/action bawaan. Kedua entrypoints audit.view-gated; tidak ada recent-project API baru. | Browser user/project source links + network/API assertions |
| AQ4-21 / P0 | Open user/project hanya exact type+valid UUID+permission read+actual GET200. Tanpa read permission tidak ada target GET. Unknown/role/session/bulk tidak ditebak route; cached lookup200 lalu403/404 atau permissionfalse tidak mempertahankan CTA. | Browser permission/network assertions + API read outcomes |
| AQ4-22 / P1 | Availability404 `Record unavailable.`,403 `Record access unavailable.`, network `Couldn't check record availability.`+Retry check. Error target tidak mengganti snapshot/entry state; rename tidak rewrite recorded label. Stable action space; same-window internal route. Delete/revoke sesudah check ditangani destination guard existing. | Fault/deletion browser sequences dan source snapshot comparison |
| AQ4-23 / P1 | Loading/ready/empty-notfound/restricted/failure-stale copy sesuai Designer. 360/390phone,834tablet,1440desktop, light/dark, keyboard/reduced motion; long IDs/chips/changes/actions membungkus, no page overflow, Close terjangkau, touch44 dan basic axe. Designer menilai visual yang membutuhkan keputusan desain. | Production browser assertions/screenshots + Designer candidate review |
| AQ4-24 / P0 | Satu GET baru terdokumentasi dengan audit.view; no extra Next route/sign-in endpoint. Shared query/Prefetch URL/key sama; BFF allowlist tetap ketat, client same-origin, no sibling feature imports. GET read-only, masked Batch A semantics dan CSV formula safety tetap. | Architecture/conformance/shared regressions + targeted BFF/CSV/browser checks |
| AQ4-25 / P1 | Existing actor/target indexes menjadi baseline; ukur plan exact filter atas representative fixture sebelum usulan index/migration, tanpa menciptakan SLA baru. Budget semua route ≤256000byte gzip, exact sum/headroom; pin runtimes dan full check kandidat. | Developer qualified gates/plan artifacts, QA review dan independent risk subset |
| AQ4-26 / P1 | Handoff tambahan Designer: sebelum lazy detail module siap, Notice `Opening activity entry…`+Cancel sebagai first visible child di dalam owning FilterSurface setelah PageHeader (DEC-018), termasuk direct URL; selected row trigger yang masih rendered wajib `Opening…`+aria-busy, tanpa second open/history PUSH. Bukan modal/focus trap/inert/autofocus; polite status sekali. Cancel/Escape (bila tidak ada overlay lain/defaultPrevented) memakai close/focus policy yang sama; Cancel sync-invalidates import generation sebelum async Back, sehingga controlled module resolve ketika Back masih held tidak me-mount dialog. Jalur REPLACE menghapus entry sebelum late resolve. Setelah module siap Dialog loading/data/error fokus panel sekali; successful notice unmount tidak menjalankan close/returnFocus atau flash h1. Cancel/entry switch/route leave menggagalkan callback/module/data/copy/focus lama; A tidak membuka atau memfokus setelah B/cancel/leave dan late chunk tidak membuka ulang. Chunk failure `Couldn't open this activity entry.`+`Reload page` (sameURL)+Cancel; bounded `Retry opening` bila loader mendukung, bukan infinite pending. Opening/failure Notice menjadi rail anchor outeredge tanpa extra topgap; setelah hilang, first remaining visible Notice/card menjadi anchor. Constant clearance64 tetap, tanpa nested padding/global-topbar offset tambahan; Header actions clear. Tidak eager-import heavy dialog/diff/Radix demi fallback; byte gate tetap. | Browser held/rejected chunk dan late resolve setelah cancel untuk row+direct; history/focus/handoff, actual bounding boxes pending/ready/cancel/resize (bukan hardcodedY), Designer review, budget |

Fixture minimum: dua actor berbeda dengan nama sama; user/project target UUID sama; target opaque dengan case,
whitespace/newline/Unicode dan boundary lengths; entry di luar90d, deleted actor/target, missing/purged entry;
user audit.view tanpa target-read, target-read tanpa audit.view dan session revoked. Seed dan test events hanya
di DB fixture, termasuk legacy snapshot eksplisit. Event writer nyata dan direct legacy insert diberi label berbeda.
Canary masking memakai writer/policy existing, tidak mengklaim arbitrary secret yang sudah tersimpan aman saat read.

### Urutan eksekusi dan bukti yang diperlukan

1. Developer menyelesaikan source/tests/docs dan gates, menyiapkan replay internal Docker. Bekukan runtime dan
   product/test fingerprint, leaf hashes, build ID, runtime/image versions, commands, fixture identity serta artifacts.
   Verifikasi snapshot tidak membawa live env/cache. QA tidak merebuild kandidat diam-diam.
2. QA memeriksa packet dan source/build binding, mendapat slot serial+DB replay tersendiri, lalu menjalankan
   independent targeted API/shared/browser tests di atas berdasarkan delta dan risiko. Pemeriksaan hash/build
   sebelum/sesudah wajib; source berubah berarti hasil harus diikat revisi yang benar atau retest.
3. Catat command, environment, pass/fail/skip, log/network/screenshots dan reproducibility. Developer runs diberi
   atribusi terpisah dari QA runs. Controlled responses menguji UI race/failure; API integration menguji real guard,
   predicates/persistence. Mock failure bukan bukti fullstack berhasil.
4. Bug baru memakai `AUD2-QA-xxx`, Task NEXT-AUD-002/NEXT-QA-004, revision/build, environment/prerequisite/data,
   steps, actual, expected+acuan, severity+dampak, evidence, konsistensi dan workaround. Specification gap,
   environment blocker dan improvement dipisahkan. Tutup hanya setelah verified pada revisi perbaikan dan regresi.
5. Designer review artifacts/runtime kandidat yang sama. QA melaporkan verdict beserta scope belum diuji;
   Product Lead memutuskan penerimaan risiko/rilis. Tidak memperluas kombinasi tes tanpa alasan baru setelah gates
   relevan lulus. Bila Docker terhalang, laporkan kebutuhan replay; tidak otomatis membuka port atau mengambil dev runtime.

### Hasil saat ini dan rekomendasi

| Kegiatan / area | Status faktual |
| --- | --- |
| Baca backlog, desain final, arsitektur, keputusan dan implementation/test source terkait | Selesai sebagai review statis; oracle AQ4-01–26 siap, termasuk handoff tambahan pre-chunk Designer |
| Pemeriksaan ketersediaan Docker | Read-only selesai; bukan provisioning atau pengujian produk |
| API/shared component NEXT-AUD-002 | **Lulus scoped**, hasil independen dan binding pada bagian berikut; bukan final-candidate approval |
| Browser/budget kandidat NEXT-AUD-002 | R2:18replay+10QA probes+2final settled probes lulus,0fail;22route exact budget pass. Point runs tambahan dicatat terpisah di bawah |
| Full check kandidat | Developer R2:1619pass/typecheck/lint; atribusi Developer, source-binding diverifikasi QA |
| Bug fitur baru yang direproduksi QA | AUD2-DES-001 Medium **Closed / QA verified R2**; tidak ada open product failure dalam scope hasil ini |
| Kegagalan CI main `42502573858` pada baseline c459bb0 | **Known-red terpisah**:2 stale nav/invitation oracles,2 mobile DS screenshot-height failures,1 Users dark/reduced first-paint failure; belum diverifikasi perbaikannya oleh QA |
| Release NEXT-AUD-002 | Retest R2 selesai; rekomendasi scoped lokal dan final Designer disposition di bawah. Bukan klaim seluruh CI/deployment produksi lulus |

Tidak ada ambiguitas kontrak yang masih menahan oracle. R1 dan R2 sudah diuji dengan binding terpisah.
Lima CI failures tetap dicatat;
targeted Linux pass nanti tidak berarti seluruh CI hijau. Preview/port dan status environment pada bagian lama
di bawah adalah kondisi historis pada tanggal masing-masing, bukan izin menghidupkannya kembali.

### Verifikasi independen subset API/shared — 9 November, 01:12–01:14 WIB

Developer menyerahkan component freeze `api-subset.json` sementara UI masih dikerjakan, dan menahan build/browser
selama slot QA. QA memverifikasi **230 leaf files** API/shared/UI-lib, aggregate SHA256
`59fc263dec48f367311397446481b8dc1dce2d170825074a5280675fe2a135de` **cocok sebelum/sesudah**;
tidak ada tracked/new file pada tiga area itu yang tidak tercakup. Root package/lock dan UI package hash juga
direkam pada `envelope.json`. Binding ini harus dicocokkan lagi dengan kandidat final agar hasil tetap berlaku.

Environment eksekusi component: macOS host, **Node24.21.0/Bun1.4.3**, existing PostgreSQL service dengan **DB QA
khusus `*_qa_aud2_test`**, bukan DB Developer `*_s3_aud2_test` atau dev. Runner QA mengubah suffix tujuan dan
preload menimpa DATABASE_URL/MIGRATION_DATABASE_URL serta auth/crypto/mail config menjadi fixture test sebelum
import app; suffix diperiksa sebelum truncate. Koneksi lokal hanya dipakai untuk DB QA, tidak dipindah ke container.
API memakai **app.handle in-process tanpa listen/port**, tidak ada server browser/build/container yang dimulai QA.
Ini handoff component yang diizinkan Developer/PL, bukan klaim Docker production browser sudah diuji.

Bukti QA = `.superpowers/scratch/qa-audit-2/` (ignored), terpisah dari artifacts Developer:

| Eksekusi independen / bukti | Hasil dan cakupan |
| --- | --- |
| `node .superpowers/scratch/qa-audit-2/verify-subset.mjs pre` dan `post`; `pre-subset.json`, `post-subset.json`, `envelope.json` |230files cocok,0mismatch, aggregate sama; SHA root dependencies disimpan |
| `node .superpowers/scratch/qa-audit-2/run-api.mjs api-subset src/modules/audit/tests/integration/investigation.test.ts src/modules/audit/tests/integration/audit.test.ts src/modules/me/tests/integration/views.test.ts src/modules/users/tests/integration/users.test.ts src/modules/auth/tests/integration/guard.test.ts src/kernel/tests/integration/parse.test.ts test/architecture/conformance.test.ts test/app.test.ts`; `api-subset.log` | **188pass/0fail/869assertions**,8files,15,41detik. API detail/guard/invalid-before-read, exact boundary/parity32match+near-misses/list/count/CSV, saved-view ownership+limits+new/legacy entry stripping, users/rank/concurrency/recent targettype, kernel/security/conformance regressions |
| `node .superpowers/scratch/qa-audit-2/run-api.mjs independent '<absolute repository>/.superpowers/scratch/qa-audit-2/independent.test.ts'`; `independent.log`, `independent.test.ts` | **3pass/0fail/50assertions**,378ms. QA-authored scratch probes: nil actor, type64/UnicodeID512, opaque SQL/control/prototype strings dan case-sensitive UUID-looking targets melalui real DB/detail/list/CSV; bothblank/empty-first repeats list+CSV400; valid-first ignores later invalid. Recent20 hanya ON user, tidak actor-only/typecollision, audit permission revoked→null |
| `/Users/riuzaki/.npm/_npx/aef7621c2333c54c/node_modules/.bin/bun run --filter @starterkit/shared test`; `shared.log` | **27pass/0fail**,7files,130ms. Contracts/NUL/bounds dan key-specific transient stripping, beserta shared baseline regressions |
| Query-plan case dalam `api-subset.log` |200k fixture rows, exact actor+target page1000 **3ms pada run ini**, existing actor/target index dipilih; bukan jaminan latency deployment/SLA baru |

AQ4-01–05,17,19 dan bagian API/shared AQ4-24 memperoleh bukti di atas; bagian browser/SSR/view reopening/cache
dan visual pada baris yang sama **tetap belum diuji**. AQ4-06–16/18/20–23/26 serta budget/full gates AQ4-25 menunggu
kandidat final sesuai metode masing-masing. Controlled browser races, real BFF HTTP, production bundle dan
permission-driven UI tidak dianggap lulus oleh app.handle. Tidak ada bug baru yang direproduksi atau tes gagal
pada slot ini. **Rekomendasi component: siap digabung ke kandidat UI untuk retest**, bukan GO fitur/rilis.
Slot dikembalikan ke Developer setelah post-hash selesai; QA tidak mengubah API/shared/product source.
Pesan silang PL sempat meminta replay API Docker; sesudah klarifikasi PL menerima component host di atas dan
menghentikan duplikasi sebelum build/provision/test Docker dimulai. Snapshot draft di scratch diberi label
`docker/NOT-EXECUTED.md`, bukan bukti eksekusi. Tidak ada image/network/volume/container Docker QA yang dibuat.

### Kandidat final R2 — retest independen 9 November, 01:58–02:05 WIB

**QA Done — GO lokal yang direkomendasikan untuk scope R2; AUD2-DES-001 Closed / verified.**
Designer final scoped visual acceptance NEXT-DES-003 diterima pada source/build yang sama. PL memiliki keputusan
penerimaan/rilis; hasil ini tidak mengklaim seluruh template atau remote CI hijau.
Product711files SHA256 `71796c39790608b06ed2d8e9f49d2a8cc89e220e6e73172e39ac61dd31d96ec8`;
runtime486files SHA256 `4f29f9d4455c36eff8b7f6fda499cbbc53362f10d3ccacde9cf8ad031afc966e`;
build **`vw_fJi0Zpw9N0jU-Y-2sr`**; compiled5761files SHA256
`6a4360af5a6a278960f9de89b37c5c2b8a54fe242d726bd398fcd12c4e149742`.
Image `starterkit-aud2-s3:candidate-4f29f9d4455c`, ID
`sha256:6e57faec5a714ea1e82d6045881c821b3a50cdbc861174b889637fe765950ce4`.

QA memakai runner, platform dan DB aud2_qa_e2e terisolasi yang sama seperti R1; setiap replay seed/login melalui
fixture sendiri, tidak reuse cookie live, rebuild, publish host ports atau menyentuh dev data. Slot berurutan,
dikembalikan ke Developer setelah selesai. **Pre/post host711 + container711 + compiled5761 cocok0mismatch**,
API230 tetap SHA `59fc263dec48f367311397446481b8dc1dce2d170825074a5280675fe2a135de` yang sudah diuji
188API+3probe+27shared. Bukti: `candidate-r2-pre.json`, `candidate-r2-post.json`,
`candidate-r2-final-post.json`, `candidate-r2-settled-post.json`; packet asli disimpan `r2/`.

| Eksekusi independen R2 / bukti di `.superpowers/scratch/qa-audit-2/` | Hasil |
| --- | --- |
| Same runner `activity-entry.spec.ts audit-investigation.spec.ts --project=desktop`; `candidate-r2-replay.log`, `candidate-r2-replay-artifacts/` | **18pass/0fail**,24,4detik. Regresi affected URL/history/chunk/copy/filter/CSV/cache/states/widths dan escaped identity pada all4widths |
| Corrected QA `--config /app/.superpowers/scratch/qa-audit-2/qa.config.ts`; `candidate-r2-probes.log`, `candidate-r2-probes-artifacts/` | **10pass/0fail**,9,7detik. Audit-only real Viewer tanpa target GET; live audit permission revoke→403 menghapus cached detail; target cache200→403/404 hide CTA; legacy named+remembered entry stripping/preserve opaque value; held Back/import cancel; invalid-list/offpage detail; long513blocked; phone known project/copy/a11y; AUD2-DES-001 repro kini green |
| Point User recent history; `candidate-r2-user-capture.log`/artifacts | **1pass**,1,5detik. Actual source link exact user+90d; event2020 tetap readable di luar90d, Open user read200, Close→filtered Activity/h1, browser Back→source user. Capture awal mengandung transisi dan diganti settled evidence berikut |
| Initial settled Close point; `candidate-r2-scroll.log`/artifacts | **1pass**,2,7detik, hanya membuktikan Close pada settled initial state. Facts inner scrollTop **0→0**; heading sudah visible, sehingga **bukan bukti body telah discroll**. Klaim scroll pada pesan awal ditarik/dikoreksi; raw facts disimpan |
| Final narrow `--grep 'QA phone user recent\|QA focused settled phone scroll'`; `candidate-r2-settled.log`, `candidate-r2-settled-artifacts/` | **2pass/0fail**,5,1detik. Known-user viewport setelah finite animations selesai+animations disabled, tanpa old Users bleed; actual body scroll **0→331**, outer scroll0/pageY0, header/Close tetap visible; Close focus+click→h1 |
| QA-authored exact-byte recalculation `exact-budget.mjs`; `exact-budget-r2.json` | **22route pass**,0mismatch terhadap Developer budget. Activity**255997B/headroom3B**, Users**255965B/35B**, Sign-in log**255742B/258B**. Same compiled build, gzip level9 unique chunk union; tidak dibulatkan |

Browser counts di atas adalah **executions per run**, bukan unique scenario count yang dijumlah dengan R1.
Log `start exited143` sesudah Playwright exit0 berasal dari SIGTERM cleanup owned Next server, bukan failed test;
tidak dipakai untuk menutupi assertion failure. QA memverifikasi internal3000/4000 berhenti sesudah handoff awal.
Server yang dipakai pada probe tambahan juga dihentikan runner. Host frontend3000/API4000 tidak disentuh.

**Verifikasi fix:** QA memakai fixture equivalent dengan type `" permission "` dan ID `" \nOpaque\t "`;
R2 rendered text kini memuat JSON quotes/escape literal sama dengan raw identity representation, bukan collapse.
`candidate-r2-probes-artifacts/qa-opaque-target-facts.json` dan `qa-opaque-target-metadata.png` mengikat bukti.
Plain UUID user/project dan legacy513 tetap terlihat/untruncated. Ini menutup **AUD2-DES-001 pada R2**;
R1 failure tetap valid. Lima red harness/oracle R1 lulus pada corrected10 R2 tanpa perubahan requirement produk.

**Bukti visual final:** QA melihat opaque metadata, phone project/actions/copy fallback dan viewport user/scroll
settled. `candidate-r2-settled-artifacts/qa-phone-known-user-entry.png`, `qa-phone-user-recent-history.png`,
`qa-phone-scroll-settled-before.png`, `qa-phone-scroll-settled-after.png` serta JSON facts menggantikan capture
transisi sebagai evidence settled. Close rect sesudah scroll x338/y136/32×32, header y116–192 pada390×844;
inner331, outer0/pageY0. Ini actual measured bounding boxes, bukan hardcoded screenshotY oracle.
Designer memberikan **FINAL scoped visual acceptance NEXT-DES-003/NEXT-AUD-002 R2**, memverifikasi identity di8ready
views,15PNG packet dan supplemental/final settled captures, termasuk actual scroll0→331 dan known-user history.
Ledger: `designer/audit-2/r2-visual-review.json`, [docs/design.md](design.md). Mid-transition/scroll0 evidence tidak
dipakai untuk klaim settled/actual scroll. Tidak ada perubahan Figma/klaim frame baru.

**Atribusi gates Developer:** full check R2 **1619pass/0fail** (UI742/shared27/web288/API562,179files),
typecheck dan lint max-warnings0; Developer browser18pass25,7detik dan build/budget. Packet/log-source binding
diverifikasi, tetapi ini bukan eksekusi full check oleh QA. API/shared independent result tetap berlaku karena
230inputs unchanged; tidak mengulang DB suite tanpa delta. QA tidak mengubah product source.

| Pemetaan akhir / batas | Evidence dan status |
| --- | --- |
| AQ4-01–05/17/19 serta API/shared AQ4-24 | Independent API188+probe3+shared27; frozen230 unchanged pada R2. Named view client/remembered dan real permission UI ditambah corrected probes |
| AQ4-06–16/20–23/26 | QA R2 replay18+own probes dan point cases di atas: exact/invalid URL recovery, list/detail independent, history/focus, stale terminal handling, copy, record read gating, source history, cold chunk cancellation dan responsive basic a11y. Real API events vs controlled browser failures/legacy DB fixtures diberi label |
| AQ4-18/24/25 existing shared/generic regression | Source-matching Developer full check, scoped API regressions dan independent exact22byte;200k plan3ms pada component run. Ini qualified evidence dengan atribusi, bukan klaim semua kombinasi browser diuji QA |
| Belum diuji independen secara penuh | Full existing multi-project E2E/remote CI, Firefox/WebKit/real physical devices, production/network load beyond fixture200k, real provider SMTP/LDAP/OAuth; deployment tidak dilakukan |
| Kombinasi khusus yang tidak dijalankan sebagai browser probe baru | Expired-session401→login return-entry flow, target lookup network500→Retry check, dan valid512-Unicode Activity filter melewati named4096/storage cap. Existing shared/BFF/API/full-check gates tetap terpisah; tidak mengklaim kombinasi UI tersebut lulus dari source read |

**Rekomendasi QA: GO penggunaan lokal untuk scope NEXT-AUD-002 pada R2.** Retest dan visual scoped selesai;
tidak ada hambatan lingkungan tersisa untuk cakupan eksekusi yang disepakati. `r2/completion.json` menyimpan
hasil/binding/SHA evidence, dengan daftar area belum diuji di atas tetap berlaku.
Tidak ada product failure terbuka pada cakupan yang dijalankan. Risiko terbuka: headroom3/35byte sangat tipis,
harus dihitung ulang setelah source berubah; lima existing CI failures DEC-024 tetap red dan belum diverifikasi
perbaikannya. Template-wide REL-001/QA-REL-001 dan produksi tetap terpisah. PL menentukan penerimaan risiko;
rekomendasi ini tidak berarti seluruh CI hijau, deployment aman secara menyeluruh, atau izin commit/push.

### Kandidat UI R1 — verifikasi independen 9 November, 01:49–01:55 WIB

**Riwayat R1 berikut dipertahankan; status final terbaru adalah R2 di atas.**

**Belum GO; AUD2-DES-001 Open / reproduced; R2 menunggu verifikasi.** Source:710product files SHA256
`775acb7adcaa576bec0807b86c307972a5aa30bb21fa093e245599f319db0bed`;486runtime SHA256
`754e741a7b57976e805e5d05aba885ee45e73e87078a7fde1cdd5124105a0080`. Build **`iyOjDEw-xlEJIvzpGFBpX`**,
5761compiled files SHA256 `819901ca1dd60df3d8c03e3ae5d46e16a4b55c9f6fbde5ca2a65d8886d507c83`.
Image `starterkit-aud2-s3:candidate-754e741a7b57`, ID
`sha256:3dfb605ad9f64362181b8f9208e57f5c2ddca0901a86f0754a8f189d188849cf`.

QA memakai slot serial workbench `starterkit-aud2-s3-workbench-1`, Linux ARM64/Node24.22.0/Bun1.4.3,
Chromium internal/PostgreSQL18.6; fixture DB **aud2_qa_e2e** tersendiri. Setup login normal lewat form dengan
akun seed, random secrets per runner; tanpa live session/env, host ports, dev DB atau rebuild. Runner menghentikan
server miliknya sesudah setiap run. QA tooling/probes hanya pada ignored scratch.

Bukti = `.superpowers/scratch/qa-audit-2/`. `candidate-pre.json`: host710 dan container710+compiled5761 cocok,
API230 unchanged, imageID/buildID cocok. `candidate-r1-post.json`: **container710+compiled5761 tetap cocok**,
API230 unchanged. Top-level `pass:false` berasal dari **host WIP R2 yang diizinkan**: activity-entry-dialog.tsx,
audit-investigation.spec.ts dan new activity-entry-dialog.test.ts; bukan perubahan runtime R1. Packet R1 disimpan
di `r1/` agar tidak tertimpa R2. Hasil R1 tidak menutup temuan pada host patch atau kandidat R2.

| Eksekusi independen | Hasil / batas |
| --- | --- |
| Runner `/app/aud2-run-internal.mjs activity-entry.spec.ts audit-investigation.spec.ts --project=desktop`, E2E_DATABASE_URL menunjuk internal aud2_qa_e2e, E2E_SCRATCH qa-audit-2/candidate-replay | **18pass/0fail**,24,6detik, same build ID. `candidate-replay.log`, `candidate-replay-artifacts/`. Real CRUD/history/CSV dan controlled chunk/copy/cache/navigation failures dibedakan oleh spec. Desktop project dengan resize360/390/834/1440 light/dark/reduced-motion; bukan full multi-project E2E |
| QA-authored `qa.config.ts` + `qa-probes.spec.ts`, runner sama, E2E_SCRATCH qa-audit-2/candidate-probes-2 | **10 executions:4pass/6failed**,1,4menit. Pass: held chunk resolve ketika Cancel/Back masih held tidak mount; invalid-background/past-end mempertahankan entry; legacy ID513 readable/blocked; phone known project/history/actions/Changes/copy fallback reachable+axe serious/critical0. Satu fail mereproduksi AUD2-DES-001; lima lain membutuhkan koreksi harness/oracle, tidak diubah menjadi pass |
| Existing budget script + QA-authored `exact-budget.mjs`, gzip level9 setiap unique chunk dari segment manifests | **22route pass,0byte mismatch**, same build. `candidate-budget.json`, `exact-budget.json` berisi per-chunk bytes+SHA. Activity255997B/headroom3; Users255965B/35; Sign-in log255742B/258. Margin tidak dibulatkan/dikecualikan |
| Source/compiled/image checks | `verify-candidate.mjs`, pre/post JSON di atas. No rebuild. R2 harus diverifikasi dan diukur ulang |

**Harness/oracle red tetap disimpan:** `candidate-probes.log` gagal setup sebelum tes karena scratch belum punya
ESM package boundary; diperbaiki dengan scratch package.json/type module. Pada run kedua, dua Viewer login timeout
di `#login`: trace menunjukkan context baru mewarisi fixture storage sehingga /login redirect. Dua availability
reopens dijalankan sebelum Close unmount, sehingga same-ID URL update terbatched tanpa refetch. Satu assertion
saved-view mengharapkan201 padahal existing route mengembalikan200. Scratch telah dikoreksi ke empty auth storage,
tunggu Close unmount, dan status200 sesuai kontrak. **Belum diulang pada R1** agar tidak menduplikasi run saat R2
siap. Kelima skenario menunggu corrected replay R2; bukan product pass atau temuan produk terverifikasi.
Logs/screenshots/traces tersimpan pada `candidate-probes-2-artifacts/`. Fixture auth-state runtime yang selesai
dihapus sebelum handoff; bukan evidence guard dan tidak dipinjam sebagai sesi live.

Supplemental captures: `qa-phone-project-history.png`, `qa-phone-investigate-known-project.png`,
`qa-phone-changes.png`, `qa-phone-copy-fallback.png` di `candidate-probes-2-artifacts/`. Ini melengkapi15 PNG
Developer untuk Designer, bukan acceptance final R2. Slot R1 dikembalikan sesudah post-hash/artifact copy.

#### AUD2-DES-001 — Metadata detail menyamarkan identitas opaque dengan whitespace/control

- **Task:** NEXT-AUD-002 / NEXT-DES-003 / NEXT-QA-004. Origin Designer, dikonfirmasi QA tanpa ID duplikat.
  **Open / independently reproduced**; patch host belum diverifikasi pada build baru.
- **Severity Medium:** dua nilai exact berbeda dapat terlihat sama dalam evidence investigasi. Tidak ada bukti
  perubahan DTO/predicate/data atau kebocoran izin. **Prioritas P1** ditetapkan Product Lead.
- **Revisi/lingkungan:** R1 source/build/image di atas; desktop1440; Superadmin seed; DB aud2_qa_e2e.
  Legacy fixture direct DB insert terlabel, bukan event writer biasa.
- **Data/prasyarat:** entry `765e90c2-7a5c-4679-8263-f97257a2033a`, action legacy.qa,
  targetType `" permission "`, targetId `" \nOpaque\t "`, targetLabel QA recorded evidence.
- **Langkah:** seed fixture di DB QA; buka `/audit/activity?entry=<id>`; bandingkan metadata Target dengan raw
  snapshot. Repro script: QA opaque-identity test pada qa-probes.spec.ts.
- **Aktual:** textContent berisi whitespace asli, tetapi innerText menjadi `QA recorded evidence permission Opaque`,
  CSS `white-space: normal`; tanpa quotes/escape pembeda dari targetType permission / targetId Opaque.
- **Harapan/acuan:** exact opaque DEC-025 dan handoff identity display Designer: ungkap edge whitespace/control
  dengan representasi aman seperti quote policy chip; string biasa/UUID mudah dibaca dan snapshot tetap immutable.
- **Bukti:** `candidate-probes-2.log` test terakhir; `candidate-probes-2-artifacts/qa-opaque-target-facts.json`,
  `qa-opaque-target-metadata.png`, failed assertion+trace pada test-results. Settled screenshot dilihat langsung QA.
  **Konsistensi QA1/1**; Designer juga menemukan terpisah. **Workaround:** raw JSON atau exact target chip sesudah
  investigation mengungkap quoted identity; bukan alasan menutup temuan.
- **Perbaikan/verifikasi:** Developer menyiapkan lazy-detail formatter/unit regression di host atas izin PL.
  Frozen R1 tidak diubah; menunggu R2 source/build, corrected probes, visual confirmation dan exact byte gate.

## Sesi 4 — QA independen, 8 November 2026

### NEXT-QA-003 — hasil akhir kandidat Batch A

**Hasil QA: Done — retest independen selesai, rekomendasi GO lokal Batch A.**
**Keputusan Product Lead: GO penggunaan lokal Batch A**, tercatat pada
[DEC-023](decisions.md#dec-023--penerimaan-lokal-batch-a), untuk fingerprint/build di bawah.
Lima temuan **Closed / verified**. Tidak ada status Conditional yang tersisa untuk NEXT-QA-002/NEXT-QA-003
atau penerimaan lokal batch ini. **REL-001/QA-REL-001 template keseluruhan tetap terpisah/terbuka**;
hasil ini bukan persetujuan deployment produksi, commit, merge atau batch berikutnya.
Catatan WIP/Open, red failures dan diagnosis sebelumnya dipertahankan sebagai riwayat, bukan verdict final terbaru.

**Identitas:** HEAD `2ba4b9fd892fbe585bf2087dc1dd5fc9f812078f`, WIP beku **478 runtime files** SHA256
`ca1f803c1d7cc72abc64d22b3ce757295c9a6cf69d7da9148b2cb4bb878d359c`; **693 product/test files** SHA256
`3790e085ee1738a5e6027690786158cbc7028193e89c34cf5ba23cc2864714ba`;
build **`6itnZmu8wVgOUoML63Na2`**. QA menghitung ulang source/build sebelum dan sesudah tes: **cocok/tidak
berubah**,22source-delta leaf hashes cocok. Paket Developer362file diverifikasi SHA/byte;8refresh manifests
cocok source/build/probe/exact JPEG set dan cakupan pre-READY→post-SETTLED.

Bukti QA **BAQ/** = `.superpowers/scratch/qa-batch-a/final/` (ignored): `packet-review.json`,
`post-run-fingerprint.json`, `completion.json`, logs/captures/probes. Handoff Developer ada di
`.superpowers/scratch/developer-batch-a/`; tidak ditimpa oleh QA. Environment: macOS27.2, Node24.21.0,
**Bun1.4.3**, PostgreSQL18.6, Chromium153.0.8010.12. Reuse build produksi frozen, **tanpa build ulang**;
server QA3223/4223 memakai DB baru `*_qa_batcha_e2e`, API tests `*_qa_batcha_test` terpisah. Tidak memakai
atau reset DB dev/preview. Server QA sudah dihentikan; baseline3453/4453 dan kandidat3454/4454 tetap HTTP200.

| Eksekusi independen | Hasil / bukti |
| --- | --- |
| `node BAQ/run-targeted.mjs core activity-readability.spec.ts invitation-feedback.spec.ts sidebar-rail.spec.ts account-menu-loading.spec.ts filter-panel.spec.ts filter-refresh.spec.ts projects.spec.ts time-range-picker.spec.ts --project=desktop` | **63pass/0fail/0skip**,2,8menit; includes contexts360/390/834/1440 light/dark dan rail1920. `core.log`, `browser/` |
| `ACCOUNT_PROBE_CPU=4 node BAQ/run-targeted.mjs stress account-menu-loading.spec.ts --project=desktop --grep 'cold account menu' --repeat-each=10` | **30pass/0fail/0skip**,39,4detik; Enter/Space/ArrowDown masing-masing10. `stress.log`, folder unik `browser-stress/`;30probe JSON source hash+CPU4 diverifikasi |
| `node BAQ/run-api.mjs` — auto-superadmin, audit integration, users integration, mailer unit | **135pass/0fail**,4files,691assertions,11,24detik. DB QA khusus; same-session context, seed/custom/non-SA/concurrency/rollback/recovery termasuk. `api.log` |
| `bun run --filter @starterkit/shared test` memakai pin | **23pass/0fail**,5files; semantic model, recursive masking/presence, array/delta/unknown action/CSV. `shared.log` |
| `bun run --filter @starterkit/ui test -- deferred-overlay-handoff.test.ts deferred-overlay-dom.test.ts deferred-overlay.test.ts deferred-intent.test.ts drawer.test.ts` | **28pass/0fail**,5files; controlled/uncontrolled, late focus, pointer/popover, exactly-once/expiry/failure existing. `ui-handoff.log` |
| `bun run --filter @starterkit/web test -- nav.test.ts activity-summary.test.ts` | **11pass/0fail**,2files. `web.log` |
| `node BAQ/independent-probe.mjs` | **3 skenario tambahan lulus:**11masked stored fixtures/API+CSV facts, UI390dark dan1440light; nested null↔MASK/MASKsame, array item boundary, comma-role, overlap/empty member fallback, constructor/toString/__proto__, scalar12. Escape/Close focus pada Activity **dan Sign-in log**, filter chip unknown, overflow; fixtures dibersihkan. `independent-probe-retest.log`, `probes/results.json` |
| Budget script + penjumlahan gzip independen | **22route pass** gate256000B. `/users`**255600B/headroom400B**, auth255014B/986B, activity254699B/1301B. `budget.json`, `budget-exact.json`/`.log` |

Browser total **63 selected +30 stress executions**, bukan93 unique scenarios atau full E2E suite. Unit tambahan
shared/UI/web **62pass**; probe custom tidak digabung ke angka suite. Semua product assertions yang dijalankan
QA pada kandidat final lulus; satu kegagalan harness di bawah tetap dicatat. Full check **1576pass** Developer
(UI741/shared23/web270/API542, termasuk typecheck/lint) dan verified-browser63 dipakai dengan atribusi setelah
source/build binding diverifikasi. Stress30 Developer source-matching memakai build terpisah DLFj menurut
DEC-023; bukan gate30 pada build6itn yang dijalankan QA. **QA sendiri menjalankan30CPU4 pada build6itn** dan
memverifikasi source/build sebelum/sesudah. Eksekusi Developer tetap bukan eksekusi QA.
Tidak menjalankan ulang seluruh baseline atau Linux combinations yang tidak diperlukan oleh delta ini.

| Acceptance / temuan | Bukti dan keputusan QA |
| --- | --- |
| NEXT-NAV-001 / BA-NAV01–04 | Nav3browser + unit nav, live filter/saved-view/history regression lulus: satu Users pada expanded/collapsed/tablet/drawer/palette/G U, remembered/legacy multi state tetap; primitive generic children tidak dihapus |
| NEXT-AUD-001 / BA-AUD01–06 | Audit9browser mencakup real HTTP project create/update/delete→stored log/JSON/detail/CSV dan80legacy fixture dialog contexts; shared unit + API audit + probe tambahan presence/delta/fallback/CSV/focus lulus. Fixture bukan production event writer; stored test events dimask melalui policy snapshot existing, bukan bukti arbitrary unsafe DB values disanitasi saat read |
| NEXT-MAIL-001 / BA-MAIL01–04 | Invite/password/directory3real browser creations, pending/409 controlled fixture dan successful real retry; truthful exact copy/helper/disclaimer, disabled inactive, draft/no-auto-retry/no success-before-response lulus. Mailer fake SMTP/log failure dan users invite/token/rules dites terpisah; tidak mengklaim fullstack/provider SMTP delivery nyata |
| NEXT-RBAC-001 / BA-RBAC01–06 |6new API regressions lulus: dua SA old sessions next auth-context, non-SA/custom creator unchanged, seed custom2x, overlaps, duplicate, grant/audit faults dan same-fixture/session retry. Users/rank/escalation regression dalam API suite lulus; production RBAC logic tidak dibypass |
| BA-REV-001 | **Closed / verified:** nested null→MASK dan MASK→null berbeda di helper/API stored fixtures/CSV/UI, MASKsame tidak menciptakan secret-content change; canary tidak bocor |
| BA-REV-002 | **Closed / verified:** one comma-bearing item berbeda dari two items; known set/delta dan malformed empty/overlap fallback benar, unknown arrays preserve boundaries/order; UI+CSV verified |
| BA-REV-003 | **Closed / verified:** constructor/toString/__proto__ aman sebagai raw string pada unit, record/dialog, filter chip dan CSV; known labels tetap |
| BA-QA-001 / sementara S3 | **Closed / verified:** Activity+Sign-in detail Escape/Close mengembalikan fokus ke actual trigger; phone/desktop dan core fixture/realCRUD lulus. Red log tetap; missing red trace/fingerprint tidak diklaim tersedia atau direkonstruksi |
| BA-TEST-001 / sementara S3 | **Closed / verified pada coverage kandidat:** causal handoff unit + controlled rejection/pointer/popover/late focus dan real cold account5normal +30CPU4 stress lulus. Expiry/failure/close-during-load/warm key/focus dan actual time-popover regression terliput. Ini bukan jaminan zero intermittency di semua device/network |

**Visual:** Designer **ACCEPTED scoped NAV/AUD/MAIL** pada hash/build sama;13PNG final dan362index/source22
ditinjau, `designer/batch-a/final-visual-review.json`/design.md. Bukan full implementation/release approval;
Figma tidak diubah dan tidak ada klaim frame baru. QA juga melihat tiga settled probe captures phone null/comma
dan desktop constructor; core8audit contexts axe/focus/overflow/console assertions lulus. Initial probe screenshots
terambil saat transisi dan **tidak dipakai sebagai proof visual akhir**; tetap disimpan. Enam capture baru memakai
suffix `-settled.png`/`visual-results.json`, animations disabled hanya untuk settled screenshot. Refresh flicker
tetap memakai actual pre-script frames tanpa menghilangkan intervalnya (`browser/refresh-captures/`).

**Harness/evidence history:** extra probe pertama salah memakai inherited lookup pada dictionary expected label
`constructor`, sehingga mencari `function Object()`; ini **bug harness QA**, bukan produk. Initial script/log,
JSON dan screenshot disimpan dengan label `initial`, lalu oracle diperbaiki memakai own-key lookup; product
source/timeout/assertion strength tidak diubah. Rerun lengkap lulus. Failed Developer runs14/16,28/2, fixture
TypeError/double-encoding/cwd errors dan trace red yang hilang tetap sebagaimana dilaporkan, tidak diedit hijau.

**Risiko/batas tersisa:** bundle headroom400B tipis, hard gate tetap256000B; dua transport/asset stalls pada
stress Developer awal28/2 belum didiagnosis QA dan tidak otomatis disebut flake. Current bounded QA63+30
lulus pada frozen build, bukan penghapusan fail awal. Tidak ada candidate Linux/WebKit/real-device atau screen
reader manual baru, seluruh palette/density/network/cached-chunk permutations tidak diuji; tidak ada provider
SMTP/LDAP/OAuth nyata, HTTPS/staging/deployment, restore/capacity/RUM. Mail copy scope tidak menjanjikan delivery.
Ini tidak menambah requirement rilis lokal; Product Lead menerima/menentukan tindak lanjut risiko secara eksplisit.
Jika source/build berubah, verdict hanya berlaku pada fingerprint di atas; regresi terdampak perlu diverifikasi lagi.
**NEXT-QA-002/NEXT-QA-003 Done; rekomendasi QA diterima Product Lead sebagai GO lokal Batch A (DEC-023).**

### Batch A — oracle dan riwayat sebelum retest NEXT-QA-003

**Arsip kronologis:** status Open/menunggu/Conditional dan angka red di bagian ini menggambarkan keadaan sebelum
final retest; status aktif dan keputusan lokal ada di bagian final di atas. Kegagalan awal tetap kegagalan saat itu.

**Status:** NEXT-QA-002 **Done — mapping/oracle empat task selaras dengan NEXT-DES-002 dan DEC-022**.
NEXT-QA-003 belum dimulai saat perencanaan berikut ditulis; kini **Done / verified**, lihat hasil final di atas.
Tidak ada tes/build/DB pada pembaruan perencanaan saat itu. [DEC-022](decisions.md#dec-022--go-implementasi-batch-a),
[scope backlog](backlog.md#batch-a-aktif--dec-022), [kontrak arsitektur](architecture.md#kontrak-awal-kandidat-berikutnya--dec-021)
dan source/test terkait sudah dibaca. QA mengambil NEXT-QA-002 dan menghubungi Designer/Developer untuk handoff bertahap.

**Scope hanya:** NEXT-NAV-001 satu Users; NEXT-AUD-001 presentation dari ActivityDto existing;
NEXT-MAIL-001 truthful invitation copy; NEXT-RBAC-001 regresi invariant auto-Superadmin.
Shareable entry/GET-by-ID/target filtering, metadata request, inbox SMTP, lifecycle invitation, account cleanup,
failure-path sign-out, doctor/generator **tidak menjadi acceptance batch A**. Tidak menambah requirement lalu
memakainya untuk menggagalkan kandidat. Oracle semantic/security berasal dari DEC-022; exact copy dan business
labels mengikuti NEXT-DES-002. Penilaian visual kandidat tetap milik Designer, bukan diputuskan QA.

Risiko tertinggi: akses SA tidak lengkap/auto-grant bocor ke non-SA, transaksi catalog tidak atomik, secret
terbuka oleh formatter baru, serta klaim pengiriman email yang tidak didukung response. Risiko berikutnya:
nav mereset filter lama, audit salah menyatakan delta sebagai snapshot lengkap, dan bundle melewati256000B
(baseline `/users` hanya200B headroom). Severity temuan baru tetap berdasarkan reproduksi/impact; prioritas milik PO.

#### Pemetaan AC ke skenario — oracle perencanaan, hasil terbaru pada tabel final di atas

| ID / task | Skenario dan oracle | Metode / existing vs gap |
| --- | --- | --- |
| BA-NAV-01 / NAV001 | Expanded1440, collapsed1440, tablet834, phone390/360: satu tujuan Users, tanpa All/Active/Inactive child/menu/palette result. Roles/Permissions tetap, permission hiding tetap. Link keyboard/pointer/touch menuju tujuan yang sama | Unit nav + browser sidebar/command palette/responsive. Existing `nav.test.ts` children dan `sidebar-rail.spec.ts` submenu expectations **superseded untuk Users**; ganti dengan singleton/link/tooltip/focus assertions, jangan skip suite atau menghapus primitive children semua modul |
| BA-NAV-02 | Bookmark `/users?status=active`, inactive dan repeated active+inactive tetap valid, bersama role/q/sort/pageSize/page. SSR/hydration/read BFF mempertahankan seluruh filter; menghapus child nav bukan redirect/reset ke All | Existing table-state/prefetch/filter-panel/responsive-data + targeted legacy URLs. Bandingkan URL, selected options/chips dan hasil API |
| BA-NAV-03 | Klik Users, G U, command palette dan breadcrumb kembali memakai remembered view existing. Page/search tidak dimasukkan ke remembered navigation; named views/kolom tetap. Query >300 tidak memulihkan cookie lama atau menghapus prefs halaman lain | Existing `ux-patterns.spec.ts`, prefs/table-state, probe client-prefs DEC-020 menjadi acuan skenario, **hasil lamanya bukan pass batch A** |
| BA-NAV-04 | Back/Forward mengembalikan snapshot filter/sort/page; checkbox/Clear/page-reset dan debounce300ms tetap. Navigasi dari create/edit dengan dirty guard serta dari phone drawer tidak menggandakan aksi/merampas fokus. Shortcut-off tetap dihormati | Targeted browser; reuse leave-guard/permissions/shortcuts bila diff menyentuh jalurnya. Tidak mengharuskan semua variasi form diulang jika tidak terdampak |
| BA-AUD-01 / AUD001 | Actor-action-target terbaca untuk user/role/permission/me/**project**. Action dan business labels mengikuti handoff Designer; ID/label historis tetap dari record, unknown action punya fallback. Description/hint menyebut Projects | Fixture representative action + feature formatter unit/browser. Existing actionLabel/ActivityPage sudah ada; summary/label semantik baru adalah gap. Tidak menambah link target atau fetch entity hidup |
| BA-AUD-02 | `roles`/`permissions` snapshot penuh: tambah/hapus diperlihatkan benar; reorder-only bukan perubahan. Bandingkan sesuai nilai canonical tersimpan; jangan memperlakukan semua array arbitrary sebagai set atau menganggap case-fold baru. Empty set berbeda dari snapshot tak tersedia | Pure formatter tests/table fixtures + CSV equivalence. Exact dedupe untuk known valid string sets, unknown arrays preserve order sesuai handoff final di bawah; fixture `[Admin,Viewer]→[Viewer,Admin]`, add-only/remove-only/mixed/empty |
| BA-AUD-03 | RBAC `{added,removed}` dan permission `{created}` adalah **delta yang direkam**, bukan seluruh permission sebelumnya/sesudahnya. Jangan menyimpulkan item yang tidak tercatat sebagai removed atau menyusun snapshot palsu | Fixture actual role.update before{name}/after{name,added,removed}; permission.create after{created}; user.assign_role. Existing `recordActivity` payload dan integration rbac menjadi oracle data |
| BA-AUD-04 | Create (after tersedia), delete (before tersedia), update sebagian/legacy dan no-snapshot dibedakan. `null`, key absent, empty string, empty array, `false`,0 tidak disamakan diam-diam. No-snapshot berarti data perubahan tidak direkam, bukan bukti tidak ada perubahan | Semantic fixture matrix pada helper yang benar-benar dipakai; display labels exact mengikuti oracle handoff di bawah. Tidak mengubah raw audit JSON agar cocok dengan UI |
| BA-AUD-05 | Unknown fields/nested data aman dan tetap masked sesuai kebijakan existing; credential yang sudah `MASK→MASK` tidak menjadi klaim secret berubah. Raw credential fixture tidak muncul di UI/CSV/summary. Unicode/long text/HTML-like text tidak merusak layout atau menjadi HTML | Existing shared `audit.test.ts`, API audit rules/record/CSV + gap formatter baru. Canary dummy di fixture lokal, bukan secret nyata; unknown fallback tidak boleh melewati masker |
| BA-AUD-06 | UI diff/summary dan CSV menyampaikan perubahan yang sama meski bentuk presentasi berbeda; JSON before/after tetap. Formula-neutralization, quoting/newline dan full filtered export tetap. Dialog phone360/390 dan desktop keyboard/Escape/focus-return dapat dibaca; loading/error list/empty/stale serta rail tidak regresi | API audit CSV + shared changeText bila berubah; browser detail/axe/overflow/lightdark. Targeted regression audit filter/history. Snapshot update saja bukan bukti semantic pass/approval Designer |
| BA-MAIL-01 / MAIL001 | Setelah create invite berhasil, toast mengakui fakta **account created**; tidak menyatakan sent/delivered/queued tanpa bukti. Wording exact dari Designer. Label pilihan/instruksi yang menyatakan niat berbeda dari klaim hasil; tidak melakukan blanket-ban kata di seluruh app | Browser successful invite response + persisted user; source copy review. User-form baseline menulis sent: expected ini memang berubah, tidak dianggap lulus karena API200/201 saja |
| BA-MAIL-02 | Log transport, SMTP stub accepted/delayed/rejected menghasilkan copy yang tetap jujur sesuai response yang tersedia. Fire-and-forget failure tidak menjadi delivery success; patch copy tidak mengarang queue, retry, delivery status atau lifecycle baru | Existing mailer fake-SMTP/log tests + browser response/copy. Reuse stub/fixture terisolasi saat retest; **bukan provider SMTP nyata** dan bukan kewajiban menambah infrastruktur |
| BA-MAIL-03 | Create400/403/409/network failure tidak menampilkan success account-created; draft/error existing tetap. Password/directory mode tidak menerima invitation-specific success copy; inactive/LDAP invite masih ditolak dan tidak membuat user/token | Existing users integration invite/password/LDAP + targeted browser create/error. Semantics create/token72h tetap, tidak menambah resend/revoke/accepted badge |
| BA-MAIL-04 | Forgot-password tetap anti-enumeration; invitation/reset token dan alamat pada log tetap sesuai redaksi. Copy tidak mengekspos token/link atau membedakan unknown/LDAP/throttled lewat forgot response | Reuse auth/users/mailer tests bila diff terkait; source/diff review memastikan scope copy tidak mengubah API/transport/security |
| BA-RBAC-01 / RBAC001 | Dua pemegang SA aktif sudah login sebelum registrasi resmi permission baru. Setelah sukses, token **yang sama** pada next `GET /v1/auth/context` memuat permission baru, tanpa login ulang. Grant onward tetap memakai guard/escalation yang nyata, bukan bypass username/role-label | Gap integration production createApp+old sessions. Existing rbac366/381 sudah auto-grant/grant onward memakai `sa`, sessions.test next-resolve terpisah; belum membuktikan gabungan dua-holder auth-context baru |
| BA-RBAC-02 | Admin-only, Viewer-only dan custom role creator yang memiliki permission.create tidak otomatis menerima permission baru. Catalog registration authority bukan hak untuk grant permission baru yang belum dipegang. SA+Admin holder menerima lewat SA sebagaimana union roles | Snapshot effective/context dan role_permissions sebelum/sesudah; attempted unauthorized grant tetap403. Existing permission-page roles[SA] dan guard/no-escalation melengkapi, bukan mengganti assertion non-SA unchanged |
| BA-RBAC-03 | Seed pada existing custom catalog, SA dan modified Admin/Viewer grants: SA mencakup seluruh catalog; Admin/Viewer/user/bootstrap tetap; seed dua kali tidak menambah duplicate atau mereset custom grants. Fresh install tetap mengikuti defaults existing | Gap `test/db/seed.test.ts` fixture missing custom SA grant + custom non-SA set, dua seed/snapshot. Existing seed twice hanya katalog default. Fixture direct DB untuk menyiapkan gap bukan official writer baru |
| BA-RBAC-04 | Duplicate input/repeated registration: created/skipped benar, satu catalog/grant row, activity hanya fresh additions. Concurrent overlapping sets memberi union unik, seluruh fresh permissions di SA; cap500 dan non-SA unchanged tetap | Gap overlap integration + existing duplicates/cap concurrency. Assert hasil antarrequest, catalog, role_permissions dan activity bersama, bukan hanya HTTP200/count |
| BA-RBAC-05 | Force failure **sesudah catalog insert/grant sebelum commit**: catalog, SA grants dan permission.create activity seluruhnya rollback; next auth-context tidak membawa nama gagal. Recovery request selanjutnya tetap dapat berhasil | Gap targeted integration fault injection test DB, cleanup selalu; tidak menambah production test hook. Existing transaction source/cap early400 bukan bukti rollback pada tahap akhir |
| BA-RBAC-06 | Registration masih perlu internal token/session/permission.create, BFF CSRF/same-origin; SA locked role tetap tidak dapat diedit/dihapus, rank/escalation unchanged. Menambahkan catalog entry tidak menciptakan fitur/route permission itu | Reuse rbac/guard/root/BFF/security regression sesuai diff. Tidak mengubah guard untuk meluluskan invariant auto-SA; inactive SA tetap unauthenticated |

#### Oracle handoff NEXT-DES-002 — sudah diklarifikasi bersama Designer

Acuan [design.md](design.md#next-des-002--batch-a-navigasi-activity-dan-copy-invitation), section
**NEXT-DES-002 — Batch A: navigasi, activity dan copy invitation**, handoff langsung NAV/MAIL dan AUD1–3.
Designer mengonfirmasi dua boundary: **full-set subtraction hanya bila kedua field sides hadir dan valid**;
explicit action delta adalah bukti berbeda, tidak membutuhkan rekayasa full snapshot. Tidak ada boundary
semantic yang masih menunggu jawaban untuk mapping ini. Desain siap; approval implementasi menunggu kandidat baru.

| Area / fixture oracle | Expected yang dikunci |
| --- | --- |
| NAV | Satu label/icon Users, Access Users→Roles→Permissions, remembered destination pada expanded/collapsed/drawer/palette/G U. Tidak menambah status tab PageHeader; chips/badge existing menjelaskan scope; phone drawer/focus/aria-current sesuai navigasi existing |
| MAIL option/helpers | `Invite by email`; active helper **The user chooses a password using a link valid for 72 hours. Email delivery isn't confirmed here.**; inactive helper **Activate this user to use an invitation.** |
| MAIL success | Title semua create methods **Created {created.name}.** memakai response name. Invite-only description **Email delivery isn't confirmed here.**; password/directory/edit tidak mendapat disclaimer invite. SMTP/log sama; pending/error tidak mengklaim created, sent, delivered, queued atau mail-failed. Network error tidak membuktikan akun pasti tidak ada; mutation tidak retry otomatis |
| Activity title/summary | `actionLabel(action)` existing; plain text **By {actor.name} · {target type label}: {target.label}** setelah title. Known nouns User/Role/Permission/Project/Profile; unknown raw type aman. Empty actor/target memakai ID/type yang tersedia, lalu **Unknown user / Unknown target** bila benar-benar tidak tersedia; tidak menambah identitas/route fiktif |
| Page copy | Description **Changes to users, roles, permissions, profiles and projects: who made them, to which record, and when.** Hint **Entries appear here when someone changes a user, role, permission, profile or project.** |
| Presence fixture `{}`→`{description:null}` / null→empty / empty array / booleans /0 | Key absent **Not recorded**; null **Not set**; empty string **Empty text**;[] **None**; boolean **Yes/No**, khusus isActive **Active/Inactive**; nested empty object tetap `{}`;0 tetap0. Snapshot keseluruhan tidak tersedia bukan field-null |
| Whole snapshots / identical masked snapshots | Missing keduanya **Field values were not recorded for this event.** Recorded tapi no semantic difference **No field changes are shown for the recorded values.** `MASK→MASK` tidak membuktikan secret berubah; action credential tetap menerangkan event tanpa diff nilai secret |
| Create/delete | Known create after-only **Initial values** dengan field tercatat, Roles tetap Roles. Known delete before-only **Values before deletion**; role.delete before.permissions **Permissions before deletion**, bukan records permission ikut dihapus. Missing side tidak disubstitusi[] |
| Full sets | Known roles/permissions **valid string sets pada kedua field sides**: exact dedupe, deterministic differences, reorder-only diabaikan; **Roles added/removed** atau **Permissions added/removed**. Tidak menambah case-fold/locale normalization; unknown arrays tetap preserve order |
| Explicit action delta | role.create/update after.added/removed valid → **Permissions added/removed**, Name change terpisah, bukan complete snapshot. permission.create after.created valid → **Permissions added**. Empty delta sah: **None** bila ditampilkan, atau grup kosong boleh dihilangkan bila grup lain sudah menjelaskan; bukan missing-data warning |
| Malformed/unknown | Unknown action/key `created`, nonstring arrays, struktur tak lengkap/ambigu, overlap added/removed → fallback safe masked value/JSON, bukan invented delta. Scalar/nested legacy tidak blank/crash/HTML. Stored JSON/API tidak dinormalisasi demi UI |
| Labels | Name, Username, Email, **Status**, **Directory sign-in**, Roles, Permissions, **Invitation requested**, Connected accounts, Two-factor authentication, Description, Created, Updated, Session, Provider sesuai dictionary Designer. isLdap false tidak membuktikan local/password; invited tidak berarti sent/accepted. Unknown key mentah aman |
| CSV / phone | CSV kolom/wire tetap; semantic facts/presence/masking/formula safety sama, bukan wajib string presentation identik. Phone<768 metadata label di atas value, setiap change **field→Before:value→After:value**; create/delete satu sisi relevan. Satu DOM/CSS, body scroll/wrapping, IDs sekunder/CopyValue, no horizontal page scroll360/390, no warna status baru untuk delta |

Matriks BA-AUD-02/04/05/06 memakai oracle ini untuk menggantikan placeholder wording/duplicate handling:
exact duplicate known string-set tidak menjadi added/removed baru; unknown arrays/malformed delta tidak
dinormalisasi menjadi known set. Formatter fallback tetap melalui masker rekursif existing. Test fixture harus
mengecek fakta dan presence secara eksplisit, bukan sekadar snapshot screenshot atau kata Changed generik.

**BA-REV-001 — diagnostic Product Lead, target retest BA-AUD-04/05/06:** source WIP
`packages/shared/src/audit-changes.ts`, `safeJson` pada saat review memask credential key nested termasuk null.
Product Lead melaporkan pure call
`presentActivityChanges("user.update", {nested:{token:null}}, {nested:{token:MASK}})` salah menjadi no-field-changes;
diagnosis memakai **Bun host1.4.4**, tanpa DB. QA hanya membaca laporan/backlog dan source, **belum menjalankan
reproducer, menetapkan severity/verdict atau memverifikasi fix**. Status backlog **Open**, owner Developer;
bukan hasil pinned suite, bukan defect baru pada baseline DEC-020 dan tidak memperluas scope AUD001.

Oracle tambahan pada kandidat nanti: nested credential **null→MASK dan MASK→null** tetap berbeda sebagai
**presence/value yang tercatat**, tanpa mengungkap nilai asli atau mengklaim isi secret tertentu berubah.
Kontrol **MASK→MASK** tetap tidak membuktikan perubahan secret. API `snapshot` existing mempertahankan null;
masking fallback harus menjaga fakta ini di seluruh depth/legacy nested data, sementara canary non-null credential
tetap masked. Unit helper yang dipakai UI dan CSV-semantic regression harus membuktikan kedua arah+kontrol,
kemudian browser/presentation kandidat bila diff terkait. Jangan memperbaiki display dengan mengubah stored event,
API masking policy, melemahkan redaksi, skip assertion atau menyamakan null dengan absent/empty.
Developer diminta failing unit sebelum fix dan bukti post-fix teratribusi; QA menilai ulang saat freeze/slot tersedia.

**Tambahan oracle Designer — BA-AUD-02/05/06, source-only:** Designer menemukan risiko delimiter pada rendering
array string: legacy `before:["a, b"]` dan `after:["a","b"]` tidak boleh sama-sama tampak sebagai nilai identik
`a, b`. Nama role sendiri sah mengandung koma; item tidak boleh di-split atau diubah wire-nya. Preserve **batas
item yang tidak ambigu** melalui JSON aman/quoted items/presentasi terpisah yang sesuai handoff, baik UI maupun
CSV-semantic text. Unit harus memeriksa perbedaan nilai yang **ditampilkan**, bukan hanya adanya diff row.
Unknown array tetap preserve urutan dan nilai asli yang sudah masked; known role/permission set tetap exact.

Designer juga meminta empty-string element pada known delta seperti `added:[""]` dianggap malformed dan memakai
fallback masked yang mempertahankan fakta, bukan diakui sebagai permission/role sah. **`[]` tetap empty delta/set
yang sah**, berbeda dari `[""]`, null dan absent. QA membaca source WIP `strings`/`show` sebagai konteks;
**tidak menjalankan reproducer/test, membuka severity/runtime verdict atau menyebut fix verified**. Ini coverage
presentation dalam NEXT-AUD-001, bukan API/schema change, scope baru atau pass kandidat.

**Update rereview Designer:** kedua gap dilaporkan resolved **di source**: unknown arrays memakai JSON,
known sets dengan koma/newline/edge whitespace memakai JSON, blank member invalid untuk known delta;
targeted assertions tersedia. Nested null tetap berbeda dari masked, masked→masked tidak membuat diff.
Designer mencatat **9 unit Developer** dengan atribusi di design.md, bukan run Designer/QA. Tidak ada gap
feasibility tersisa menurut review source Designer; NAV/MAIL/semantic source sesuai handoff. QA belum
mengeksekusi/menutup BA-REV-001 atau memberi approval runtime berdasarkan laporan ini. Frozen candidate,
full gates terkait, retest NEXT-QA-003 dan viewport/state review Designer masih diperlukan.

Backlog BA-REV-001/002 kini **Implemented — source/pure probe reviewed; QA kandidat pending**, menggantikan
status Open saat laporan pertama. Itu bukan Closed/verified QA. Designer juga menyelaraskan ui-standard §5b
dan sidebar design-system: generic children tetap didukung, Users satu leaf/remembered destination; focus
Close/Escape audit tetap acceptance existing. Perubahan standar ini bukan bukti runtime baru.

**BA-REV-003 — laporan pure source Product Lead, BA-AUD-01/05/06:** unknown action `constructor`, `toString`,
`__proto__` harus menghasilkan **raw string yang sama**, bukan property/function/object bawaan prototype.
Product Lead melaporkan fallback `actionLabel` WIP mengambil inherited property; status backlog Open, Developer
diminta own-property lookup minimal dan red unit ketiga nama. QA tidak menjalankan probe atau menetapkan
severity/runtime verdict. Tambahkan kandidat checks pada helper, selected-filter chip, detail title/summary dan
CSV consumer: raw unknown string tetap aman, known labels tetap, tidak crash/mengarang action. Query unknown
yang valid tetap mengikuti kontrak existing, bukan ditolak melalui enum baru. Ini NEXT-AUD-001, tanpa wire change.

#### BA-QA-001 — Escape dialog audit tidak mengembalikan fokus ke View entry

- **Task:** NEXT-AUD-001, NEXT-QA-003 / BA-AUD-06. **Status:** Open — fix dilaporkan Developer,
  menunggu verifikasi QA pada kandidat; dasar saat ini review artifact automation Developer, bukan run QA.
- **Revisi:** Batch A WIP **sebelum** patch entryTrigger/returnFocus; fingerprint red/buildID belum diserahkan,
  sehingga tidak mengaitkan kegagalan itu dengan hash baseline DEC-020 atau source final yang belum freeze.
- **Lingkungan/prasyarat:** `activity-readability.spec.ts` project desktop (config1440×900), reducedMotion reduce,
  seed Superadmin/DB E2E terisolasi. Bun1.4.3 tercatat; versi browser red dan fingerprint tepat belum diverifikasi.
- **Data/langkah:** test membuat project unik, update/delete melalui BFF untuk merekam activity; buka
  `/audit/activity?action=project.create`, klik **View entry: Project created, Activity1794148590952**;
  setelah dialog terlihat, tekan Escape, tunggu dialog hilang, periksa fokus pada tombol yang membukanya.
- **Aktual:** dialog hilang tetapi tombol tetap **inactive** sampai assertion5detik gagal di spec:42.
  **Expected:** fokus kembali ke actual View entry trigger, sesuai NEXT-DES-002 dan oracle BA-AUD-06.
  Red ini membuktikan Escape; Close button dan route Sign-in log tetap target regresi, bukan kegagalan yang
  otomatis sudah direproduksi pada keduanya.
- **Severity QA sementara S3 (review bukti):** kontinuitas keyboard/fokus rusak; belum ada bukti data hilang,
  bypass akses atau semua navigasi keyboard terhenti. Prioritas ditentukan Product Lead; severity dapat direvisi
  setelah retest independen. **Konsistensi:**1failed case pada run red yang tersedia; frekuensi lebih luas belum diuji.
- **Bukti:** `.superpowers/scratch/developer-batch-a/audit-browser.log`, assertion locator Project created,
  received inactive. Log menunjuk `browser/test-results/activity-readability-real--81647-ctivity-JSON-detail-and-CSV-desktop/{error-context.md,trace.zip}`;
  **kedua path tidak tersedia ketika dicek QA**. Developer kemudian mengonfirmasi trace dibersihkan oleh run
  berikutnya dan tidak ada archive/fingerprint red khusus. Log tetap dipertahankan; QA tidak mengklaim sudah
  melihat red trace/screenshot. Tidak meminta recreate/rerun red hanya untuk mengisi artifact.
- **Workaround:** fokus ulang kontrol secara manual. **Fix dilaporkan:** AuditTable menyimpan actual button ref;
  EntryDialog `onCloseAutoFocus` memanggil returnFocus jika trigger masih connected. Membaca source patch
  tidak menutup temuan. Uji Escape dan Close, kedua audit routes, keyboard/phone pada source/build final.

**Pisahkan hasil run:** `audit-browser.log` berakhir **9failed**: satu assertion fokus di atas dan delapan
kegagalan fixture `db.json is not a function` sebelum assertion UI. Delapan itu **harness failures**, bukan delapan
bug produk atau pass. Percobaan perbaikan fixture memakai bound JSON string `::jsonb`; Developer kemudian
melaporkan double-encoding sehingga delapan legacy cases berikutnya masih gagal. `audit-browser-fixed.log`
**build typecheck exit1 / browser tidak mulai**, bukan retest pass. `audit-browser-retry.log` kini lengkap:
**1pass/8fail/exit1 (57,4detik)**. Real project CRUD termasuk Escape focus-return lulus menurut log; delapan
legacy failures dikaitkan Developer dengan fixture double-encoding, bukan otomatis delapan bug produk atau pass.
QA belum memeriksa isi DB fixture atau menjalankan sendiri. Developer mengganti fixture menjadi Drizzle dan
menjadwalkan final rerun setelah fullcheck; hasil belum diserahkan. Runner dilaporkan memakai folder unik
`browser-${label}` per run untuk mempertahankan final screenshots/traces; paket final tetap perlu diverifikasi.
Shared formatter9green dan API `audit-integration-fixed.log` **52pass/0fail/255assertions** adalah hasil Developer
terpisah; tidak meluluskan fokus browser atau full gate. NEXT-QA-003 belum dijalankan dan slot masih Developer.

**Laporan kemajuan Developer berikutnya — belum freeze:** runtime-source SHA256
`819f0cb8171a3e81cca4f22622cce5e1addb05f1d9e9a1e1ef083fb231b509db` dilaporkan stabil;
fullcheck pinned **1566pass**, budget tepat-byte **22route pass**, `/users`255558B/headroom442B.
Angka audit254657B/headroom1343B juga dilaporkan, tetapi route/build/manifest lengkap belum ditinjau QA;
jangan menyebutnya pengukuran independen atau menyamakan build yang belum diidentifikasi dengan kandidat final.
**55 selected browser cases** yang lulus berasal dari run sebelumnya; fixture legacy AUD masih masalah tooling.
Developer melaporkan diagnosis Drizzle bound-JSON wrapper→value/cwd apps/api dari probe read-only, termasuk
scalar12/nested-null, dan merencanakan whole63 rerun setelah current run selesai. Tidak menggabungkan55pass
dengan hasil run lain menjadi63pass. Paket full logs/source+product hash/buildID dan hasil final masih menunggu
handoff; BA-QA-001/BA-REV kandidat belum ditutup QA. Slot QA tetap tidak digunakan; Developer memegang slot.

#### BA-TEST-001 — cold account Enter intermiten, diagnosis belum selesai

- **Task:** regresi NEXT-QA-003/DEC-016; triase Product Lead P1, diagnosis0,5hari fokus.
  **Status:** In progress / akar masalah belum terbukti; **severity produk belum ditetapkan QA**.
  Ini kegagalan browser test yang nyata, belum dibedakan antara defect produk dan timing/lifecycle harness.
- **Revisi/lingkungan:** Batch A WIP, Chromium/darwin dari retained trace, desktop dan storage session seed;
  exact runtime/product/build association red belum diserahkan. Current batch dilaporkan tidak mengubah account
  primitive; itu bukan bukti bahwa run ini boleh dilewati. Baseline DEC-020 tidak otomatis terkena verdict baru.
- **Langkah test:** tahan account-items chunk yang diidentifikasi lewat vocabulary Color palette, buka `/users`,
  fokus account-menu trigger, kirim Enter, harapkan role menu dengan **Loading account menu…**, kemudian release
  chunk dan periksa Profile focus/Escape. **Aktual:** locator role menu sendiri tidak ditemukan selama5detik;
  test belum sampai ke release/fokus Profile/Escape assertion normal. Bukan sekadar teks loading berbeda.
- **Expected:** cold keyboard open tetap menjadi satu intent, pending menu terlihat, fokus berlanjut dengan benar
  setelah deferred content siap; Escape return ke trigger. Acuan oracle account existing, bukan perubahan UX baru.
  **Konsistensi:** Developer melaporkan prior5accountpass; run terbaru4pass/1Enterfail. Identitas antarbuild belum
  diperiksa QA; tidak menyebut root cause atau memastikan frekuensi pada build sama.
- **Bukti yang benar-benar dibaca QA:** `developer-batch-a/final-browser.log`, error-context dan parsed event
  records dari `.superpowers/scratch/developer-batch-a/browser-final-browser/test-results/account-menu-loading-cold--b975c-d-Escape-returns-to-trigger-desktop/trace.zip`;
  archive tersedia980433byte, SHA256 `1c4015692b4da45ce1fb01e8d090e0b807d39ae2a78486bc42b887f78de2d28c`.
  Ringkasan read-only `qa-batch-a/source-review/account-enter-trace-review.json` di scratch. QA tidak membuka
  kandidat/browser atau menjalankan ulang test untuk analisis ini.
- **Timeline trace (ms pada clock trace):** goto selesai4494,041; focus call4504,215→4533,123;
  snapshot4550,480 sudah mempunyai id Radix pada trigger (snapshot4500,816 belum mempunyai id);
  Enter4551,360→4553,444; menu expect4555,018→9558,201 gagal. Ini konsisten dengan transisi markup
  stand-in→Radix sebelum Enter, **tidak membuktikan** active element hilang, keydown menuju body, atau event
  handler tertentu salah. Focus-handoff/lifecycle adalah **hipotesis**, perlu event target/activeElement/intent
  evidence dari Developer sebelum menyimpulkan penyebab atau mengubah shared primitive.
- **Workaround:** belum diverifikasi QA; tidak menjadikan retry diagnostik sebagai solusi atau mengganti fail lama.
  Kandidat nanti perlu cold Enter/Space/ArrowDown, blocked/failed chunk, close-during-load, warm open dan
  Escape/focus/phone/touch yang relevan. Jika shared primitive diubah, source+red regression direview dan consumer
  menu/popover terkait dipilih menurut diff. Tidak skip, menaikkan timeout/toleransi, atau menghapus loading assertion.

**Run terbaru bukan green:** `final-browser.log` lengkap **54pass/9fail/0skip**,63cases,2,6menit:
satu account Enter failure di atas dan delapan audit fixture gagal resolve drizzle-orm dari root cwd.
Delapan fixture errors tetap harness failures, bukan delapan product bugs atau pass. Ini run berbeda dari laporan
55selectedpass sebelumnya; tidak digabung menjadi whole63pass. Fullcheck1566/budget22pass Developer tidak
menyelesaikan failure browser ini. NEXT-QA-003 execution/freeze/independent verdict tetap menunggu handoff.

**Pre-review visual Designer:** Designer benar-benar melihat8PNG audit (360light0/1/2/5,390dark long,
834light6,1440dark0/3), menerima readability pada sampel metadata/BeforeAfter stacked, null/empty/masked,
JSON wrapping dan initial/delete/no-snapshot/reorder/Close; tidak meminta koreksi visual tambahan pada sampel.
Hash8file dan limits di `.superpowers/scratch/designer/batch-a/preliminary-audit-review.json`, design.md.
Fixture test-only diatribusikan; belum binding ke frozen source/build, bukan approval final atau bukti focus-return.
Focused audit9pass yang disebut dalam review tetap laporan Developer, **bukan run QA/Designer**. Tidak mererun
baseline atau mengubah Figma; BA-QA-001 dan BA-TEST-001 tetap mengikuti verifikasi QA masing-masing.

**BA-TEST-001 diagnostic lanjutan — primitive kini berubah:** Developer memberi causal DOM test
`packages/ui/src/ui/deferred-overlay-dom.test.ts`: held loader resolve + microtasks membuat closed-root handoff
sudah queued tetapi belum commit; Enter/Space/ArrowDown masih ditangani stand-in. Keenam controlled/uncontrolled
cases **red menu absent**, lalu patch **green**; kasus ketujuh controlled owner menolak open juga green.
QA membaca source/diff dan `account-handoff-red.log` (**6failed**) serta `account-handoff-review.log`
(**24passed/4files**, combined deferred/drawer), **tanpa mengeksekusi**. Ini bukti Developer, bukan retest QA.

CPU4× baseline30trials dilaporkan **14fail/16pass** pada runtime819f0c…509db. QA membaca
`browser-account-stress/account-focus-Enter-1.json`: keydown523,7ms target+active adalah account BUTTON id kosong;
keyup525,4 masih di situ; focusout530,9→BODY, real Radix focus532,5; menu tetap absent menurut run.
Space-1 menunjukkan urutan sejenis. **Koreksi hipotesis:** input pada sampel baru benar-benar sampai ke focused
stand-in, bukan sekadar keydown ke body karena focus sudah hilang sebelum key. Bukti ini mendukung race late
intent setelah preload resolve/before commit; tidak mengklaim old trace sendirian sudah membuktikan sebab yang sama.

**Penilaian QA sementara dari review evidence: S3**, hilangnya cold keyboard-open intent mengganggu akses menu
akun; tidak ada bukti bypass/data loss. Ini menggantikan severity-undetermined pada tahap trace awal, bukan
klaim reproduksi independen QA atau penutupan. Triase P1 tetap milik Product Lead. BA-TEST-001 tetap **Open /
fix sedang direview** sampai candidate retest; hasil gagal awal tetap dipertahankan.

Patch yang dibaca mempertahankan queued `openWith` lewat functional state, mentransfer late fresh intent secara
sinkron ketika loader sudah switched tetapi stand-in belum commit, dan membuat intent open mengalahkan
initial defaultOpen=false. Controlled owner tetap authoritative. Designer menerima arah interaksi/source,
Product Lead menerima arah17line patch dan meminta boundary tambahan; itu bukan runtime/final approval.

| Regresi BA-TEST-001 setelah shared primitive berubah | Oracle sebelum freeze / retest |
| --- | --- |
| Held/queued keyboard controlled+uncontrolled Enter/Space/ArrowDown | Intent tidak hilang, onOpenChange true tepat sekali; defaultOpen=false bukan penolakan explicit user intent; Profile focus setelah loading, Escape return |
| Controlled open=false rejected + hover-preload resolve→late focus/keydown | Owner tetap dapat menolak, menu tidak terbuka; focus tetap pada trigger real yang relevan, bukan hilang ketika refocus diambil terlalu dini |
| Queued pointer + shared popover | Pointer intent tepat sekali, primary/coarse path existing; actual popover consumer terbuka/close/fokus benar. Bukan hanya fake menu unit yang hijau |
| Failed/held chunk, stale intent expiry, close/unmount sebelum load, warm reopen | Tidak late-open/reopen tanpa intent baru, retry explicit tetap mungkin, key intent tidak bocor ke root lain; cancellation/controlled authority terjaga |
| Account + menu consumers + popover consumers | Loading→Profile/failure recovery, Escape/outside/return-focus; targeted saved views/columns/row actions dan time-range popover sesuai diff. Phone/touch, warm/first key serta full browser keyup/click tidak digantikan synthetic keydown unit saja |

Kasus queued pointer/popover/late-focus rejected-owner sudah diminta Product Lead kepada Developer; QA tidak
meminta duplicate run WIP. Developer merencanakan post-patch30CPU4 trials dan broader gate. **Fullcheck1566,
budget22route dan runtime819f0c…509db sebelumnya adalah bukti pre-primitive-patch**, tidak mengesahkan source
baru. Perlu hash/build baru, relevant check/tests, exact budget≤256000B seluruh route dan kandidat beku untuk
NEXT-QA-003. Unit red/green tidak mengganti browser stress yang sama/retet independen; tidak skip/relax timeout.
Slot tetap Developer, QA hanya source/log/artifact review dan perencanaan pada tahap ini.

**Update post-patch Developer berikutnya — tetap belum freeze:** runtime prefix **ca1f803…359c** dilaporkan
untuk source terbaru; full fingerprint/build association masih menunggu completion packet. Kasus baru berada di
`packages/ui/src/ui/deferred-overlay-handoff.test.ts` (**10 DOM cases**, termasuk pointer/popover dan late-focus
controlled reject); original `deferred-overlay-dom.test.ts` dipertahankan byte-exact menurut Developer, bukan
dihapus untuk membuat coverage hijau. QA membaca targeted case source; lima unit suites dilaporkan **28pass**,
tetap eksekusi Developer. Post-patch run awal **28pass/2fail** dipertahankan: goto30detik timeout dan
Loading→Profile dengan asset pending. Root cause kedua failure itu belum diverifikasi QA; tidak otomatis disebut
flake, pass atau selesai hanya karena run berikutnya hijau.

`account-stress-final.log` yang dibaca QA berakhir **30pass/0fail,45,1detik**, Enter/Space/ArrowDown;
Developer menyatakan CPU4×/30trial conditions sama dengan baseline. Ini hasil ulang terpisah, tidak mengganti
28/2 atau14/16 dan tidak mengukur zero-risk/intermittency hilang mutlak. Fullcheck terbaru masih berjalan
menurut Developer (UI741/shared23/web270 dilaporkan pass parsial; tidak dijumlah menjadi fullcheck pass).
Budget preliminary22route pass, `/users`255600B/headroom400B, belum gate final kandidat. Broad63 rerun berikutnya
masih direncanakan. BA-TEST-001 tetap Open / fix pending independent QA; slot belum dilepas dan QA tidak run WIP.

**Update Product Lead/Architect:** final patch + late-refocus diterima pada **source review**; runtime yang
direncanakan `ca1f803c1d7cc72abc64d22b3ce757295c9a6cf69d7da9148b2cb4bb878d359c`.
Developer melaporkan **fullcheck1576pass**, targeted28green, CPU4same30green dan budget22route pass
(`/users`255600B/headroom400B). Ini menggantikan status fullcheck parsial pada laporan sebelumnya, bukan
eksekusi QA. Final63browser masih berjalan; freeze/HANDOFF dan preview baru3454 belum diserahkan kepada QA.
Prioritas NEXT-QA-003: empat task BA-NAV/AUD/MAIL/RBAC, lalu cold account/return-focus/pointer/popover dan
canary redaction/CSV/controlled-owner authority. Reuse gate Developer hanya sesudah source/build/evidence cocok;
tidak perlu mengulang seluruh baseline/full Linux combinations tanpa gap/diff relevan. Baseline3453 dan bukti lama
tetap dijaga, slot masih Developer; verdict/fix closure independen belum diberikan.

#### Pemilihan tes, bukti dan gate NEXT-QA-003

**Existing yang sudah dibaca, belum run batch A:** web `lib/shared/nav.test.ts`, prefs/table-state/prefetch;
E2E sidebar-rail/ux-patterns/responsive/responsive-data/permissions/filter-panel/no-flicker;
shared `audit.test.ts`; API audit rules/record/integration, rbac integration, sessions integration,
`test/db/seed.test.ts`, users invitation dan kernel mailer. Satu pencarian nama `users.spec.ts` tidak menemukan
file; pemetaan browser mail adalah **gap**, bukan klaim suite yang ada. Test baru mengikuti folder/boundary repo.

Pure unit/contract untuk kombinasi semantic diff, null/unknown/masking/CSV; API integration PostgreSQL untuk
auto-grant/context/seed/concurrency/rollback; browser untuk single navigation, retained state, focus/touch,
audit detail dan success/failure copy. Manual visual scoped Designer untuk wording/label/hierarchy/phone.
QA tidak mengubah source produk sebagai pekerjaan utama dan tidak mengubah toleransi/skip/timeout agar hijau.
Invariant existing yang sudah benar **boleh langsung green**; tidak memaksakan red atau perubahan source untuk
NEXT-RBAC-001. Fault injection hanya di test/schema DB terisolasi, tanpa production seam atau API baru.

Kandidat baru harus memiliki HEAD+runtime/product-file hash, buildID, changed-files scope dan command/result
pass/fail/skip. Developer menyerahkan full check **Bun1.4.3/Node24/PG18**, build serta budget raw setiap route
**≤256000B**. QA review gate dengan atribusi, jalankan sendiri skenario prioritas dan browser terkait pada source/build
yang sama; tambah regresi rail cold/warm/account/form bila diff menyentuhnya. Baseline1547check/95browser dan
scope Designer DEC-020 **tidak dianggap pass source batch A**. Tidak perlu full rerun baseline yang tidak berubah.
Perubahan formatter shared harus diikuti uji consumer CSV, bukan browser UI saja; perubahan snapshot perlu review
visual dan verifikasi ulang tanpa update. Hasil failure/harness/environment dipisahkan dan dipertahankan.

**Serial slot:** Developer memakai `.next-e2e`,3123/4123 dan DB khusus `*_s3_batcha_test/e2e`; QA telah menyatakan
slot bebas. NEXT-QA-003 nanti mengutamakan reuse build final setelah freeze; usulan port3223/4223 dan DB baru
`*_qa_batcha_test/e2e`, atau port Developer setelah dilepas eksplisit. Belum ada server/DB/build QA batch A.
Tidak menjalankan browser/performance capture bersamaan, tidak mereset DB dev/preview ataupun baseline scratch.
Preview3453/4453 dan bukti/hash DEC-020 dijaga; artifact batch A memakai folder unik/source association baru.

**Laporan Developer — BA-RBAC-05, belum retest QA:**
`.superpowers/scratch/developer-batch-a/rbac-recovery.log` mencatat Bun1.4.3, **6 pass /0 fail /84 assertions**
pada `apps/api/src/modules/rbac/tests/integration/auto-superadmin.test.ts`, DB khusus `*_s3_batcha_test`.
QA membaca log dan source: fault grant/audit memakai trigger/function test-only dengan cleanup `finally`;
response500/internal tidak meninggalkan catalog/grant/activity dan auth-context tetap semula. Setelah cleanup,
test **tidak mereset fixture**, memakai session yang sama untuk retry200; catalog1, SA grant1, context bertambah
permission itu saja, activity1 dengan payload created yang tepat. Ini sesuai oracle recovery BA-RBAC-05 dari
source review; **hasil eksekusi masih diatribusikan Developer**, bukan pass independen NEXT-QA-003, fullcheck,
build/budget, atau approval batch A. Fingerprint kandidat/freeze/serah slot belum diterima QA.

**Belum diuji QA/terhalang:** seluruh kasus tabel menunggu kandidat+freeze; copy/labels/phone oracle sudah
siap, tetapi visual runtime belum direview Designer. Ini dependency eksekusi, bukan bug produk atau fail candidate.
NEXT-QA-002 selesai sebagai perencanaan; NEXT-QA-003 selesai sesudah run/retest/coverage/risk tercatat dan
review scoped Designer tersedia. Verdict batch A tetap **belum diberikan**; keputusan GO lokal DEC-020 hanya
untuk kandidat sebelumnya. Estimasi QA total1–1,5hari fokus termasuk retest yang disepakati, di luar tunggu/defect.

### Status baseline DEC-020

Status baseline: **FIL-QA-004 selesai untuk cakupan retest di bawah; lima temuan Closed / verified**.
QA merekomendasikan kandidat diteruskan ke keputusan rilis lokal dengan risiko tersisa tercatat;
**QA-REL-001 tetap Conditional untuk konsolidasi approval/desain/distribusi dan keputusan Product Lead**.
Ini bukan persetujuan deployment produksi atau klaim seluruh kombinasi telah diuji. NO-GO audit awal tetap
benar untuk revisi awal, tetapi tidak menjadi verdict teknis kandidat yang sudah diretest ini.

### Retest kandidat beku — FIL-QA-004 / QA-REL-001

Handoff `developer-session-3/{completion.json,HANDOFF.md,fingerprint.json}` diterima 8 November 2026.
HEAD `2ba4b9fd892fbe585bf2087dc1dd5fc9f812078f` dengan WIP beku: **476 runtime files** SHA256
`7baa40b391212ceb142afe667b7882705bdf98930561f420d27b5a5d0b66f117`; **685 product/test files** SHA256
`0b2fb1e94c8ad765f2daeaa3fad3d211ca0ecf7c26b945af366553fea1bd216d`.
QA menghitung ulang keduanya sebelum dan sesudah tes: **cocok, tidak berubah**. Build Mac yang benar-benar
disajikan/diperiksa `Cp4GjCl9aN94ZxtW5Fxq0`; Linux `pPqSrrRBoEB-UWyhRGPFX` direview lewat paket Developer.

Bukti baru `.superpowers/scratch/qa-session4-final/` (**S4F/**, ignored); baseline lama tetap **S4/** di
`.superpowers/scratch/qa-session4/`. Environment QA: macOS27.2, Node24.21.0, **Bun1.4.3**, PostgreSQL18.6,
Chromium153.0.8010.12. QA memakai build produksi final yang sudah ada, port **3123/4123** yang diserahkan
Developer, database khusus baru berakhiran **`_qa_fil_e2e`**; API integration memakai **`_qa_fil_test`** terpisah.
Tidak membangun ulang source, mereset DB dev/preview, memperbarui snapshot, atau mengubah kode produk.
Server QA dihentikan setelah tes; preview Developer3453/4453 tidak disentuh.

| Eksekusi QA independen | Hasil dan bukti |
| --- | --- |
| `node S4F/run-targeted.mjs core filter-panel.spec.ts filter-refresh.spec.ts projects.spec.ts account-menu-loading.spec.ts users-actions.spec.ts sidebar-rail.spec.ts --project=desktop` | **48 pass / 0 fail / 0 skip**,2,1menit. Semua source spec existing; viewport filter360/390/834/1440/1920 light/dark turut diuji. `S4F/core.log` |
| `node S4F/run-targeted.mjs regression security.spec.ts permissions.spec.ts ux-patterns.spec.ts responsive-data.spec.ts --project=desktop --project=tablet --project=mobile` | **47 pass / 0 fail / 50 skip**,1,2menit. Desktop18pass/23skip, tablet5/23, mobile24/4. Skip karena cabang phone-only/tablet-desktop; bukan pass atau skip baru. `S4F/regression.log`, `browser-distribution.json` |
| `node S4F/run-api.mjs` — projects/rbac/audit/views/users multi-filter + root app | **143 pass / 0 fail**,6files,597assertions,10,70detik. Production `createApp`/kernel context, PostgreSQL tersendiri. `S4F/api.log` |
| `bun run --filter @starterkit/web test -- bundle-budget.test.ts table-state.test.ts prefs.test.ts prefetch.test.ts` memakai Bun pin | **38 pass / 0 fail**,4files. Termasuk checker256000B pass/256001B fail. `S4F/web-contract.log` |
| `node S4F/independent-probe.mjs` | **5 skenario lulus**: kedua route audit aktual history/Back/atomic/Clear;101-role paged/search lookup dengan pilihan off-page;50→49→50, penolakan51st, lookup500/retry/Clear; BFF raw cap/invalid later values sebelum guard. `independent-probe-complete.log`, `probes/results.json`;101role fixture dihapus kembali |
| `node S4F/clock-probe.mjs` | **Lulus**:299ms belum commit,300ms REPLACE; Enter segera REPLACE; pending-only Clear tidak menambah history/request dan timer tidak menghidupkan teks lagi. `clock-results.json` |
| `bun S4F/boundaries.ts` | **11 pemeriksaan lulus**: prefs299/300/301 menjaga prefs halaman lain; role/action64 valid unknown→empty,65→400; anon400 sebelum guard/valid401; comma/Unicode/JSON-looking scalar literal; nonallowlist page/q tetap first scalar. `boundaries.json` |
| `node S4F/client-prefs.mjs` | **Lulus**: named view613karakter melalui UI, cookie lama users dibersihkan, prefs Projects dipertahankan; client navigation→Back→reload tidak memulihkan filter lama. View fixture dihapus. `client-prefs-retest.log`, `client-prefs.json` |
| Budget script final + penjumlahan gzip independen pada manifest/chunk yang sama | **22 route pass** tepat-byte. `/users`255800B, headroom**200B**; auth255145B/855B, activity255050B/950B. `budget.json`, `budget-exact.json`; gate tetap256000B |

Total suite browser terpilih **95 pass / 0 fail / 50 skip**, API143 dan web38; probe tambahan tidak dicampur
menjadi angka suite. Ini **bukan full E2E kandidat final**. Full check **1547 pass** serta Linux36/Mac13/console9
Developer dipakai dengan atribusi sesuai source; log final-check diperiksa. Broad Developer226pass/96skip
tetap **pre-border2px**, tidak diberi label full final. Baseline full S4 yang gagal tidak ditulis ulang menjadi hijau.
Fresh install/setup/idempotency independen S4 dan paket Developer adalah bukti revisi sebelumnya, bukan run baru
final; tidak ada perubahan migration/dependency/setup pada delta ini. Build Linux dan full check tidak dijalankan
ulang oleh QA; statusnya tidak disamarkan sebagai eksekusi QA.

| Acceptance / risiko | Pemetaan retest |
| --- | --- |
| BIF-T01/07/08/09/10 wire, OR/AND, full filtered set, literal/limit/check-order | API143 termasuk distinct18users/page15/bulk18, activity32/CSV32, auth24/CSV24; BFF probe dan boundaries. assignRole scalar/nested-invalid tetap diuji |
| BIF-T02/03/04/05/06 search, history, saved views/prefs, chips/badge | Filter panel/ux/responsive suites; kedua route audit aktual, clock299/300, named views4096/4097 API, prefs299/300/301, over300 client/SSR/reload, late-response clear/Back |
| BIF-T11–15, ANCHOR-T01–10, HUG/REFRESH | Filter23 + refresh9: width/theme, desktop nonmodal/outside action, phone modal, focus/resize, Notice anchor, short-height explicit scroll, PageHeader actions, off-page/options failure. Gallery baseline final4pass diatribusikan Developer; bukan screenshot QA seluruh galeri |
| S4 bugs, CANCEL, ACCOUNT, USERACT | Projects8, account5, sidebar2, bulk retry1; permission/security/UX/responsive regression. Full all-skipped/partial/rank/concurrency users cases diatribusikan full API535 Developer; tidak semua failure permutation lazy chunk dijalankan ulang QA |

**Refresh/evidence:** QA memvalidasi **16 manifest Mac/Linux,262 JPEG**, exact file set, setiap SHA/byte,
probe archive, source/build, fase pre-READY sampai post-SETTLED dan data frame; `S4F/packet-review.json`.
`S4F/navigation-mapping.json` memisahkan frame target loader dari about:blank/navigation lama yang tercatat;
timestamp CDP target berurutan dan mencakup pre-READY. JPEG bersifat sampling, bukan rekaman setiap paint:
pada paket Developer, JPEG target terakhir dapat mendahului SETTLED hingga118,66ms; rAF sampai post-SETTLED
dan settled PNG terpisah tersedia. Tidak mengklaim video kontinu atau inspeksi visual seluruh262JPEG.
QA sendiri menjalankan delapan cold/warm Mac4×CPU pada1440×900/399/400, light normal-motion dan dark reduced:
semua visible frame **delta0, satu node/copy, H126/156/44 stabil, own opacity1/transform none/animation none**,
console/page errors kosong; `refresh-independent-summary.json`, `browser/refresh-captures/` memuat130JPEG baru.
QA melihat sampel cold900 frame005/settled dan warm399 settled; ancestor startup fade tetap dibedakan dari
own rail motion. Tidak menyaring assertion dengan `ms>=READY`. Designer menerima supplied Permissions matrix
Mac/Linux pada hash/build yang sama (`final-{mac,linux}-refresh-review.json`); Figma tetap **In review**.

| Temuan | Status terbaru dan dasar keputusan |
| --- | --- |
| S4-BUG-001 | **Closed / verified**: reconnect11detik dengan GET500+retry menampilkan stale notice, draft tetap, Retry pulih; projects case109 lulus |
| S4-BUG-002 | **Closed / verified**: Name100+spasi dan Description500+spasi disimpan canonical, GET memverifikasi;101setelah trim ditolak, create/edit lulus; projects case85 |
| S4-BUG-003 | **Closed / verified**: boundary checker tepat/over lulus,22route diukur independen, lazy account keyboard/loading/recovery lulus. Headroom200B tetap risiko |
| QA-FIL-001 | **Closed / verified pada scope kandidat ini**: independent8cold/warm+early keyboard lulus, geometry stabil sejak frame visible; anchor/actions/resize/responsive terkait lulus. Bukti red lama tetap disimpan |
| QA-EVID-001 | **Closed / verified paket pengganti**:16manifest/262JPEG source/probe/hash/set cocok, paket QA baru terpisah. Mixed stale-tail lama tetap tidak sah sebagai filmstrip postfix; tidak dihapus/ditimpa |
| S4-TEST-001 | **Tidak tereproduksi pada kandidat; monitoring**, sidebar2pass dalam run serial. Akar intermittent awal belum terbukti; tidak disebut fixed atau menghapus fail full awal |

**Kegagalan tooling QA dipertahankan:** tiga percobaan probe lookup berhenti karena asumsi search control,
SSR-prefetched lookup dan interceptor endpoint yang keliru (`/api/roles` alih-alih `/api/users/roles`).
Percobaan client-prefs awal membandingkan urutan numerik, dikoreksi ke canonical UTF-16 ordinal DEC-017.
Log `independent-probe{,-initial,-retest,-final}.log`, JSON initial/reload/wrong-endpoint dan `client-prefs.log`
tetap tersimpan; run sukses memakai label `-complete`/`-retest`. Ini **kegagalan harness**, bukan bug produk
atau test produk yang diluluskan dengan skip/timeout/toleransi baru.

**Rekomendasi:** tidak ditemukan blocker teknis baru pada scope yang diuji; **layak dilanjutkan ke keputusan
rilis lokal**, dengan headroom bundle200B dan intermittent tooltip sebagai risiko eksplisit. FIL-QA-004 selesai
sebagai retest, bukan approval seluruh task. QA-REL-001 masih conditional pada konsolidasi review Designer,
distribusi/lisensi DEV-004 dan keputusan Product Lead. Belum diuji: provider nyata/HTTPS/staging, restore drill,
capacity/RUM, WebKit/real-device/screen reader manual, seluruh kombinasi palette/density, seluruh lazy-error
permutation, full browser final dan eksekusi Linux independen QA. Area itu bukan pass; OPS/INT di luar gate lokal.
Jika runtime/build berubah, verdict ini hanya berlaku pada fingerprint di atas dan regresi terdampak perlu diulang.

### Riwayat audit awal dan rencana sebelum freeze

QA-PLAN-001 dan FIL-QA-003 selesai sebagai perencanaan; scalar/modal/Apply FIL-QA-001/002 superseded oleh
steering pemilik. Baseline awal HEAD di atas bersih pada awal audit; dokumen berikut mempertahankan fakta
pass/fail dan keputusan saat itu. Status pending/Open di catatan kronologis di bawah digantikan tabel retest
terbaru **hanya bila menyebut temuan/scope yang sama**. Riwayat Core dan masukan Designer tetap dipertahankan.

### Scope dan rencana berbasis risiko

Scope awal mengikuti CORE-002/PROJ-001; setelah pembaruan Product Lead, pemetaan aktif mengikuti **QA-PLAN-001 (P0), DEV-001/002 dan QA-REL-001**, dengan target template lokal. Projects menjadi fokus flow; auth/RBAC/BFF/audit menjadi regresi pengaman. Acuan: [produk](product.md#ukuran-keberhasilan-dan-gate-rilis), [backlog](backlog.md), [desain](design.md), [arsitektur](architecture.md#review-berisiko-tinggi-dan-skenario-qa), [keputusan](decisions.md), kontrak shared projects, [UI standard](standards/ui-standard.md) dan [design system](standards/design-system.md). Tidak menjanjikan isolasi tenant/ownership per project atau provider nyata.

| Skenario | AC / risiko | Metode dan cakupan | Status sesi ini |
| --- | --- | --- | --- |
| S4-01 | Gate produk 2; QA-REL-001 | `bun run check`: typecheck, lint, unit/integration/architecture; schema/migration drift, kontrak endpoint dan batas modul | **Lulus**, 1.528 tes; `S4/check.log` |
| S4-02 | Gate produk 1; DEV-001 | Arsip source HEAD pada salinan bersih → frozen install → env baru/setup/migrate/kedua seed → ulang setup dengan sentinel → dev startup/sign-in/CRUD/reload/delete | **Lulus**, lihat bukti quick start |
| S4-03 | Gate produk 3; PROJ-001 | `projects/tests/integration/projects.test.ts`, `tests/unit/rules.test.ts`, browser `projects.spec.ts`: CRUD/status, guard, duplicate, query invalid, UUID, literal search, concurrent create, activity/no-op | **Lulus** untuk suite; boundary normalisasi form **gagal S4-BUG-002** |
| S4-04 | Gate produk 3; QA-REL-001 | Browser `auth`, `security`, `permissions`, `reauth`, `own-role`; API auth/oauth/me/users/rbac dan BFF forward/auth-route tests | **Lulus** pada cakupan otomatis/mocks; provider nyata terpisah |
| S4-05 | Gate produk 3; PROJ-001 | `ux-patterns`, `responsive-data`, unit table state + probe projects: Apply atomik/page reset/chip/Back, saved view dan kolom setelah reload pada 1440/834/390; loading/empty/error+retry/stale/data | List **lulus**; edit stale **gagal S4-BUG-001**. `S4/probe.log`, `S4/list-probe.log` |
| S4-06 | Gate produk 3/4; DES-002 | Full browser responsive/a11y/light+dark; tambahan axe form new/edit pada 1440/834/390/360 (16 kombinasi) | Form tambahan **16 lulus**, tanpa overflow/serious/critical; full suite mempunyai **S4-TEST-001** |
| S4-07 | Gate produk 2; DEV-002 | Build produksi `.next-e2e`, budget script, lalu penjumlahan gzip byte tanpa rounding pada manifest yang sama | Build **lulus**; script exit 0 tetapi batas sebenarnya **gagal S4-BUG-003** |
| S4-08 | Gate produk 4; DES-001/002 | Read-only inventory Figma dan screenshot release index; visual form terhadap standar | Inventory/index **terverifikasi**; sign-off UX/visual Designer **belum diuji oleh role tersebut dalam sesi QA** |
| S4-09 | FIL-QA-001/002 → FIL-QA-003/004 | Rencana scope lama dipertahankan; delta Bifrost/multivalue di bawah | FIL-QA-001 selesai secara historis; FIL-QA-002 modal/Apply **superseded**, bukan pass/fail terbaru. FIL-QA-003 **Done**; FIL-QA-004 **Conditional**, menunggu kandidat/slot |
| S4-10 | OPS-001/002, INT-001 | Provider nyata, HTTPS/ingress, backup/restore, monitoring | **Terhalang** environment/akun/scope uji; di luar gate template lokal sesuai keputusan terbaru |
| S4-11 | Gate produk 5; QA-REL-001/REL-001 | Kandidat dibekukan, retest defect, review Designer, dokumen/distribusi dan keputusan Product Lead | **Belum diuji sebagai kandidat rilis final**; dependency belum selesai |

Unit/integration dipilih untuk kontrak, batas, lock/concurrency dan rollback yang perlu dapat diulang; browser untuk boundary BFF, persistensi flow, keyboard/responsif dan failure state. Screenshot ditinjau untuk temuan visual, bukan pengganti assertion atau persetujuan Designer. Probe yang mengubah data hanya memakai database QA terisolasi.

### Lingkungan, perintah dan hasil

macOS **27.2** (26B123), Node **24.21.0**, PostgreSQL **18.6 Homebrew**, Chromium **153.0.8010.12**. Bun host **1.4.4** berbeda dari pin; seluruh gate dan setup di sini memakai **1.4.3**, melalui `npm exec --yes --package=bun@1.4.3 -- sh -c '…'` atau binary yang di-resolve oleh perintah itu. Perbedaan host tidak disembunyikan sebagai bukti pinned.

API suite memakai database `_test`; Playwright normal memakai `_e2e` pada 3123/4123. Fault injection/probe memakai server 3223/4223 dan database tersendiri `_qa_session4_e2e`. Quick start memakai salinan `S4/fresh-checkout` dari `git archive HEAD`, database baru `_qa_session4_setup`, dev 3323/4323. Tidak ada reset database dev pengguna, deployment, perubahan Figma, atau patch produk.

| Eksekusi | Hasil / artifact |
| --- | --- |
| `bun run check` dengan wrapper pinned di atas | Exit 0; UI **729**, shared **10**, web **266**, API **523**; typecheck dan lint lulus. `S4/check.log` |
| `E2E_SCRATCH=qa-session4/browser` + wrapper pinned `bun run e2e` | Exit **1**, **324 pass / 1 fail / 96 skip**, 421 terdaftar, **11,6 menit**. Build produksi otomatis di awal lulus. `S4/e2e.log`, `S4/browser/test-results/` |
| Retest `sidebar-rail.spec.ts --project=desktop --repeat-each=3` | **6 pass**, termasuk kasus semula gagal **3/3**; tanpa perubahan source/assertion. `E2E_REUSE=1 E2E_PORT=3223 E2E_API_PORT=4223 E2E_SCRATCH=qa-session4/sidebar-retest`, wrapper pinned `bun run e2e …`. `S4/sidebar-retest.log` |
| `NEXT_DIST_DIR=.next-e2e` + wrapper pinned `bun run budget` | Exit 0, **22 route** dinyatakan lulus oleh script; **bukan bukti gate tepat-byte lulus**, lihat S4-BUG-003. `S4/budget.log` |
| `node .superpowers/scratch/qa-session4/budget-exact.mjs` | Exit **1**; `/users` **256.048 byte / 250,046875 KiB**, batas 256.000 byte. Berikutnya `/audit/auth` 255.358 (sisa 642 byte), `/audit/activity` 255.254 (sisa 746). `S4/budget-exact.json`, `S4/budget-exact.log` |
| Frozen install pada salinan bersih | Bun 1.4.3, `bun install --frozen-lockfile`: exit 0, **579 package / 8,31 detik**. `S4/fresh-install.log` |
| Setup baru dan ulang setup | Kedua setup exit 0; users **51→51**, projects termasuk sentinel **21→21**, sentinel tetap 1; kedua env tidak berubah saat rerun, mode file **0600**. `S4/setup-probe.mjs`, `S4/fresh-setup.log`, `S4/setup-results.json` |
| Startup salinan + smoke UI | `bun run dev`, port dialihkan agar tidak berbenturan dengan dev pengguna; sign in akun bootstrap, create → reload/read → archive → delete → GET 404 **lulus**. Startup+smoke **17.942 ms**, bukan total waktu onboarding. `S4/fresh-smoke.mjs`, `S4/fresh-smoke-results.json`, `S4/fresh-dev.log`, `S4/fresh-crud.png` |
| Probe state/boundary/form | `QA_BASE_URL=http://localhost:3223 QA_AUTH_STATE=.superpowers/scratch/qa-session4/probe-auth-state.json node .superpowers/scratch/qa-session4/probe.mjs`; observasi fail dipertahankan dalam JSON walau harness selesai exit 0. `S4/probes/results.json`, screenshots di folder yang sama |
| Probe kontrol list projects | `node .superpowers/scratch/qa-session4/list-probe.mjs`; filter/view/kolom diuji lewat UI; stale lewat respons BFF 500 terkontrol. `S4/probes/list-results.json`, `S4/list-probe.log` |

Waktu setup individual tidak diinstrumentasi terpisah. Smoke salinan memakai akun bootstrap dummy `qa.s4`, bukan akun pengguna. Probe create boundary menghapus kembali dua record yang dibuatnya (DELETE 200). Saved views probe berada hanya di DB QA. Artifact auth-state/trace lokal dapat memuat session; jangan menyalinnya ke source atau membagikannya tanpa redaksi.

#### Distribusi browser dan skip

| Project | Lulus | Gagal | Skip | Batas cakupan |
| --- | ---: | ---: | ---: | --- |
| desktop 1440×900 | 151 | 1 | 38 | Semua spec di-discover; kasus phone/touch khusus dilewati oleh kondisi suite |
| tablet 834×1112 | 62 | 0 | 37 | Hanya responsive/responsive-data/a11y sesuai config; kasus phone-only dilewati |
| mobile 390×844 | 111 | 0 | 21 | Suite viewport terpilih; navigasi sidebar desktop/no-flicker dan bagian galeri desktop dilewati |

Ke-96 skip berasal dari `test.skip` yang sudah ada (`phone only`, `tablet and desktop`, `tablet project only`, `desktop width`, sidebar desktop/tablet). Bukan tes lulus. Spec yang tidak masuk `testMatch` tablet/mobile juga **tidak dieksekusi**, tidak termasuk angka skip. Flow CRUD lengkap otomatis default hanya desktop; browser real-device/WebKit, screen reader manual dan seluruh kombinasi palette/density belum diuji. Tambahan form axe/overflow bukan sertifikasi seluruh WCAG.

### Pemetaan failure scenario arsitektur

Semua suite dalam tabel ini dieksekusi lewat full check/browser baseline; cakupan yang tertulis tidak memperluas klaim menjadi integrasi nyata.

| Invariant / kasus gagal | Suite/kasus yang memetakan AC | Hasil dan gap |
| --- | --- | --- |
| Internal token, raw path, body >64 KB, error tidak bocor, readiness DB down | `apps/api/test/app.test.ts`, kernel integration plugins/parse, health integration; web `forward.test.ts`/`auth-routes.test.ts` | Lulus. Outage lokal melalui test harness, bukan fault produksi |
| Query 400 sebelum guard; body setelah guard; UUID/existence 404; CSV formula; redirect/CSRF/origin | API architecture conformance dan projects/users/audit/oauth integration; web proxy/safe-path/forward/auth-routes; browser `security.spec.ts` | Lulus; tidak ada project export yang dijanjikan |
| Revoke/deactivate request berikutnya; escalation/actor rank; concurrent last Superadmin | auth sessions/guard, users/rbac integration; browser `permissions`/`own-role` | Lulus; tidak mengarang IDOR ownership project |
| Credential/session berubah saat menunggu lock; recent proof; replay recovery/TOTP/OAuth state | auth integration, me integration, oauth integration/id-token/transport; browser auth/reauth | Lulus dengan mock/stub. TLS dan perilaku provider nyata belum terbukti |
| Checksum migration, fresh/concurrent migrate, schema drift; atomic audit/rollback/no-op | `apps/api/test/db/{migrate,schema-drift,seed}.test.ts`, audit record dan projects integration | Lulus; restore/rollback aplikasi produksi belum diuji |
| API timeout/retry GET saja; chunk failure lokal; stale content dan retry | web backend tests, browser `no-flicker` chunk case, probe projects | Suite lulus; edit stale gagal S4-BUG-001 |
| Filter floating baru, race Apply, resize/collision, fokus | FIL-QA-001 di bawah | Belum dieksekusi terhadap implementasi baru; assertion gutter/header lama tidak membuktikan AC baru |

### Temuan reproducible dan status perbaikan

Severity mengukur dampak: S1 kritis (bypass akses/kehilangan data), S2 mayor (flow inti terhenti tanpa workaround wajar), S3 moderat (kegagalan terbatas/gate keliru dengan mitigasi), S4 minor visual/copy. Product Lead menentukan **prioritas**, bukan QA. Tidak ditemukan S1/S2 pada cakupan yang dijalankan; ini tidak membuktikan area di luar cakupan aman. Semua bug di bawah **Open, belum ada revisi perbaikan untuk diverifikasi**; owner penerima Developer melalui DEV-003, keputusan UX bersama Designer bila diperlukan.

#### S4-BUG-001 — Edit project menyembunyikan kegagalan refresh data

- **Task:** PROJ-001, DEV-003, QA-REL-001. **Revisi/lingkungan:** baseline Sesi 4 di atas, production build Chromium desktop 1440, server probe 3223/4223.
- **Prasyarat/data:** session Superadmin lokal, project demo `Apollo`; form edit telah memuat data. Tidak perlu mengubah record.
- **Reproduksi:** (1) Buka `/projects/<id>/edit`. (2) Buat GET browser `/api/projects/<id>` menjawab 500, JSON `{error:{code:"internal",message:"The request could not be completed. Try again."}}`. (3) Putuskan koneksi browser 11 detik (melewati staleTime 10 detik), lalu pulihkan. (4) Tunggu dua respons gagal termasuk retry.
- **Aktual:** form tetap memuat `Apollo`, tanpa notice kegagalan/stale. **Expected:** data lama dipertahankan dengan pemberitahuan stale yang dapat diketahui pengguna, sesuai `ui-standard.md` §3 dan AC lima state PROJ-001. Halaman detail pada kondisi sama menunjukkan “Couldn't refresh this project; showing the last loaded details.”
- **Severity S3:** pengguna tidak mengetahui data tidak berhasil diperbarui sebelum mengedit; belum dibuktikan kehilangan data. **Konsistensi:** 2/2 dalam run probe final; detail sebagai kontrol positif lulus.
- **Bukti:** `S4/probes/results.json`, `stale-edit.png`, `stale-edit-repeat.png`, `stale-detail.png`; source `features/projects/project-form.tsx` hanya merender Failure ketika error tanpa data, tanpa cabang stale notice saat data ada.
- **Workaround:** reload setelah layanan pulih. **Verifikasi penutupan:** ulang fault/reconnect pada revisi fix, pertahankan nilai/draft, tampilkan notice dan buktikan pemulihan; regresi detail/list. Belum ditutup.

#### S4-BUG-002 — Form menolak nama valid menurut normalisasi kontrak API

- **Task:** PROJ-001, DEV-003, QA-REL-001. **Revisi/lingkungan:** baseline dan server probe yang sama, desktop 1440.
- **Prasyarat/data:** session Superadmin; nama unik **100 karakter**, ditambah satu spasi di awal dan akhir (**102 raw**). `PROJECT_NAME_MAX=100`.
- **Reproduksi:** (1) Buka `/projects/new`. (2) Isi Name dengan data tersebut. (3) Klik Create project. (4) Bandingkan POST `/api/projects` memakai body nama mentah yang sama dan CSRF sah, lalu GET record hasilnya.
- **Aktual:** UI memberi “Use 100 characters or fewer.” dan tidak mengirim POST. API memberi **201**, GET memperlihatkan nama tepat 100 karakter setelah trim. **Expected:** form menerima input yang menjadi valid setelah trim, konsisten dengan `contracts/projects.ts` (`z.string().trim().min(1).max(PROJECT_NAME_MAX)`) dan save handler form yang juga melakukan trim.
- **Severity S3:** sebagian input valid terblokir hanya di UI; tidak ada bypass atau kehilangan data. **Konsistensi:** 2/2 dengan nama unik berbeda; dua GET memverifikasi persistensi, cleanup DELETE masing-masing 200.
- **Bukti:** `S4/probes/results.json`, `name-trim-boundary-1.png`, `name-trim-boundary-2.png`; `project-form.tsx` memakai `rules.maxLength` pada nilai mentah.
- **Workaround:** hapus spasi tepi secara manual. **Verifikasi penutupan:** input 100+spasi diterima, 101 karakter setelah trim tetap ditolak; periksa create/edit dan description tanpa mengubah kontrak diam-diam. Edit/description belum direproduksi sebagai bug terpisah.

#### S4-BUG-003 — Gate budget memberi false pass karena rounding sebelum compare

- **Task:** DEV-002, DEV-003, QA-REL-001. **Revisi/lingkungan:** build `.next-e2e` dari baseline, Node 24.21.0, gzip level 9; batas memakai satuan script sendiri, **250×1024 = 256.000 byte**.
- **Prasyarat:** production build selesai, manifest/chunks belum berubah. **Reproduksi:** (1) Jalankan `NEXT_DIST_DIR=.next-e2e bun run budget`. (2) Baca rootMainFiles + entryJSFiles unik dari manifest `/users`. (3) Jumlahkan gzip setiap chunk dengan level 9 tanpa rounding; reproducer `S4/budget-exact.mjs`.
- **Aktual:** script exit **0**, `/users` “250 kB / ok”; jumlah sebenarnya **256.048 byte = 250,046875 KiB**, **lebih 48 byte**. Script `apps/web/scripts/bundle-budget.mjs` membulatkan `kb` satu desimal sebelum `r.kb > budgetKb`.
- **Expected:** bandingkan nilai/byte tanpa rounding, pembulatan hanya untuk tampilan; route di atas 250 kB gagal sesuai AGENTS §9/gate produk 2. Jangan menaikkan batas atau memakai target ruang 245 kB sebagai requirement baru.
- **Severity S3:** dampak ukuran saat ini kecil, tetapi gate dapat menyatakan lulus pada pelanggaran batas. **Konsistensi:** 2/2 penjumlahan independen pada build sama, hasil identik. **Bukti:** `S4/budget.log`, `S4/budget-exact.json`, `S4/budget-exact.log`.
- **Workaround:** pemeriksaan tepat-byte independen; Developer mengurangi bundle hingga benar-benar memenuhi batas. **Verifikasi penutupan:** uji checker pada tepat batas dan sedikit di atas batas, build ulang, ukur semua route, lalu regresi interaksi terkait pemecahan bundle. Belum ada fix.

#### S4-TEST-001 — Tooltip Roles tidak muncul pada satu full browser run

Kategori **hasil gagal intermiten; belum terbukti bug produk reproducible**. Terkait QA-REL-001/DEV-003. Baseline/desktop di atas; session Superadmin → dashboard → Collapse sidebar → hover Roles → harapkan tooltip Roles sisi kanan. Assertion `sidebar-rail.spec.ts:14` gagal setelah 5 detik. Acuan: test tersebut dan aksesibilitas rail berlabel.

Full run: **1 gagal**. Retest file tanpa probe browser lain: **6 lulus**, kasus yang sama **3/3 lulus**. Tidak mengedit source, locator, assertion atau skip. Ada browser probe terpisah selama sebagian full run (database terpisah); hubungan kausal belum dibuktikan. Severity produk belum ditentukan. Jangan menyebut full run hijau atau menutup sebagai fixed. Workaround sementara: ulang diagnostik; itu tidak mengganti gate kandidat yang bersih. Bukti: `S4/e2e.log`, `S4/sidebar-retest.log`, `S4/browser/test-results/sidebar-rail-collapsed-sid-02a11-yboard-accessible-view-menu-desktop/{error-context.md,trace.zip}`. Developer perlu menilai timing hover/collapse/hydration dari trace, QA mengulang pada kandidat dalam kondisi serial.

#### S4-DOC-001 — Status migrasi desain berbeda antar sumber

Kategori **ketidaksinkronan dokumen**, terkait DES-001, owner Designer/Product Lead. Saat dibaca, `design.md`, backlog/DEC-005 lama menyebut pending/belum diterapkan; `standards/figma-versioning.md` mencatat selesai. Live metadata menunjukkan **17 page**: release index, **15 area v1.0.0**, archive; screenshot index menyebut baseline Approved. Bukti `S4/figma-release-index.png`, Figma session `85c8509b-ee82-495e-bac0-20fcdc6ed49a`, index node `146:2`. Tidak memverifikasi ulang semua master/token/lock/link atau menilai projects sebagai desain yang sudah disetujui. Expected: dokumen sumber selaras dengan bukti, bukan mengulang migrasi. Sebagian rekonsiliasi Product Lead sedang berlangsung; status DES-001/Designer tidak ditutup oleh QA hanya dari klaim dokumen.

### FIL-QA-003 — delta Bifrost, checkbox multivalue dan auto-apply

**Scope aktif**, handoff Product Lead atas steering pemilik 8 November 2026: hidden berupa rail vertikal kanan
berisi ikon/badge/Filters; open menjadi sidebar grouped **multiple checkbox**, **auto-apply tanpa Apply/radio**,
**Clear all immediate**. Desktop nonmodal tanpa scrim, sesuai konfirmasi Designer. Referensi pemilik adalah screenshot
lengkap `18.44.01` di Pictures/Screenshoot; Designer menyatakan telah membaca dua screenshot asli. QA belum
mengklaim pemeriksaan visual/runtime terhadap referensi baru. Designer memegang FIL-DES-002; [DEC-017](decisions.md#dec-017--sidebar-filter-bifrost-auto-apply-dan-multiselect)
dan [kontrak aktif](architecture.md#kontrak-filter-aktif--dec-017) telah dibaca. Expected Designer diterima langsung
untuk geometry/fokus/phone/live/error; ringkasannya di bawah. Dokumen/Figma rinci tetap milik Designer.

**Provenance desain final:** [design.md](design.md), heading **FIL-DES-002 — sidebar Bifrost, checkbox multi dan auto-apply**,
bagian A/B/C/D; [review Figma `190:5669`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=190-5669),
[sidebar `189:5892`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=189-5892),
[rail `189:5893`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=189-5893).
Designer menyerahkan referensi tersebut dengan status **In review**, bukan approval implementasi. QA mencatat
provenance dari handoff; belum menginspeksi ulang Figma atau membandingkan runtime baru pada langkah ini.

Pembaruan akhir Designer: [spec Figma `193:8299`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=193-8299)
melengkapi review `190:5669`. Designer melaporkan `sidebar-reviewed.png` (Clear all satu baris 60×18 dan divider),
`phone-reviewed.png` (koreksi Close terbaru), delapan viewport/enam state, 604 instance resolved tanpa raster,
dua prototype expand link serta `final-audit.json` dengan predecessor counts tetap. Ini **bukti Figma yang dilaporkan
Designer**, bukan pemeriksaan ulang QA atau pass runtime/E2E baru. QA tidak menjadikan ukuran contoh Clear all
sebagai pengecualian target coarse hit area. FIL-QA-004 tetap menunggu kandidat implementasi yang sama untuk
perbandingan runtime dan retest; scope FIL lama tetap superseded.

**Status FIL-QA-003: Done — matriks dan oracle siap**, bukan hasil pengujian. **FIL-QA-004 Conditional**, belum dieksekusi. Jangan meluluskan kandidat
modal/Apply scalar yang sedang dikerjakan sebagai scope Bifrost. Hasil S4 dan laporan Developer lama tetap berlaku
hanya untuk revisi/scope yang disebut; tidak dihapus atau diubah menjadi fail akibat perubahan requirement.
Bugfix form dan ACCOUNT-T01–06 tetap jalur terpisah; ulang hanya jika ada perubahan relevan/kandidat diserahkan.

| Area | Scope lama yang tidak lagi menjadi oracle aktif | Oracle baru yang sudah diotorisasi |
| --- | --- | --- |
| Closed/open | Launcher baris mandiri; modal/scrim/focus trap | Hidden menjadi rail vertikal kanan; desktop sidebar nonmodal tanpa scrim, bukan modal lama |
| Pilihan | Filter scalar/select/radio | Grouped checkbox multiselect; OR antar nilai dalam group, AND antar group, dikerjakan server |
| Commit | Draft lokal lalu Apply menutup panel | Checkbox auto-apply; tidak ada tahap Apply/submit atau radio filter. Search memakai debounce sesuai kontrak final |
| Reset | Reset all draft-only | Clear all langsung mengubah state/query; tidak menunggu Apply |
| Backend | Parser/value scalar | Multivalue melintasi kontrak, parser, query key, prefetch, service, saved view dan pengguna predicate CSV/bulk |

#### Matriks delta dan pembuktian

| ID | Skenario | Expected / evidence saat kandidat tersedia |
| --- | --- | --- |
| BIF-T01 | Direct API list dengan satu, dua dan beberapa nilai per group; kombinasi dua group; nilai yang sama berulang | Set hasil = OR-within/AND-across server, bukan filter current page di browser. Bandingkan ID fixture, total distinct, pagination dan sort; baris dengan dua role tidak muncul/dihitung dua kali |
| BIF-T02 | Pilih/deselect checkbox cepat A→A+B→B→kosong; search sedang debounce saat checkbox berubah | Nilai terpilih/URL/query terakhir konsisten; tidak ada lost toggle dari snapshot stale. Checkbox tidak menunggu Apply. Catat urutan event, URL dan request; kebijakan flush/preserve search mengikuti kontrak yang disepakati |
| BIF-T03 | Tahan respons A, selesaikan B lebih dulu lalu A; pending debounce lalu Back/saved view/chip/Clear all | State/rows terakhir tidak kembali ke respons atau timer lama. Clear all immediate tidak dibatalkan request/ketikan lama. Respons berbeda tidak salah memakai cache/query key yang sama |
| BIF-T04 | URL reload, server-prefetch dan client navigation dengan repeated singular keys, urutan/duplikat/encoding berbeda | Seluruh nilai dipulihkan; raw getAll pada allow-list menjaga comma/Unicode, bukan JSON decoder. Canonical equivalent set konsisten di query key/prefetch/browser; legacy singleton tetap diterima |
| BIF-T05 | Simpan/open/delete/Undo view multivalue, view lama scalar, Back/Forward saat checkbox/search berubah | Views/chips/selection memakai set yang sama; mutasi filter kembali page 1, sort/pageSize tetap. Jumlah history entry checkbox vs debounce mengikuti kontrak; tidak menambah scope intersepsi router global |
| BIF-T06 | Remove satu nilai chip, clear group jika disediakan, Clear all dari rail/open ketika request/search pending | Aksi menghapus scope nilai yang ditetapkan, UI/URL/request segera mengikuti; tidak membutuhkan Apply. Badge/chips tidak memakai draft scalar lama atau facet count palsu. Definisi badge dan cakupan Clear all dikonfirmasi Designer/Architect |
| BIF-T07 | CSV audit yang sudah didukung: group multi + search + time range, >1 page hasil | CSV memakai predicate server sama dengan JSON list, seluruh matching set dalam batas CSV existing, bukan hanya page yang tampil. Bandingkan fixture/identity tuple, count/duplikasi, pemisahan formula injection dan error/export permission |
| BIF-T08 | Users bulk `filter` multivalue setelah Select all matches, >1 page; selingi ganti filter dan response terlambat | Snapshot predicate yang dikonfirmasi sama dengan set list/server; semua match eligible diproses, nonmatch tidak disentuh. `done`/`skipped`, audit dan batas BULK_ALL_MAX tetap benar; selection/count lama tidak diam-diam memproses set lain. Tidak menambah bulk pada modul yang belum mendukung |
| BIF-T09 | Query/body unknown/empty/duplicate/tipe salah, mixed valid-invalid, repeats dan comma/Unicode/JSON-literal; body nested/nonstring array | Hook rawURL existing menjaga repeat hanya bagi enam key kategori; scalar lain tetap first value. Invalid enum/overlimit →400 sebelum guard query; bulk body mengikuti guard dahulu. Uji49/50/51raw dan boundary resmi |
| BIF-T10 | Search panjang/batas, banyak pilihan di beberapa group, opsi Role di page lain, literal `%`/`_`, empty-match | Server search tetap literal sesuai kontrak; pemilihan tidak dibatasi data current page. Batas query/body/paging/sort tetap enforced; opsi yang belum terambil tidak dinyatakan tidak ada |
| BIF-T11 | Default/hidden rail, open/collapse group, toggle pilihan, Clear all, close/reopen, navigasi antar halaman | Rail kanan dan ikon/badge/label dapat diakses; default/collapse/retention mengikuti FIL-DES-002. Tidak ada Apply/radio filter tersisa. Geometry/results width dan badge dinilai terhadap desain Bifrost final, bukan ukuran/modal lama |
| BIF-T12 | Desktop nonmodal: keyboard entry/Tab/return, Escape/outside, nested menu/role search, fokus saat rapid toggle/clear | Background desktop tetap dapat dioperasikan tanpa trap/inert/scrim modal lama; kontrol di belakang tidak tertutup fokus secara tidak terduga. Fokus/clickthrough/dismissal berdasarkan FIL-DES-002; nested layer tidak memicu aksi luar tanpa disengaja |
| BIF-T13 | Phone360/390, tablet834, desktop1440/1920; resize/open, long content, safe-area, light/dark/reduced motion | Tidak overflow/fokus tertutup; phone row+modal live tanpa footer tetap diregresikan. Posisi akhir setelah settleAnimations; anchor aktif **komponen konten pertama di bawah PageHeader (DEC-018/BIF-T13b)**, bukan shell header |
| BIF-T14 | Cold/failed chunk, list loading/empty/error/retry/stale setelah auto-apply, Role lookup gagal | Failure tidak dianggap opsi kosong/hasil valid, pilihan terakhir tidak hilang tanpa feedback. Recovery/fokus mengikuti desain; tidak menghidupkan lagi Apply/draft confirmation lama sebagai jalan pemulihan |
| BIF-T15 | Semua pemakai shared filter + galeri, API schemas/docs/architecture dan route budget | Perubahan server/FE/BFF/prefetch/query keys/views konsisten; unit/integration+browser terfokus lalu gate kandidat pinned. CSV hanya di route audit supported, bulk hanya users. Seluruh route dihitung tepat-byte; implementasi frontend saja tidak cukup |

**Fixture untuk membedakan OR/AND dan distinct:** dua role QA A/B, U1=A+active, U2=B+active,
U3=A+inactive, U4=B+inactive, U5=A+B+active, U6=tanpa A/B+active. Role `[A,B]` + status `[active]`
harus memberi **U1/U2/U5**; memilih kedua status memberi U1–U5, bukan U6. U5 dihitung sekali.
Wire role memakai nama sesuai kontrak; tambahkan role bernama literal `QA,A` untuk membuktikan tidak ada comma split.
Tambah cukup fixture di database QA agar match melintasi page; untuk bulk,
pakai user QA yang eligible dan verifikasi aturan self/rank/last-superadmin existing secara terpisah.
Tidak membuat record atau mengubah schema sekarang.

#### Delta suite, dependensi dan batas bukti

Reuse bukti S4 untuk perilaku yang belum berubah; buat regression baru pada predicate/parser multivalue dan
aliran data yang memang berubah. `filter-layout.test.ts`/browser filter lama yang menuntut Apply, radio scalar,
modal/inert dan focus trap tidak menjadi acceptance baru; penggantian assertion harus dijelaskan sebagai perubahan
requirement, bukan cara meluluskan test gagal. Unit set parser/serializer/history/query-key/prefs/views,
API module list/filter integration + bulk users/CSV audit, schema emission/conformance, lalu browser rapid toggle/race
dan rail/focus menjadi cakupan relevan. Full check/build/E2E kandidat dijalankan satu kali setelah scope/revisi/slot jelas.

#### Oracle kontrak dan interaksi aktif — melengkapi BIF-T01–15

| Area / kasus | Oracle final dari DEC-017/Designer | Batas yang perlu dibuktikan kandidat |
| --- | --- | --- |
| Wire/legacy (T04/09) | **Repeated singular keys role/status/module/action/event/method**. Legacy scalar = raw singleton; exact dedupe lalu **UTF-16 code-unit ordinal (default JS `.sort()`)**, omit group kosong. `queryValues(rawURL, allowlist)` menggantikan firstValues pada hook context existing | `role=QA%2CA&role=日本` mempertahankan dua nama literal; `role=["Admin"]` tetap nama literal, **tidak JSON-decode**. Query key/prefetch/CSV/view melestarikan seluruh nilai. Scalar nonallowlist seperti page/q tetap first value |
| Empty/all (T01/09) | Absent, empty scalar legacy dan array kosong = unrestricted group; elemen array string kosong ditolak. Semua status dipilih tetap tersimpan sebagai checkbox/URL meski hasil setara unrestricted | Empty array bukan `IN ()`; all-values tidak diam-diam dihapus dari URL/view. Beda antara tidak membatasi dan query sah tanpa match |
| Limit/type/unknown (T09/10) | Max **50 raw values per field sebelum dedupe**; enum invalid/overlimit →400 sebelum guard GET; body array nested/nonstring ditolak. Valid unknown role/action ≤64 →kosong; role matching insensitive tetap | Uji49/50/51raw termasuk51dupes→1; mixed invalid,64/65, empty array element/nonstring/nested/null body. Role comma/Unicode/JSONliteral tidak split/decode. UI menjelaskan pilihan ke-51, selalu boleh uncheck/Clear; tidak menciptakan global cap |
| Server/export/bulk (T01/07/08) | OR within/AND across; list/count/CSV/BulkUserFilter role/status memakai predicate multi sama; assignRole body `role` **tetap scalar** | Users role/status; projects status; permissions module; activity action; auth event/method. Distinct/count/bound query/check-order/caps tetap. Regresi wajib melalui `createApp`/kernel context production dan BFF route nyata Bun1.4.3; bare Elysia coercion bukan oracle |
| Search/history (T02/03/05) | **300 ms debounce/search REPLACE**; Enter/blur/collapse flush; checkbox flush search terbaru+toggle one PUSH/page1; Clear PUSH bila state berubah. Back/view/chip/external/Clear cancel timer | Virtual timer batas300ms + flush/cancel dan browser sequence; latest state merge saat rapid toggle. Ini oracle final DEC-017, menggantikan pesan/draft200ms atau search PUSH |
| Clear all (T03/06) | Search+semua category menjadi kosong, cancel timer, input terlihat kosong, page1; sort/pageSize/header time/refresh tetap. Enabled juga untuk search yang masih pending | Jika applied URL sudah default dan hanya pending text dibersihkan: tidak ada redundant history/request. Jika applied berubah: immediate commit/push. Jangan menjalankan flush lama setelah clear atau menghapus date range navbar |
| Saved view/prefs (T04/05) | **Named-view server max4096 karakter** diotorisasi; preference remembered view **tetap300 per halaman**. Over300 menghapus remembered lama halaman itu + notice/fallback named-view, tanpa truncate/memperbesar cookie | Uji prefs299/300/301 dan named-view4095/4096/4097; ≤4096 save/open roundtrip, >4096 Save gagal recoverable sementara URL/filter tetap berfungsi. Tidak diam-diam mengingat filter lama saat query baru >300; prefs halaman lain tidak ikut dihapus |
| Badge/chip/group (T06/11) | Badge = jumlah checkbox terpilih +1 jika **applied search** nonempty; date range tidak dihitung. Chip per opsi; group summary selection aktif, tidak ada Any/radio/Apply. Zero choices = unrestricted | Search visible pending tidak menaikkan applied badge sebelum accepted; hapus satu chip menjaga sibling. Group expanded awal, independent collapse retained locally. Tidak ada record/facet count yang dihitung dari page |
| Desktop geometry (T11/13) | Rail width48/**collapsed height hug-content (DEC-019)**, panel320/clearance64; **first visible content surface sesudah PageHeader**, termasuk Notice pertama, jadi anchor tanpa extra gap. Scrollbound `max(16,contentTop,visiblePageHeader.bottom)` | Collapsed tidak bottom-fill; expanded memakai tinggi tersedia/bottom16. Bandingkan anchor dan layout closed/open dengan authorized scroll; title/actions bebas. Tidak ada scrim/trap desktop atau shellheader anchor lama |
| Desktop fokus (T12) | Selection menjaga open. Explicit X/Escape → rail+focus launcher; exposed-page pointerdown menutup dan **aksi target tetap dijalankan**. Focus-out menutup sebelum kontrol belakang tertutup saat paint, mempertahankan fokus target | Tanpa stealing focus ke launcher pada outside/focus-out; target action tepat sekali. Nested role/select layer dioperasikan tanpa unintended collapse/aksi luar |
| Phone/resize (T13) | <768 horizontal Filters+badge sebelum hasil, bukan vertical rail/clearance; modal fullwidth bottom sheet max90dvh, **tanpa Apply/footer**; autoapply selection tetap open; X/Escape/outside close+restore launcher | Initial modal entry heading fokus. Resize menjaga open/search/groups/values dan field fokus; phone→desktop menghentikan trap, outside focus berikutnya collapse. Bila field hilang/skeleton/group hidden, fallback heading |
| Continuity feasibility (T13) | **Satu visible controls tree**, CSS posisi; semantic modal/nonmodal boleh remount inner content. Fokus dipulihkan ke field yang sama lewat stable ID; bukan syarat object DOM identik | Jangan meluluskan dua tree/focus trap bersamaan, tetapi jangan menolak remount yang mempertahankan state/fokus. Listener matchMedia di effect untuk semantics diterima Designer, bukan layout matchMedia dalam render |
| Opsi/recovery (T10/14) | Group-local search bila >6 catalog options; role options server-paged, Load more hanya bila server menyatakan more. Selected off-page tetap dapat dihapus. Lookup loading/error lokal dengan Retry; group lain/Clear tetap operable | Error bukan options kosong sah, tidak implicit deselect atau reset. Setelah GET hasil gagal, checked/URL tetap; previous rows+Updating/error/Retry, latest snapshot menang tanpa full-list blocking |

**Finalisasi kontrak sudah diselaraskan:** [DEC-017](decisions.md#dec-017--sidebar-filter-bifrost-auto-apply-dan-multiselect)
memuat klarifikasi eksplisit **repeated singular keys, hook rawURL allowlist, search300ms REPLACE, checkbox/Clear PUSH,
named-view4096/prefs300**. Proposal pesan plural JSON-array string **dibatalkan** setelah audit production boundary
yang memang menormalkan query sebelum zod. Draft200ms dan pesan history search PUSH juga bukan oracle aktif.
QA membaca ulang keputusan/architecture terbaru; pesan sementara yang berpotongan dicatat sebagai riwayat spesifikasi,
**bukan defect produk**. Developer harus membuktikan behavior melalui hook production, bukan hanya parser/union pada bare Elysia.
Jangan mengganti radio form domain, theme/density, atau saved-view picker: scope checkbox hanya category list filters.
Masalah spesifikasi baru yang muncul dari runtime dikembalikan ke role pemilik, tidak diasumsikan lulus/gagal sendiri.

Klarifikasi istilah DEC-017: canonical ordering adalah **UTF-16 code-unit ordinal**, bukan strict Unicode-scalar
order atau locale collation. Perbedaan urutan karakter astral terhadap comparator Unicode-scalar bukan bug pada
kontrak ini. Exact dedupe dan order yang sama pada URL/query-key/view tetap oracle; **tidak meminta comparator baru**.
Product Lead menyatakan behavior source tidak berubah; comment/prose-only correction masuk fingerprint akhir,
tanpa rerun runtime semata-mata untuk label tersebut. Run serial final yang sedang berjalan tidak diambil alih QA.

**Estimasi QA bersyarat:** FIL-QA-003 sekitar **0,5 hari fokus**; FIL-QA-004 sekitar **1,5–2,5 hari fokus** untuk
kontrak/server/browser dan satu siklus retest, total **2–3 hari**, di luar waktu tunggu kandidat/defect baru.
Gate final yang sama dengan QA-REL-001 dipakai bersama, tidak dihitung/run dua kali. Ini estimasi effort,
bukan tanggal atau komitmen kapasitas. Fokus pertama predicate/wire/race dan rail/live; polish non-blocking tidak
menunda pembuktian kontrak yang sudah siap. Estimasi direvisi bila scope/candidate berulang berubah.

**Koordinasi terbaru:** Developer diberi tahu steering supersede sebelum retest; paket filter berikut harus menyebut scope
DEC-017 dan fingerprint kontrak/server/UI. Developer melaporkan broad regression scope lama selesai dan slot
`.next-e2e`/server **bebas**, tetapi source API multivalue masih WIP dan **belum candidate freeze**. QA tidak
memulai build/tes. Rencana `.next-qa-fil`/3223/4223/`_qa_fil_e2e` tetap perlu handoff kandidat dan kesepakatan slot.
Tidak ada run/build/reset database pada pembaruan ini.
S4-BUG-001/002/003, DES-002A/B dan ACCOUNT-T01–06 tetap tracked; tidak diulang tanpa perubahan/paket relevan.
Developer melaporkan broad regression lama **314 pass / 95 skip / 0 fail (9,8 menit)**, artifact bernama
`final-browser.log`; full check pinned sebelum API multi **1.530 pass** (UI730/shared10/web267/API523).
Keduanya scope lama/bugfix/account, bukan kandidat final rail/live multi atau retest independen QA. Laporan lanjutan
22 test API/helper dan 2 test codec shared juga bukan full gate source multivalue terbaru. Path/fingerprint lengkap
dibutuhkan pada paket kandidat. Angka ini tidak menimpa full E2E S4 awal yang gagal atau menutup S4-TEST-001 sendiri.

**Laporan WIP scope baru berikutnya dari Developer — belum candidate freeze:** API **535 pass**, UI **730 pass**,
shared **12 pass**, web **266 pass / 2 fail** pada expectation canonical order prefs. Browser rail pertama:
**8 pass** desktop/tablet dan **4 fail** phone pada assertion `aria-modal`; Developer melaporkan menambah atribut
tersebut sesudah kegagalan, tetapi **retest fix belum diserahkan kepada QA**. Jangan mengubah run awal menjadi pass
atau menyamakan laporan trap/Close dengan bukti atribut/semantik sudah benar. Update expectation prefs hanya dapat
diterima bila sesuai canonical-order DEC-017 dan tetap membuktikan roundtrip/dedupe/encoding/cap; tidak cukup karena
hasil aktual berbeda. Build WIP dilaporkan `/users` **256.697 byte**, **697 byte over**; budget tetap gagal dan NO-GO
tidak berubah. API/render-wrapper/global-query payload masih berubah; QA tidak mengambil slot atau menjalankan
build/tes sampai paket source/build yang dibekukan dan retest terkait tersedia. Semua angka di paragraf ini berasal
dari laporan implementor, bukan pengujian independen QA.

Laporan Developer berikutnya, **pre-anchor DEC-018**: `rail-regression.log` **272 pass / 82 skip / 2 fail**;
traces awal dipertahankan di `rail-regression-failures/`. Developer mengoreksi oracle Back ketika search sudah
replace sebelum checkbox push, dan melaporkan bug remembered-cookie: SSR `views={}` tetapi halaman yang sedang
ditinggalkan masih menulis cookie lama sesudah request baru; over300 sebelumnya early-return `undefined` sehingga
tidak memaksa clear. Fix yang dilaporkan memakai remembered empty-string eksplisit, **belum diretest QA**.
Tidak menggabungkan angka run berbeda atau mengubah dua fail awal menjadi pass. Kandidat tetap belum freeze.
Product Lead kemudian meneruskan laporan **2 targeted pass**; itu dicatat terpisah, tanpa full green atau
verifikasi QA atas source kandidat. Path/revisi/case lengkap diperlukan sebelum menilai penutupan.

Tambahan **BIF-T05a**: bedakan (A) checkbox flush search yang masih pending sebagai satu push dengan (B) search
sudah REPLACE sebelum checkbox PUSH; pada (B), Back **boleh/harus mempertahankan search snapshot sebelumnya**,
bukan selalu menghapus search. Tangkap urutan URL/history/commit aktual, jangan mengasumsikan posisi timer.
Tambahan **BIF-T05b**: uji hard/client navigation ke query >300 ketika effect/prefs write halaman lama terlambat;
sesudah SSR, hydration, navigasi ulang dan reload, remembered value lama untuk path itu benar-benar cleared
tanpa loop cookie writes, tanpa menghapus prefs halaman lain dan tanpa memotong URL. Named view ≤4096 tetap bisa
disimpan. T05b adalah target retest bug yang **dilaporkan Developer**, bukan reproduksi independen QA pada tahap ini.

Tambahan **BIF-T05c wajib pada `/audit/activity` dan `/audit/auth` aktual**: Product Lead/Developer menemukan
adapter `AuditTable.onApply` masih memaksa push dan mengabaikan `options.history` dari pola Apply lama. Developer
melaporkan regression red-before-fix sedang dikerjakan/serial; QA belum mengeksekusinya. Search `user`300ms harus
REPLACE, checkbox action/event/method PUSH, dan checkbox yang mem-flush search pending tetap satu PUSH snapshot.
Uji Back sesudah search sudah commit vs masih pending seperti T05a, Clear/external state cancel timer serta range/sort/
pageSize tetap. Capture actual URL/history/request sequence kedua route: Projects saja atau unit FilterLayout tidak
membuktikan adapter audit benar. Source fix/hasil red-post harus ada pada paket kandidat, bukan diasumsikan lulus.

#### DES-FIL-002A — riwayat expected offset, superseded DEC-018

**Status terbaru: perubahan expected / superseded**, bukan fixed atau verified. Steering pemilik melalui Product Lead
mengganti anchor global shellheader-bottom+16 menjadi komponen konten pertama di bawah PageHeader. Hipotesis
scope CSS dan observasi Designer berikut tetap sebagai riwayat yang benar untuk expected saat itu; jangan menutup
temuan sebagai fix produk atau menjalankan BIF-T13a lama untuk meluluskan kandidat terbaru. Severity QA tidak
pernah ditetapkan dari reproduksi independen. Acceptance aktif ada pada **FIL-ANCHOR-001 / BIF-T13b** berikut.

Masukan Designer setelah meninjau **10 screenshot rail baru**: pada Projects desktop/tablet, panel tampak top128.
Catatan awal Designer menyebut top72 dari56+16, lalu dikoreksi karena mengabaikan shell inset8: contoh header
`y8+height56` mempunyai bottom64, sehingga top panel80. **Oracle bukan hardcode72/80**, melainkan
`max(16, actualHeaderBox.bottom + 16)`, juga saat header offscreen. Designer menilai dampak sedang;
**severity QA belum ditetapkan** pada saat review tersebut.
Hipotesis source: root `--topbar-h`112, override56 ada pada `.app-shell` tetapi tidak diwarisi portal.
Product Lead mentriase **P1, wajib sebelum visual acceptance**; ini prioritas produk, bukan severity QA.
QA membaca `tokens.css`, `base.css`, `filter-panel-impl.tsx` dan `top-bar.tsx`; source tersebut konsisten dengan risiko
scope custom property, **bukan bukti browser baru atau konfirmasi bahwa setiap route mempunyai tinggi header sama**.
Developer sudah diberi tahu Designer; tidak ada patch yang ditutup hanya dari source.

Skenario **BIF-T13a historis, tidak dieksekusi**: ukur bounding box chrome **`[data-shell-header]` yang benar-benar rendered**,
rail dan expanded panel pada posisi akhir, initial scroll yang sama. Bandingkan top panel/rail dengan
`max(16, headerBox.bottom+16)`, bukan tinggi header saja atau token root. Mulai pada `/projects` tanpa time controls dan `/audit/activity` atau `/audit/auth` yang
memiliki kontrol waktu; ulang desktop1440/1920 dan tablet834, light/dark/reduced motion serta setelah resize.
Jangan memakai `getComputedStyle(...--topbar-h)` sebagai expected karena dapat mengulang bug yang sama. Catat
header `{y,height,bottom}`, panel/rail `{y,height,bottom}`, viewport dan URL; ulang perubahan viewport/header/scroll,
termasuk header offscreen dengan min16, tanpa kehilangan fokus. Measurement scoped filter diizinkan Designer;
jangan mengubah token global hanya untuk menyamakan portal. Pastikan clearance bawah/fokus serta
kontrol aksi tetap terjangkau. Jika expected scroll/chrome baru ambigu, minta Designer sebelum menetapkan fail.

#### FIL-ANCHOR-001 — BIF-T13b aktif, posisi di bawah PageHeader

**Sumber:** revisi pemilik yang diteruskan Product Lead, menuju DEC-018/FIL-DES-003. Rail dan open panel filter
berada **di bawah PageHeader, top sejajar komponen konten pertama** (contoh Permissions card/table), sehingga
title dan action **Add permissions** tidak tertutup. Oracle ini menggantikan seluruh rumus shellheader/72/80/min16
lama. Kontrak multivalue/API/auto-apply DEC-017 tetap; tidak perlu mengulang seluruh gate WIP karena perubahan posisi.

**Detail final Designer yang diterima langsung:** anchor adalah **first visible outer content surface** sesudah
PageHeader: card/table/KPI, atau **Notice bila mendahuluinya**; bukan thead, bukan global header. Rail/panel memakai
bbox.top surface yang sama, tanpa tambahan16. Saat scroll, top dibatasi `max(16,contentTop,visiblePageHeader.bottom)`;
batas PageHeader hanya melindungi area judul/aksi, bukan kembali menjadi sumber anchor. Bila content masih di bawah
viewport, rail belum muncul. `/ds` memakai owning demo content. Right/bottom16, widths48/320 dan constant end
clearance64 tetap. Track scroll/layout/resize/async Notice/font reflow tanpa mereset state/fokus; phone tidak berubah.

**Provenance FIL-DES-003:** Designer melaporkan patch Figma **v1.0.3 masih dikerjakan**, page `203:8491`,
[review `203:9242`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=203-9242),
[spec `203:9335`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=203-9335), dengan 13 contoh
rail/open sejajar contentTop, Permissions actions, compact short-height dan retained scroll. QA belum
menginspeksi ulang Figma atau menguji runtime dari bukti itu. Portal rail ke body diterima Designer sebagai
feasibility untuk menghindari transform containing block motion normal; QA tidak mewajibkan struktur DOM tertentu,
tetapi ANCHOR-T03 tetap mengukur posisi/fokus saat transisi dan setelah settle/resize. Tidak ada perubahan API.
Patch/angka contoh ini bukan approval implementasi; expected80/shellheader lama tetap **superseded, bukan fixed**.

| Kasus | Langkah kandidat FIL-QA-004 | Expected / bukti |
| --- | --- | --- |
| ANCHOR-T01 | `/permissions`: ambil actual first visible outer surface bbox, PageHeader/title/action bbox, closed rail dan open panel bbox setelah settle | Top rail/open sama dengan surface saat tidak ter-clamp, selainnya scrollbound final. Jangan memakai thead/token/global header. Catat rect+scroll offsets, width/layout closed/open tetap; authorized short-height scroll boleh mengubah viewportY |
| ANCHOR-T02 | Pointer dan keyboard ke Add permissions serta action header route lain, sebelum dan sesudah filter dibuka | Action dapat diaktifkan/fokus tanpa tertutup rail/panel; desktop nonmodal collapse/aksi target tidak dicuri. Title/description tidak disamarkan. Opening dialog dari header menampilkan dialog yang benar, bukan klik filter yang salah sasaran |
| ANCHOR-T03 | Ulang desktop1440/1920, tablet834, light/dark, resize saat open dan reduced motion | Anchor/state/fokus konsisten, tidak ada horizontal overflow, kontrol trailing tetap terbaca/terjangkau. Settling posisi tidak menghapus assertion gangguan fokus selama transisi |
| ANCHOR-T04 | Scroll owning page/panel, PageHeader multiline; tambahkan/hapus async Notice sebelum card/KPI, loading/error dan font reflow | Notice yang lebih dahulu menjadi anchor; setelah hilang surface berikutnya diukur ulang. `max(16,contentTop,visiblePageHeader.bottom)` melindungi header tanpa extra gap. Tidak ada fokus/state reset atau anchor thead; content di bawah viewport belum memunculkan rail |
| ANCHOR-T05 | Projects non-time, Permissions dan audit time-controls routes | Semua memakai anchor komponen konten, bukan tinggi navbar atau keberadaan time control. Snapshot memberi lokasi komponen aktual yang dipakai Developer, bukan locator CSS root yang mengulang implementasi |
| ANCHOR-T06 | Phone360/390, buka/tutup sheet, multi check/Clear/Back, focus dan resize desktop↔phone | Regresi phone sesuai final FIL-DES-003; anchor desktop tidak memunculkan rail penutup card actions atau footer/Apply lama. Multivalue/auto-apply tetap, tidak membuat requirement API baru |
| ANCHOR-T07 | Hitung `availableH=dvh-anchorTop-16` saat **explicit open**, uji <160/160/>160; contoh dvh400/contentTop170 | <160: controlled scroll owning content ke safeTop16, ukur/posisikan lagi **sebelum heading focus**; reduced motion instant. Contoh400/170 memberi214, jadi tidak auto-scroll. Ini scroll, bukan reflow. availableH tidak lagi menentukan mode height collapsed (FIL-DES004/DEC019) |
| ANCHOR-T08 | Tempat yang tidak bisa memperoleh ruang tambahan; open lalu collapse setelah short-height scroll | Tidak mengangkat panel menutupi PageHeader atau menambah modal desktop; safe anchor/body scroll/Close tetap terjangkau. Collapse tidak men-scroll halaman kembali. State, selections, search dan fokus tetap sesuai aksi yang dilakukan |
| ANCHOR-T09 | `/ds`/halaman panjang dan viewport height399/400; cold/warm+reduced, resize, keyboard focus pada rail offscreen | Old availableH44..159 compact dan <44 hide/notTab **superseded**, bukan fixed/retag-pass. ≥md viewportH≤399 CSS compact44, ≥400 normalHUG, stabil sebelum paint/hydration. Rail tetap DOMowning surface/naturallyclipped, tidak ariahidden/inert karena offscreen. Nativefocus boleh scrollownsurface, tidak hoist/reparent; resize mode berubah sengaja sambil menjaga nilai/fokus |
| ANCHOR-T10 | Saat panel open, scroll sehingga owning anchor sepenuhnya ke bawah fold; ulang saat fokus di dalam dan sudah di luar panel, dengan search pending | Panel collapse dan flush search sesuai kontrak; state/group/selection tetap. Fokus luar dipertahankan tanpa dicuri; jika fokus sebelumnya di dalam, pindah ke PageHeader heading yang terlihat. Tidak auto-scroll melawan scroll pengguna atau fokus ke rail tersembunyi |

Kandidat harus menyebut anchor component/ref atau locator yang stabil dan scope revisi DEC-018; QA mengukur node
konten aktual, bukan membandingkan nilai CSS yang berasal dari rumus offset yang sama. Expected Notice/KPI,
scroll/clamp/short-height dan phone telah dijawab Designer; dokumen/Figma final tetap milik role tersebut.
**Belum ada tes baru atau bug reproduksi QA** untuk anchor ini; FIL-QA-004 menunggu kandidat dan slot serial.

#### Gap bukti visual yang tetap aktif

**Gap sign-off visual:** kesepuluh capture yang ditinjau Designer menunjukkan **open sidebar dengan group Status
collapsed**. Itu tidak membuktikan default rail, badge ketika hidden atau expanded group dengan beberapa checkbox
checked. Paket kandidat perlu bukti rail default tanpa pilihan, rail dengan pilihan/badge, dan sidebar group expanded
dengan ≥2 opsi group yang sama checked, berikut label/badge/chip, Close/Clear dan width/layout hasil tetap.
Catat authorized short-height scroll agar perubahan viewportY tidak salah dilaporkan sebagai reflow.
Ambil pasangan closed/open viewport yang sama, sampling phone360/390 dan tablet/desktop light/dark. Pilihan kedua
harus tetap open/terlihat dan all-status selection tidak hilang walau hasil setara unrestricted. Screenshot melengkapi,
bukan mengganti assertion server/race/a11y. Designer belum memberi full visual sign-off; laporan **12 test lulus**
tetap diatribusikan Developer, bukan QA. Tidak ada build/browser/run tambahan untuk menindaklanjuti laporan ini
sebelum kandidat dan slot serial tersedia.

#### DEC-019 — collapsed hug-content, ikon sidebar dan refresh tanpa flicker

Steering pemilik mengganti **collapsed rail full-height** menjadi **hug content** (ikon/badge/Filters/padding),
toggle desktop mengikuti keluarga `SidebarCollapseIcon`/`SidebarExpandIcon` existing, bukan chevron/glyph baru.
Expanded height, anchor DEC-018, API/multivalue/auto-apply tetap. FIL-DES-004 menetapkan detail geometry/motion,
FIL-COLLAPSE-001 implementasi dan FIL-REFRESH-001 diagnosis/fix. Phone mengikuti desain existing kecuali koreksi
spesifik Designer. Aturan collapsed bottom16/full-height lama **superseded**, bukan defect yang otomatis fixed.
Compact/short-height harus diselaraskan dengan desain hug-content baru, tidak dipakai untuk membenarkan rail kosong.

**Oracle FIL-DES-004 diterima langsung dari Designer:** collapsed width48, tinggi intrinsik actual toggle+
filter icon+badge opsional+label vertikal Filters+padding (`py3`/`gap3` existing), **tanpa bottom16/h-full/min-height/
flex stretch** pada rail. Expanded320/tinggi tersedia dan anchor DEC-018 tidak berubah. Right filter **regular** collapsed
expand-left memakai **SidebarCollapseIcon (=PanelLeftOpen, left glyph)**; expanded collapse-right memakai
**SidebarExpandIcon (=PanelLeftClose, right glyph)**. Nama export tidak menentukan arah; aksi tetap Expand filters /
Collapse filters, Phone Close tetap X. Tidak ada keluarga ikon atau custom chevron baru.

SSR/hydration/refresh/client route harus mulai collapsed pada first surface yang benar, hug height/count/theme sama,
tanpa first-frame expanded/full-track/top16 fallback, reparent jump atau hide/show loop. Rail tidak mendapat mount
pop/fade/translate saat refresh. Motion token hanya untuk open/collapse eksplisit; reduced motion tanpa spatial move.
Jika insertion awal yang belum dapat diukur tak terhindarkan, Designer hanya menerima satu insertion statis yang
**sudah benar** dengan slot64 stabil—bukan paint salah lalu dipindah atau hide/delay untuk menghilangkan bukti.
Ini bukan izin menghapus seluruh motion aplikasi atau mengabaikan first paint yang tidak terekam.

**Feasibility arsitektur yang diizinkan Product Lead/Designer:** collapsed rail dapat memakai CSS sticky dalam
transparent right lane di owning first-surface wrapper (termasuk Notice), stable inline SSR DOM lintas width;
expanded portal baru diukur saat user open. QA menilai hasil/continuity, tidak memaksakan struktur internal.
Wrapper tidak boleh menghalangi pointer/fokus PageHeader/table atau membawa rail ke section `/ds` tak terkait.
**Compact final:** pada desktop≥md gunakan **CSS viewport height≤399 untuk compact44, ≥400 untuk normalHUG**.
Ini mengganti JS availableH-based collapsed-height mode lama; jangan mem-paint normal/full-height lalu mengganti
compact sesudah hydrate. Uji cold/warm399/400 normal+reduced; resize melewati threshold boleh mengubah mode
dengan sengaja sambil menjaga fokus/nilai. Actual availableH<160 tetap dipakai **hanya saat explicit open** untuk
controlled scroll/expanded anchor, bukan memilih tinggi collapsed. Owning bounds tetap, tanpa hoist ke PageHeader.

Compact visual final: **48×44**, filter icon16 di atas CountBadge18 dengan gap2, terpusat dan cukup ruang samping
untuk2–3 digit; tanpa badge, icon terpusat. Compact menyembunyikan toggle glyph/label vertikal tetapi nama aksi/count
tetap aksesibel. Regular kolom py12/gap12 dengan glyph sidebar16+filter16+badge18 opsional+label44 menghasilkan
sekitar156/126 termasuk border, **bukan height CSS fixed**. HUG-T02 menguji ikon sidebar pada regular/expanded;
compact tidak gagal hanya karena glyph disembunyikan.

**Offscreen final:** aturan JS `availableH<44` untuk hide/notTab juga **superseded**, bukan fixed/retag pass.
Stable CSS rail tetap pada DOM owning surface, secara alami offscreen/clipped sampai surface masuk; tidak diberi
aria-hidden/inert semata-mata karena offscreen. Keyboard focus boleh native-scroll owning surface ke viewport,
tanpa hoist/reparent top16 ke section lain. Hanya CSS viewportH≤399 menentukan compact; measurement JS diizinkan
saat explicit open. Cold SSR/hydration tidak menambahkan visibility switch untuk menutupi geometry yang salah.

**Provenance FIL-DES-004 final, In review:** [review `211:10924`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-10924),
[handoff `211:11089`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-11089),
[variants `213:10336`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=213-10336).
Designer melaporkan sampel statis Permissions1440, Projects834,1920 dan phone360/390 sesuai anchor/actions/layout;
regular156/126 dan compact44 adalah referensi desain, bukan klaim pass seluruh runtime QA.

Designer juga memeriksa clean cold900 runID **1794143657945**, frame005/settled + JSON: own rail animation none /
opacity1, sedangkan startup ancestor masih teramati sampai settled sekitar456,5ms. Itu **review Designer atas sampel
capture**, bukan pemeriksaan/reproduksi QA baru atau bukti bahwa seluruh ancestor bebas animasi. Manifest saat itu
dilaporkan `sourceRevision:null` dan Developer masih mengoreksi border, sehingga **belum final candidate/visual approval**.
Field null itu sendiri bukan alasan menolak paket jika identitas source/build dapat dibuktikan lewat fingerprint yang
setara; mapping kandidat terakhir tetap harus diperiksa setelah freeze. QA-EVID-001/QA-FIL-001 belum ditutup.
Crop galeri icon catalog/suffix blank yang disebut Designer tidak dipakai sebagai bukti filter atau bug filter baru.

**Pembaruan review galeri:** Designer telah melihat keempat `gallery-filter-{desktop,mobile}-{light,dark}.png`
dan menerima closed layout: rail card-aligned/HUG, launcher phone horizontal dengan stacked cards, sort terbaca.
Review ini terbatas source sebelum koreksi border terakhir; fingerprint ada di
`.superpowers/scratch/designer/filter-hug/runtime-partial-review.json`. Itu bukan approval visual kandidat final.
Index Linux lama source `7c8e93…`/compact46 yang disebut Designer tidak dijadikan bukti final compact44.

**Paket Linux pengganti, belum handoff QA:** Developer melaporkan
`.superpowers/scratch/developer-session-3/final-artifacts/refresh-linux-index.json` berisi delapan run unik,
runtime-source SHA256 `7baa40b391212ceb142afe667b7882705bdf98930561f420d27b5a5d0b66f117`,
build `pPqSrrRBoEB-UWyhRGPFX`, arsip probe eksekusi SHA256
`4fcba2d6e9a35182b0985873e606f24c99c69b4bf429693938f93f41cf0b6b17`.
QA membaca index tersebut: ringkasan cold/warm pada tinggi399/400/900 memuat delta0, regular sekitar126/156,
compact44, satu node, own animation none dan timestamp READY→SETTLED. Validasi seluruh file/SHA, metadata
nav/CDP/ancestor, own opacity1/transform none, serta `frozen-linux.log` **36 pass** dan budget `final-linux`
masih **laporan Developer**, belum hasil pemeriksaan lengkap/eksekusi independen QA. Pembersihan unused local
sesudah capture dilaporkan lint-only; kaitan probe arsip dan source terakhir tetap diperiksa saat handoff.
Mac final13 targeted dan final check masih berjalan menurut Developer. Kandidat belum dinyatakan freeze dan
slot serial belum diserahkan; QA tidak meluncurkan runtime. QA-EVID-001 dan QA-FIL-001 tetap Open sampai
review paket konsisten dan verifikasi fix yang disepakati selesai.

**Keputusan Designer atas Linux final:** **ACCEPTED untuk supplied Permissions rail/refresh matrix** pada
source/build di atas. Designer melaporkan audit delapan manifest, exact JPEG set, seluruh SHA dan probe cocok;
visible delta0, satu node/copy, H126/156/44 stabil, own motion none sampai sesudah SETTLED. Designer melihat
delapan settled serta cold/warm900 frame005 dan menerima layout/icon/badge/anchor/actions; startup ancestor
dinilai terpisah. Bukti review: `.superpowers/scratch/designer/filter-hug/final-linux-refresh-review.json` dan
`docs/design.md`. Ini **penerimaan desain pada scope Linux tersebut**, bukan eksekusi QA independen atau
approval implementasi menyeluruh. Mac/QA/release masih pending; Figma tetap **In review**. Status temuan QA
belum diubah hanya berdasarkan keputusan Designer ini.

**Laporan flicker:** pengguna melihat flicker saat refresh. Hipotesis source dari Product Lead adalah SSR top16,
inline→body portal reparent dan anchor baru diukur belakangan. QA membaca WIP `filter-panel.tsx` yang saat itu
memiliki initial position `{top:16,room:1000}` dan server portal-null/client body, **tanpa menyatakan itu akar masalah
visual yang terbukti**. Perubahan DOM sebelum paint dapat tidak terlihat; source saja tidak membuktikan frame flicker.
Reproduksi runtime ulang independen QA belum dilakukan; review artifact red berikutnya menetapkan **QA-FIL-001/S3**
di bawah. Jangan menganggap snapshot setelah ready sebagai bukti first-paint/hydration mulus.

| ID | Regresi FIL-QA-004 / data | Expected dan bukti kandidat |
| --- | --- | --- |
| HUG-T01 | Closed rail no filter lalu badge aktif; ulang pada dua tinggi desktop normal dengan isi sama, tablet dan compact-height final | Tinggi intrinsik isi+py3/gap3, tidak available viewport/bottom-fill/h-full/min-height stretch. Width48/anchor tetap; label/badge/focus ring dan target coarse terjangkau. Tidak menambah angka tinggi fixed baru |
| HUG-T02 | Bandingkan toggle collapsed/open desktop dengan sidebar existing; keyboard/pointer open→collapse berulang | Collapsed expand-left SidebarCollapseIcon/PanelLeftOpen; expanded collapse-right SidebarExpandIcon/PanelLeftClose. Action labels/expanded state/count aksesibel sesuai desain, Phone Close=X. Expanded tinggi tersedia, collapse kembali hug tanpa mutasi filter/focus-scroll reset/ruang kosong |
| HUG-T03 | Resize, short available room, active badge panjang, reduced motion, phone regression | Hug rail tidak menutup PageHeader/row actions; overflow/compact rule mengikuti FIL-DES-004. Anchor/authorized short scroll DEC-018 tetap. Phone row/sheet tidak dipaksa menjadi rail desktop atau mendapat footer/Apply lama |
| HUG-T04 | Jika memakai sticky lane: klik/fokus kontrol header/table dekat lane kosong dan trailing actions, scroll owning wrapper dan section `/ds` lain; tambah/hapus Notice/reflow | Lane transparan tidak menangkap pointer atau tab stop; header/table action bekerja tepat sekali, rail dibatasi owning content/section yang benar. Tidak menutup action atau berpindah anchor karena wrapper baru; closed/open result layout tetap |
| REFRESH-T01 | Cold context/cache dan warm reload normal; halaman Permissions, Projects, Users serta audit time-controls; filter default dan repeated URL aktif | Rekam dari first SSR paint→hydration→ready, bukan hanya networkidle. Tidak ada rail salah anchor/full-height sesaat, blank/blink, duplicate tree atau jump posisi/badge/selection saat data sudah sama. PageHeader actions tetap bebas |
| REFRESH-T02 | Cold/warm pada light/dark dan persisted prefs; desktop1440/tablet834/phone390+360, sampling reduced motion | Theme/palette/density/filter/prefetch yang sama terlihat konsisten dari paint awal. Tidak ada hydration warnings. Legitimate pre-paint mutation tidak disalahklasifikasikan sebagai flicker; frame yang benar-benar terlihat harus mendukung temuan |
| REFRESH-T03 | Pasang frame/DOM probe sebelum script; capture rail/anchor/PageHeader/results rects, visible nodes/parents/mount-remount, root theme/prefs dan relevant list reads | Timeline bertimestamp menghubungkan paint, hydration, remount/portal, anchor measurement dan data read. Rect relatif anchor/layout penting, bukan hanya CLS (fixed-position jump bisa tanpa CLS). Bedakan font/Notice reflow yang diikuti anchor secara sah dari jump rail independen |
| REFRESH-T04 | Diagnostic pre/post dengan JS/chunk lambat secara terkontrol jika diperlukan, selain baseline network normal | Bukti kausal sebelum/sesudah fix memisahkan SSR/CSS, hydration/remount, theme dan query/prefetch. Kondisi diagnostic dilabeli, bukan target perf baru. Ready screenshot atau pass generic no-flicker dengan threshold gap saja tidak cukup |
| REFRESH-T05 | Aktifkan toggle pada cold/slow first load, lalu ulang user open/close normal dan reduced motion | Intent bekerja tepat sekali; tidak hilang/double replay, focus aman. Motion open/collapse pengguna mengikuti token; reload tidak dipoles dengan timeout, hide-until-measured, opacity delay atau fade untuk menyembunyikan gap/jump |
| REFRESH-T06 | Bandingkan first filled region dan request list dengan prefetch/query key canonical, lalu reload URL/view panjang dan state multivalue | Data SSR yang valid tidak diganti skeleton/reset filter karena lost params/key mismatch. Record relevant request/prefetch, state dan frames; background reads yang sah dibedakan dari duplicate hydration read. Tidak mengorbankan session/guard/prefetch demi hilangnya flash |

**Metode/batas:** reuse instrumentation `no-flicker.spec.ts` dan geometry/helpers yang relevan; tambah pengamatan
khusus rail sejak sebelum script/paint agar generic fade/gap threshold tidak menutupi kegagalan ini. Simpan raw frame
timeline/filmstrip atau trace, bukan hanya screenshot setelah `settleAnimations`; settling hanya untuk **geometry akhir**,
tidak untuk menghapus interval yang sedang diuji. Jika first paint tidak berhasil direkam, tandai keterbatasan bukti,
bukan menyimpulkan pass. Jangan menambah timeout, skip, opacity/fade/hide atau menghapus assertion agar hasil hijau.

Developer diminta **targeted repro/pre-post trace + source fingerprint/build/route/state** dan slot/kandidat terbaru.
Slot/freeze belum diserahkan pada pembaruan ini; QA tidak menjalankan build/full suite WIP. Hasil hipotesis dan
laporan pengguna tidak dijadikan severity/fix tanpa reproduksi dan oracle Designer. Rerun backend/form/account
hanya bila diff atau kandidat yang sama membutuhkannya; perubahan rail ini tidak memperluas API.

Laporan awal Developer bahwa `filter-refresh.spec.ts` baru disiapkan disimpan sebagai urutan pekerjaan; **run red
berikutnya sudah selesai**, lihat QA-FIL-001 di bawah. Probe cold/warm4×CPU,rAF3500ms memakai
rail/anchor rect delta,parent/portal,visibility,timestamp; trace/first-paint capture masih akan dilengkapi.
Window3500ms bukan alasan menyatakan pass bila fase ready belum terekam, dan DOM movement sebelum paint bukan
sendiri bukti flicker. QA meminta phase markers dan frame/trace pre/post yang benar-benar terlihat. Developer
juga melaporkan check **1.547 pass**; broad browser lalu dihentikan graceful pada **99 pass / exit130** karena
steering DEC-019. Itu **run terhenti, bukan full pass** atau kandidat final;
angka/aktivitas ini laporan implementor, **bukan gate kandidat baru atau verifikasi QA**. Slot serial belum dilepas
untuk QA; fix/sticky proposal tidak dianggap terbukti hanya dari izin arsitektur atau test yang belum run.

##### QA-FIL-001 — rail bergeser selama cold/warm refresh (review bukti red)

- **Task:** FIL-REFRESH-001, FIL-QA-004; status **Open / fix belum diverifikasi**. **Severity QA S3** berdasarkan
  bukti visual: posisi/bentuk kontrol berubah saat halaman mulai dapat dilihat, mengganggu keterbacaan/target aksi;
  belum ada bukti kehilangan data, bypass atau kegagalan klik tertentu. Prioritas tetap milik Product Lead.
- **Revisi:** HEAD `2ba4b9fd892fbe585bf2087dc1dd5fc9f812078f`, product-source SHA256
  `2561ac83a22a820424289742b75adaadc64e6512aea86b618dbf78afcf7c7e9a`, dari
  `.superpowers/scratch/developer-session-3/refresh-red-fingerprint.json`. WIP sesudahnya bukan snapshot red ini.
- **Lingkungan/data:** automation Developer, Chromium desktop1440×900,4×CPU, light, session seed yang dapat
  membuka `/permissions`; cold cache disabled dan warm reload terpisah. Versi binary/runtime lengkap perlu
  dibawa paket kandidat; QA tidak mengklaim menjalankan browser ini sendiri.
- **Reproduksi yang dijalankan Developer:** pasang init rAF/frame probe dan screencast sebelum navigation;
  cold→`/permissions`, warm→visit lalu reload; rekam sampai sesudah hydration. Log `refresh-red.log` berisi
  **2 fail**, masing-masing maximum anchor delta seharusnya≤1px tetapi sekitar58px.
- **Aktual dalam artifact yang QA baca:** cold200/warm204 samples; setelah mengecualikan sample zero-area,
  masing-masing199/203 positive-area. First styled rail `x1344,y116,w48,h868`, anchorTop174 → **delta−58**;
  final cold `x1376,y162,h722` dan warm `x1376,y156,h728`, delta0. Node identity1→2→3 tetapi `copies=1`
  seluruh sample: **remount/reparent evidence, bukan tiga launcher bersamaan**. Flag `visible=true` pada0×0
  initial sample tidak membuktikan paint; kesimpulan didukung positive-area data dan painted filmstrip.
- **Expected:** dari first visible SSR frame ke hydration/ready, rail benar pada owning anchor dan tidak melompat
  posisi/bentuk/remount yang terlihat; height hug final diuji terpisah sebagai revisi DEC-019. Ini bukan alasan
  mereklasifikasi expected anchor lama sebagai fixed atau menutupi pergerakan dengan fade/hide/delay.
- **Bukti/review QA:** JSON cold/warm, log dan fingerprint di folder Developer di atas; QA melihat
  `refresh-red-artifacts/refresh-cold-8.jpg` vs `refresh-cold-20.jpg`, yang memperlihatkan rail berpindah dari
  sisi area header ke kanan konten setelah ready. **Reproduksi automation milik Developer; pembacaan/verdict
  artifact milik QA**, bukan run browser independen QA. Consistency2/2 pada kondisi throttled tersebut;
  kondisi network/CPU normal, dark/tablet/phone dan fix sesudahnya belum terverifikasi QA.
- **Diagnosis/workaround:** Developer mengaitkan inline→body portal dan deferred-root subtree remount dengan
  pergeseran; timeline/style/parent mendukung jalur itu tetapi post-fix proof tetap wajib. Sementara menunggu
  fix, pengguna dapat menunggu ready sebelum memakai kontrol; itu bukan penyelesaian produk. CSS-sticky stable
  wrapper disetujui sebagai pendekatan, **belum dinyatakan fixed**. Retest target REFRESH-T01–06 termasuk399/400,
  focus/paint aktual; wrapper node count stabil saja tidak cukup.

**Pembaruan readback Product Lead:** refresh spec terbaru merekam initScript/rAF sejak navigation dan mengassert
**semua frame terlihat**, bukan hanya sample `ms>=READY`; READY hanya memastikan pengambilan data berlanjut sampai
sesudah primitive ready. Pertahankan pemeriksaan first SSR/hydration dan frame sebelum READY; sample zero-area
tetap dibedakan dari painted evidence, bukan alasan membuang frame nyata awal. QA belum menjalankan ulang spec.

Developer melaporkan **32 focused pass sebelum perubahan CSS badge-gap/md-min-height terakhir**. Source berbeda
berarti angka itu **tidak menutup QA-FIL-001** atau meluluskan kandidat terakhir. Run final Mac/Linux masih **direncanakan**
pada source terakhir, dengan artifact/fingerprint per platform; belum dicatat sebagai pass. QA dapat memakai gate
kandidat akhir yang sudah dibuktikan dengan **atribusi implementor**, setelah memeriksa kesamaan source/build/runtime/
scope dan bukti fail/skip. Regresi independen QA yang terfokus tetap dilakukan pada kandidat sama; jangan menjalankan
ulang full gate tanpa perubahan/failure/gap yang membenarkannya, dan jangan menyebut laporan Developer sebagai run QA.
Budget resmi tetap **semua route raw gzip≤256.000 byte**; target kerja245KiB bukan gate baru. Headroom kecil pada
route/OS mana pun dilaporkan sebagai risiko tersisa dengan angka tepat, bukan dibulatkan lulus atau disembunyikan.

##### QA-EVID-001 — paket postfix JPEG/JSON belum dapat dikorelasikan

**Kategori: masalah konsistensi/kelengkapan evidence, bukan bug produk baru.** Designer meninjau
`sticky-first-artifacts` dan melaporkan cold8/warm10 hug pendek tetapi cold20/warm21 full-height; JSON terakhir
height128. QA membaca folder tersebut secara read-only dan melihat `refresh-cold-8.jpg` vs `refresh-cold-20.jpg`:
bentuk/icon/tinggi rail berbeda, sementara JSON cold `{ready:388,frames:16}` berakhir pada height128 dan warm
`{ready:320.6,frames:15}` berakhir sekitar128. Tidak ditemukan file run-manifest di folder pada pemeriksaan ini.
mtime berdekatan tidak membuktikan timestamp capture/navigasi; indeks JPEG dan indeks rAF bukan otomatis frame sama.
Pembandingan byte read-only menemukan cold20 dan warm21 pada folder postfix **identik** dengan file bernama sama
di `refresh-red-artifacts`: SHA256 cold20 `c25aca360ba0aaeede83082de7f5ac98439c827afb3abcb057f810fcac4f9fd2`,
warm21 `3693c45524fdf86a966c90ba82b0eac74253da99f9b6851918a17974529e505f`. Ini memperkuat kebutuhan provenance
run, bukan membuktikan bahwa produk postfix menampilkan frame tersebut pada run terbaru.

**Status: verifikasi postfix QA-FIL-001 terhalang sampai evidence run bersih tersedia.** Stale JPEG tail dari folder
reuse adalah hipotesis, bukan kesimpulan produk masih flicker atau tuduhan artifact sengaja diubah. Jangan memilih
hanya JSON delta0/onecopy atau hanya JPEG tanpa provenance untuk menyatakan fixed/regresi baru. Red artifact yang
sudah mendukung QA-FIL-001 tetap dipertahankan, tidak dihapus atau ditimpa.

Developer diminta unique clean output folder/runID dan manifest: source/test-probe fingerprint + build/runtime/OS/
viewport/cache/CPU/filter/theme; navigation ID/performance timeOrigin dan phase markers; daftar **file frame yang
benar-benar dihasilkan run itu** dengan hash dan capture timestamps yang dapat dipetakan ke rAF JSON/trace.
Catat jumlah/urutan cold dan warm terpisah, first paint→hydration→primitive ready→settled, termasuk data sebelum
READY. Retain raw capture dan jelaskan frame yang bukan navigasi tersebut; jangan membuang frame gagal berdasarkan
bentuknya. Lengkapi opacity/visibility/transform/animation ancestor dan rail serta paint evidence: attachment/delta0
saja tidak membuktikan tidak ada pop/fade/blink. Bila early/ready frame tidak terekam, nyatakan coverage gap.

Tidak ada browser/build/tes QA baru dalam review ini. Pemeriksaan evidence bukan retest fix, dan QA-FIL-001 tetap
**Open/S3**; kandidat/slot independen tetap menunggu paket yang konsisten. Owner perbaikan paket: Developer;
Designer mengulang visual review pada paket yang sama sebelum approval implementasi.

**Paket final yang cukup untuk memulai verifikasi QA:** format/nama field boleh mengikuti tooling Developer;
yang wajib ialah keterlacakan berikut, bukan membuat schema/format artifact baru semata-mata untuk QA.

1. **Satu identitas run/OS/build:** runID dan folder baru yang kosong saat capture dimulai, platform/runtime
   (Bun/Node/PostgreSQL/Chromium), source fingerprint dengan daftar/algoritme file yang dicakup, test-probe fingerprint,
   build ID, waktu mulai/akhir. Cold/warm diberi navigation ID berbeda; viewport/DPR/theme/prefs/query/cache/CPU tercatat.
2. **Manifest file yang benar-benar dihasilkan run:** relative path, jenis artifact, hash/ukuran dan counts JPEG/PNG,
   rAF JSON, trace, log serta final screenshot. Tidak memakai glob folder lama sebagai daftar run. Catat frame index,
   navigation ID dan capture timestamp beserta pemetaan ke performance timeOrigin/rAF/trace; urutan cold/warm jelas.
3. **Timeline utuh:** first SSR paint→hydration→primitive ready→natural settled, dengan phase markers/predicate yang
   dapat diperiksa di probe. Semua frame terlihat **sebelum dan sesudah READY** tetap ada; READY bukan cutoff assertion.
   Sertakan rail/anchor/PageHeader/results rects, node/copies/parent, opacity/visibility/transform/animation ancestor,
   hydration console/page errors, dan final screenshot yang waktunya dapat dicocokkan dengan JSON. Raw capture tidak
   dibuang karena memuat frame gagal; coverage gap fase yang tidak tertangkap dinyatakan, bukan disebut pass.
4. **Hasil dan scope source sama:** command lengkap, pass/fail/skip/exit code, assertion/angka mentah, expected
   DEC-017/018/019 dan perbandingan pre/post source yang relevan. Final Mac/Linux masing-masing diidentifikasi;
   source yang berubah sesudah run tidak otomatis mendapat status hasil lama. Budget raw setiap route dan headroom
   dirujuk ke build yang sama; target245KiB tidak mengganti hard gate256000 byte.
5. **Kondisi handoff:** Developer menyatakan kandidat dibekukan dan slot/server/database terisolasi yang disepakati
   siap dipakai QA. Source behavior fix belum diterima hanya dari manifest. QA memverifikasi hash/coverage/mapping
   file secara read-only lalu menjalankan regresi independen terfokus pada kandidat yang sama; gate final lain dapat
   dipakai dengan atribusi Developer bila identitas/scope buktinya cocok.

**Keputusan QA-EVID-001:** bila manifest unik dan mapping/coverage final sudah valid, **reuse paket itu**, tidak
meminta recapture/full rerun tanpa gap. Bila file tidak dapat dipetakan, bercampur run lain, atau first/ready/settled
yang diperlukan hilang, minta **targeted recapture bagian terkait** dengan identitas baru. Artifact lama tetap dijaga,
tidak overwrite/delete; dugaan stale-tail tidak berubah menjadi vonis produk flicker atau fixed. Product Lead
menerima isu evidence ini; QA-EVID-001 baru dapat ditutup setelah paket konsisten direview, sementara QA-FIL-001
tetap Open/S3 sampai fix diverifikasi pada scope yang disepakati. Tidak ada run QA baru pada pembaruan checklist ini.

### Riwayat FIL-QA-001/002 — scope modal/scalar/Apply superseded

**Bukan acceptance aktif setelah steering Bifrost menuju DEC-017.** Seluruh tabel/keputusan berikut disimpan sebagai
riwayat perencanaan FIL-QA-001/002 saat modal/scalar/Apply masih disetujui; kata “final”/“Done” di bagian historis
berlaku pada scope saat itu. Jangan menjalankan retest scope lama sebagai pembuktian FIL-QA-003.
Hasil baseline gutter lama juga tetap hanya bukti revisi awal, bukan desain baru.

| ID | Skenario dan expected yang sudah jelas | Metode / status |
| --- | --- | --- |
| FIL-T01 | Document load dan client navigation pada semua pemakai FilterLayout: panel closed, termasuk URL berfilter; launcher berlabel/expanded=false di luar header tab/Panel toolbar; badge/chip applied tetap terbaca | Browser + inspeksi DOM; **belum diuji implementasi baru** |
| FIL-T02 | Buka/tutup panel desktop: floating kanan, lebar/bounding box hasil tetap; fokus/kontrol di belakang inert; reopen tidak menghapus filter | Ukur box sebelum/sesudah, screenshot light/dark 1440/1920; oracle Designer di bawah; **menunggu implementasi** |
| FIL-T03 | Ubah search/scalar status, close lalu reopen: draft tetap lokal, URL/data belum berubah; Apply commit semua endpoint/field sekaligus dan page ke 1; reset mengikuti kontrak | UI + request/URL capture; variasi response lambat dan Apply tepat setelah ketikan terakhir; **belum diuji baru** |
| FIL-T04 | Selama Apply lambat: Back, pindah saved view, hapus chip/clear; snapshot applied terbaru menang, respons terlambat tidak menimpa URL/draft | Controlled latency/request order; tanpa menambah facet count/multiselect; **belum diuji baru** |
| FIL-T05 | Tab/Shift+Tab trapped, Escape/X/klik luar menutup tanpa Apply dan fokus launcher; open/collapse kelompok dan keyboard field; error expand grup | Oracle Designer dikonfirmasi di bawah; **belum dieksekusi** |
| FIL-T06 | Phone 360/390, tablet 834, desktop 1440/1920, resize saat open, konten panjang, bottom/safe-area, collision/scroll; touch target dan focused item tidak tertutup | Chromium light/dark, axe serious/critical, screenshot; **menunggu revisi** |
| FIL-T07 | Cross-module users/projects/roles/permissions/activity/sign-in log + galeri memakai pola bersama; URL/scalar API/saved views/date controls tetap; tidak ada overflow atau initial JS melebihi batas | Architecture/full check, E2E terkait, production build + budget tepat-byte; **menunggu revisi** |

#### FIL-QA-001 — paket uji untuk koordinasi Designer/Developer

Diperinci 8 November 2026 setelah handoff Product Lead, acuan **DEC-014** dan kontrak minimum pada
[arsitektur](architecture.md#kontrak-ui-dan-review-filter). Ini rencana pengujian perubahan, **bukan hasil FIL-QA-002**.
QA-PLAN-001 tetap Done dengan pemetaan S4-01–11 dan failure scenario di atas; QA-REL-001 tetap Conditional.
Tidak ada alasan menjalankan ulang 1.528 tes atau quick start hanya untuk menyusun dokumen ini.

**Kondisi source:** HEAD masih `2ba4b9f`. FilterLayout yang dibaca masih `open=false`, desktop gutter sticky,
launcher di Panel toolbar, narrow-screen sheet. Itu bukti baseline, bukan kegagalan implementasi FIL-DEV-001
yang belum diserahkan. Developer sedang mengubah checker budget/test pada working tree bersama; hasil S4 lama
tidak mengesahkan perubahan tersebut. Klaim fix S4-BUG-003 sudah diterima, **status QA tetap Open / menunggu retest**.

| Kasus rinci | Data / langkah inti | Oracle dan bukti untuk FIL-QA-002 |
| --- | --- | --- |
| FIL-T01a — initial/URL | Buka dokumen baru, reload dan client navigation, URL tanpa filter lalu dua filter aktif | Panel tertutup; launcher berlabel, `aria-expanded=false`, di luar tab/header/Panel toolbar; chips/badge mencerminkan applied URL, bukan draft. Simpan DOM ancestry, URL dan screenshot |
| FIL-T01b — state terbuka | Aktifkan launcher dengan pointer dan Enter/Space; tutup, buka kembali | Expanded/control relationship sesuai elemen panel aktual; tidak ada trigger terselubung di header lama. Open/close tidak menghapus filter atau membuat request Apply |
| FIL-T01c — cold primitive/fields | Context dingin: tahan/gagalkan chunk modal, Retry filters, batalkan intent atau pindah halaman sebelum load selesai; setelah shell siap ulang slow/error lazy fields/Role lookup | Sebelum primitive tersedia: launcher busy + `Loading filters`, failure + `Retry filters` di baris launcher, belum ada scrim/inert/trap dan navigasi tetap tersedia. Late chunk tidak membuka panel pada halaman/intent yang sudah ditinggalkan. Setelah shell ready: loading/error/Retry berada dalam modal dengan Close terjangkau; error Role tetap dalam group, tidak mereset nilai atau menyamarkan failure sebagai opsi kosong |
| FIL-T02a — lebar hasil | Pada viewport dan applied state yang sama, catat bounding box results sebelum/open/closed setelah `settleAnimations` untuk posisi akhir | Lebar hasil tetap (toleransi pengukuran ≤1 CSS px, bukan izin perubahan layout). Catat angka mentah dan screenshot; hasil tidak terdorong ke kiri oleh gutter. Tetap uji fokus selama transisi, resize dan reduced motion; settling tidak menggantikan/menghapus assertion |
| FIL-T02b — layer/collision | Buka dekat top/bottom halaman, scroll, buka select/combobox/popover, fokus aksi yang mungkin tertutup panel | Panel kanan mengikuti anchor/offset/layer spesifikasi Designer; field/aksi/fokus dapat terlihat dan dioperasikan. Expected modal/inert/dismissal belum ditebak QA |
| FIL-T03a — draft vs applied | Ketik search dan ubah scalar status/role/module; tutup lalu reopen tanpa Apply | Draft bertahan dalam halaman; URL, request list dan applied badge/chips tetap nilai lama. Collapse kelompok tidak menghapus nilai jika grouping digunakan Designer |
| FIL-T03b — reset dan Apply | Reset draft, periksa URL belum berubah; isi lagi, ketikan terakhir langsung diikuti Apply; mulai dari page 2 dengan data cukup | Reset belum mengubah applied state; Apply mengirim seluruh draft yang dinormalisasi sekaligus, page menjadi 1, pageSize/sort tetap. Jangan menambah request per-keystroke untuk draft |
| FIL-T04a — acknowledgement | Unit harness menunda publish nilai applied A; setelah Apply A ketik draft B, lalu publish acknowledgement A | Draft B tetap. Bedakan acknowledgement props/URL dari respons GET lambat; keduanya punya jalur kegagalan berbeda. Extend regression `filter-layout.test.ts` yang sudah ada |
| FIL-T04b — external state/race | Dengan panel/draft aktif, lakukan Back, buka saved view berbeda, hapus chip/clear; tahan GET A, selesaikan GET B, lalu lepaskan A | URL/applied terbaru menang; external state mengganti draft sesuai kontrak. Rows/chips tidak kembali ke A karena respons terlambat; Back bisa mengembalikan view sebelumnya |
| FIL-T05a — keyboard/dismissal | Tab/Shift+Tab dari launcher, ubah field dengan keyboard, Escape/close; ulang dari nested menu yang sedang terbuka | Focus ring/nama/state terlihat; Escape nested menu tidak sekaligus membuang draft/menutup lapis lain tanpa aturan. Tujuan fokus dan click-outside mengikuti keputusan Designer, bukan asumsi focus trap |
| FIL-T05b — error/recovery | Terapkan filter yang hasilnya kosong, lalu injeksikan GET 500/timeout, delay dan reconnect; coba Retry | Empty dibedakan dari error; loading/pending, stale rows/notice dan retry tetap recoverable. Applied URL/chips tidak hilang karena error; tidak mengarang hasil atau count |
| FIL-T06a — viewport/resize | 360/390 phone, 834 tablet, 1440/1920 desktop; uji batas 767↔768 dan 1279↔1280 saat open | Tidak ada horizontal page scroll, panel keluar viewport, overlay ganda atau fokus tertinggal pada elemen tersembunyi. Oracle final Designer: satu DOM mempertahankan open/draft/fokus saat breakpoint |
| FIL-T06b — konten/touch | Konten/label panjang, banyak opsi, viewport pendek, scroll sampai footer; light/dark dan reduced motion | Kontrol/aksi/fokus tidak tertutup; target coarse ≥44 px dan input touch ≥16 px mengikuti standar. Safe-area/footer/collision dibandingkan dengan spesifikasi, axe serious/critical dicatat terpisah dari pemeriksaan manual |
| FIL-T07a — pemakai bersama | Smoke semua pemakai pada tabel di bawah; users dan projects menjalankan alur state/race lengkap | Perilaku sama lewat komponen bersama; permission, action toolbar, columns dan saved views tetap bekerja. Hindari menyatakan seluruh produk lulus hanya dari satu route |
| FIL-T07b — batas teknis | Bandingkan request/query sebelum-sesudah, review diff kontrak/dependency, build dan budget tepat-byte | Scalar tetap scalar; tidak ada field/count facet/endpoint baru. Badge active-filter tidak disamakan dengan total hasil. Date/refresh audit tetap di navbar; CSV memakai applied filter. Budget ≤256.000 byte gzip per route |

Data uji hanya akun seed dan database khusus QA: users dengan >1 page, project Active/Archived, query tanpa hasil,
nama/label panjang yang diizinkan kontrak, dan saved view dengan **query berbeda** agar pembuktian view tidak rancu
oleh dua nama yang mewakili state identik. Sebelum memakai page 2, buktikan jumlah fixture cukup. Role Superadmin
untuk seluruh pemakai, Viewer untuk smoke izin/menu existing; ini bukan perubahan permission atau tenancy.

| Pemakai / path | Field baseline yang wajib dipertahankan | Minimum sampling perubahan |
| --- | --- | --- |
| `/users` | q, role scalar, status scalar; RoleSearch bila opsi perlu dicari | T01–07 lengkap di tiga viewport; keyboard/search opsi, grouping dan error |
| `/projects` | q, status Active/Archived | T01–07 lengkap; ulang state/Back/saved view yang sudah punya probe S4 pada komponen baru |
| `/roles` | q | Default closed, satu field tetap layak, Apply/chip/Back, width dan keyboard di tiga viewport |
| `/permissions` | q, module scalar | Default closed, scalar/module/chip dan permission smoke; width/focus tiga viewport |
| `/audit/activity` | user, action; time range tetap terpisah | Default/Apply/action/chip, date/refresh tidak berpindah, satu export dengan applied filter; width/focus tiga viewport |
| `/audit/auth` | user, event, method; time range tetap terpisah | Default/Apply kombinasi scalar/chip, date/refresh/export; width/focus tiga viewport |
| `/ds` contoh FilterLayout | query, status, role contoh lokal | Cocokkan komponen/state/keyboard, viewport, light/dark, axe dan baseline visual yang memang berubah |

**Peta reuse dan gap automation:** `packages/ui/src/ds/filter-layout.test.ts` sudah mencakup draft/Close,
Apply terbaru, badge/chip/clear, acknowledgement lambat dan external values. `apps/web/tests/e2e/responsive-data.spec.ts`
sudah mencakup Apply/page reset/chip/Back dan phone sheet; assertion gutter desktop sekitar baris 40–42
harus diganti menjadi pengukuran lebar stabil setelah desain diterapkan, bukan dihapus tanpa pengganti.
`ux-patterns.spec.ts` dan probe S4 membuktikan saved views/kolom baseline; `responsive.spec.ts`,
`a11y.spec.ts`, deferred overlay tests, table-state/query/prefs tests tetap diregresikan sesuai diff.
Gap baru yang perlu automation bermakna: trigger placement, bounding box stabil, overlay collision/dismissal,
resize saat open dan cross-layer focus. QA tidak mengubah assertion lama agar baseline gutter terlihat lulus AC baru.

**Keputusan Designer diterima langsung dan difinalisasi** dari `sunny-designer` `01a1ba80-2190-7240-b31d-74865833dbe7`,
8 November 2026. Spesifikasi rinci telah dibaca di [design.md](design.md), heading **FIL-DES-001 — filter mandiri dan overlay kanan**,
termasuk tabel geometry/fokus/group serta tujuh langkah draft/Apply/recovery. Provenance visual yang diserahkan Designer:
[review Figma `177:2804`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=177-2804), spec node `182:5141`.
QA tidak memverifikasi ulang Figma pada pembaruan rencana ini dan tidak mengedit file milik Designer.
Oracle ini memperjelas kasus FIL-T01–07, tidak menyatakan implementasi sudah tersedia:

| Area | Expected yang disepakati dari handoff Designer | Pembuktian QA |
| --- | --- | --- |
| Launcher | Baris mandiri sebelum results Panel, rata kanan; di luar toolbar/tab/header | DOM ancestry dan urutan visual T01, tanpa mengunci API komponen internal |
| Modality | Modal semua viewport, deferred Radix, scrim/inert dan focus trap | Saat open, keyboard/pointer tidak mencapai page belakang; satu dialog/panel aktif, nama aksesibel, deferred chunk tetap di luar initial load |
| ≥768 px | Fixed kanan, top/right 16 px dan clearance bawah ≥16 px, width 320 px, max-height viewport−32 px; tinggi hug sampai maksimum | Bounding box panel dan hasil, viewport pendek, scroll. Jangan mengharuskan height selalu memenuhi layar: hug/max-height berbeda dari stretch |
| <768 px | Bottom sheet full width, max-height 90dvh | Edge/height/safe-area pada 360/390, batas 767→768; no page overflow |
| Header/body/footer | Header/footer tetap, body scroll | Field panjang/opsi panjang, aksi footer tetap terlihat, fokus tidak tertutup |
| Focus entry/exit | Heading fokus awal tanpa membuka keyboard otomatis; Escape/X/klik luar menutup tanpa Apply dan fokus kembali ke launcher | `toBeFocused`, keyboard traversal, request/URL tidak berubah saat dismissal; draft tetap saat reopen |
| Nested overlays | Escape/klik luar ditangani layer teratas terlebih dahulu | Buka select/popover lalu dismiss sekali: nested layer tutup, filter masih open/draft utuh; dismiss filter sesuai aturan berikutnya |
| Draft/group/resize | Draft dan group state bertahan close/reopen; resize saat open mempertahankan open, draft dan fokus | Ubah nilai/group, dismiss/reopen, resize 767/768 dan 1279/1280; fokus tidak tertinggal pada node tersembunyi/duplikat |
| Apply | Apply diterima menutup panel di **semua viewport**, commit snapshot atomik terakhir termasuk keystroke, fokus launcher; penutupan tidak mengklaim fetch sukses | T03/T04: bedakan commit dari GET; saat GET ditunda/gagal panel sudah tertutup, list menunjukkan loading/stale/error dan applied chips tetap benar |
| Reset | Reset all mengubah **draft saja**, group state tetap | Reset lalu close/reopen: group sama, draft default, URL/chips/badge applied belum berubah sampai Apply |
| Group | Search selalu terlihat. Satu group per field non-search; awal expanded, collapse independen dan state lokal bertahan close/reopen | Users Role/Status; Projects Status (tetap select); Permissions Module; Activity Action; Sign-in log Event/Method; Roles search-only tanpa group |
| Summary/error group | Header collapsed menampilkan nilai **draft** atau Any; global badge tetap **applied**. Field error membuka group sebelum fokus | T03/T05: ubah draft tanpa Apply, collapse, bandingkan summary vs chips/badge; jika ada jalur error field, expand otomatis dan fokus error dapat dicapai |
| Resize DOM | Satu DOM dengan CSS responsive, open/draft/fokus dipertahankan | Identitas input dan activeElement tidak hilang saat cross-breakpoint; tidak ada modal/focus trap kedua |
| Cold deferred loading | Sebelum primitive ready: launcher busy/status/Retry, tanpa modal dan navigasi tetap tersedia. Setelah ready: skeleton/error lazy fields di dalam shell | FIL-T01c membedakan dua fase; tidak menuntut modal/trap sebelum chunk tersedia. Close tetap dapat dicapai sesudah shell siap, error field tidak mengubah applied state |

Pertanyaan D1–D4 sudah dijawab Designer; **FIL-QA-001 Done** sebagai paket skenario/expected, bukan persetujuan
implementasi atau visual. Detail token/layer numerik/safe-area mengacu pada spesifikasi rinci Designer saat
handoff implementasi. Ambiguitas baru saat membandingkan runtime dicatat untuk Designer sebelum dianggap bug;
tidak menciptakan requirement. **FIL-QA-002 tetap Conditional**, tidak dijalankan terhadap baseline gutter.

**Koordinasi eksekusi:** Developer `sunny-developer` `01a1baa4-a415-7212-a49b-c19f784f64eb` menerima slot serial
`.next-e2e`/E2E sekarang; QA tidak build/browser/reset database selama slot itu. Developer menyatakan
`.next-qa-fil`, web **3223**, API **4223**, DB suffix **`_qa_fil_e2e`** aman untuk QA berikutnya; belum dijalankan
atau dibuat oleh handoff ini. Jangan menyentuh DB/artifact S4. Sebelum eksekusi, sepakati slot dan simpan SHA
kandidat atau fingerprint diff source yang belum committed, build ID, runtime, DSN tersensor, port, command dan artifacts.
Tidak menutup bug dari pesan Developer saja.

FIL-QA-002 memakai unit terkait terlebih dahulu, lalu browser terfokus terhadap implementasi; QA-REL-001
menjalankan sekali gate kandidat final yang sama dengan **Bun 1.4.3 / Node 24 / PostgreSQL 18**, full check,
production build, budget tepat-byte, dan tiga project Chromium. Gunakan environment E2E database/port/dist/scratch
yang disepakati; pastikan konfigurasi actual menghormati dist terpisah karena konfigurasi baseline mematok `.next-e2e`.
Tidak ada retest baru atau hasil pass/fail baru pada langkah perencanaan ini. Status terhalang ada pada expected
desain final/revisi implementasi, bukan environment yang gagal atau alasan menjalankan ulang tes baseline.

**Arahan Product Lead terbaru:** DEC-015 menetapkan NO-GO baseline dan prioritas P0 S4-BUG-003/DES-002A;
normalisasi/duplicate/stale dan diagnosis intermiten P1. Prioritas tersebut tidak mengubah severity/verdict QA.
Pada kandidat fix yang diserahkan Developer, QA memetakan S4-03/06/07 ke retest tepat **256.000 lulus / 256.001 gagal**,
semua route, serta create/edit: clean/dirty Cancel, Stay/Escape/Close + fokus trigger (DES-OBS-001), Leave tanpa mutation,
duplicate field/summary/fokus, canonical name/description boundary dan stale Retry tanpa kehilangan draft.
Severity DES-002A/B dan observasi fokus ditetapkan setelah reproduksi QA; klaim Designer/Developer belum menutupnya.
Full E2E S4 awal tetap fail walau retest 3/3 pass. Gate kandidat tidak diulang sebelum source dan jadwal serial jelas.

### Retest tetap aktif — form dan account menu

Bagian ini tidak ikut disupersede oleh perubahan filter Bifrost; paket bugfix/account hanya dijalankan ulang bila
ada perubahan relevan atau kandidat yang disepakati. Baseline dan laporan implementor tetap dipisahkan dari hasil QA.

#### Retest DES-002A — pending save dan Cancel anchor

Tambahan handoff Product Lead, 8 November 2026: persetujuan arah guard additive tidak meluluskan callsite.
`<Button asChild disabled>` dapat menghasilkan anchor dengan `disabled` yang tidak menghentikan navigasi native;
saat `busy`, guard unsaved juga nonaktif. Ini **risiko review yang harus ditutup oleh bukti kandidat**, bukan hasil
browser QA baru. Source working tree saat dibaca sudah mengganti Cancel busy menjadi native disabled button,
tetapi patch masih bergerak dan tidak dibekukan; QA belum memverifikasi bahwa blocker selesai. Nilai/freeze field,
double submit, dan pemulihan fokus tetap harus diuji, bukan disimpulkan dari markup.

Seluruh kasus berikut menunggu revisi kandidat Developer dan slot serial, dijalankan pada **create dan edit**,
desktop/tablet/phone (termasuk 360 px), dengan data uji khusus QA. Bukti merekam URL, raw draft, payload canonical,
jumlah POST/PATCH serta fokus; tidak menyalin cookie/token/header autentikasi ke laporan.

| ID | Langkah retest | Expected / acuan |
| --- | --- | --- |
| CANCEL-T01 | Form bersih, aktifkan Cancel dengan pointer lalu keyboard; ulang setelah direct document load tanpa history flow | Create menuju list internal yang ditetapkan, edit menuju detail project; tidak memakai history arbitrer, tidak membuka guard atau membuat mutation |
| CANCEL-T02 | Ubah Name saja, Description saja, Status saja, lalu kombinasi; aktifkan Cancel dengan pointer/Enter | Semua jenis perubahan terdeteksi dirty, dialog unsaved tampil, draft dan URL form bertahan sampai keputusan pengguna |
| CANCEL-T03 | Dari dirty Cancel, tutup dialog melalui Stay/Cancel, Escape dan X; ulang dari breadcrumb/internal link | Nilai semua field sama; fokus kembali ke **pemicu aktual** (Cancel atau breadcrumb), bukan container, body atau link lain. Mencakup DES-OBS-001; fokus sesudah leave menuju halaman tujuan mengikuti pola navigasi |
| CANCEL-T04 | Dari Cancel/breadcrumb dirty, pilih Leave page | Menuju tujuan internal yang tercatat, tanpa POST/PATCH; tidak tertahan lagi oleh guard dan tidak memutasi record |
| CANCEL-T05 | Isi draft valid, tahan respons **POST create / PATCH edit** sebelum selesai; coba Cancel dengan pointer dan Enter, termasuk fokus Cancel sebelum save lalu submit dari field | Selama pending tidak dapat keluar melalui Cancel, URL tetap form, tidak ada navigasi native anchor atau dialog unsaved palsu. Buktikan perilaku input browser, bukan hanya `disabled`/CSS/role. Lepaskan request dalam cleanup |
| CANCEL-T06 | Ketika POST/PATCH ditahan, coba ubah Name, Description dan Status melalui keyboard/pointer | Field tidak menerima perubahan baru saat saving sesuai spesifikasi Designer/DEC-015. Snapshot tampilan tetap; payload tunggal sama dengan snapshot canonical saat submit, raw draft dibedakan dari trim payload |
| CANCEL-T07 | Aktifkan submit dua kali cepat, Enter berulang dan interaksi Cancel→submit selama request pertama masih tertahan | Tepat **satu** mutation, tanpa request kedua, double toast, navigasi ganda atau duplicate yang dibuat oleh submit sendiri; pending trigger jelas. Jangan menguji dengan menghapus disabled dari DOM |
| CANCEL-T08 | Lepaskan request sukses, kemudian ulang dengan 409/500/network failure yang terkontrol | Sukses hanya sesudah server mengonfirmasi, detail/reload sesuai payload. Gagal: seluruh draft awal tetap, field/aksi dapat dipakai lagi, error recoverable; Cancel kembali mengikuti dirty guard dan fokus. Error tidak dianggap save sukses |
| CANCEL-T09 | Jalankan invalid canonical-submit lewat Enter dan pointer sebagai kasus terpisah; rekam blur, lokasi tombol, request dan fokus sebelum/sesudah aktivasi. Valid submit serta Cancel pending tetap memakai pointer selain keyboard | Lulus Enter membuktikan jalur keyboard saja. Pointer harus mengaktifkan kontrol yang dimaksud, tanpa terlewat karena blur/error menggeser layout. Jika kegagalan blur-layout dapat direproduksi pada kandidat, laporkan klasifikasi, langkah dan dampaknya tersendiri; jangan menutupnya karena metode tes diganti |

Regresi guard mencakup caller breadcrumb/internal anchor existing karena hook dipakai bersama. Native Back/Forward,
command palette dan intersepsi router global tetap di luar perluasan yang diotorisasi; jangan mengklaimnya tertutup
oleh fix Cancel. Severity temuan pending/fokus ditentukan setelah reproduksi QA, bukan otomatis diwariskan dari P0.
DES-002A tetap belum diverifikasi/ditutup; hasil awal dan bukti Designer tetap disimpan.

Pembaruan koordinasi Product Lead: review source terbaru menemukan native disabled Cancel, fieldset dan synchronous
submit latch; blocker source lama dinyatakan addressed oleh review tersebut, **bukan verified oleh QA**. Developer
mengganti satu tes invalid canonical-submit menjadi Enter setelah blur validation menggeser tombol. Metode itu sah
untuk keyboard validation tetapi tidak memberi bukti pointer atau fix produk. `focus-failure.jpeg` dan log awal
disimpan Developer; path artifact lengkap diminta sebagai bagian paket kandidat. Pertahankan bukti/metode awal
untuk diagnosis CANCEL-T09. Tidak ada tes/build tambahan sampai paket dan slot serial diserahkan.

DEV-001: Product Lead melaporkan telah membaca artifact setup/smoke Developer yang lulus. Bukti quick start
independen QA S4-02 di atas tetap dipakai; tidak dijalankan ulang tanpa perubahan setup/migrasi/seed yang relevan.
Tidak ada build, browser, database reset atau tes baru pada pembaruan rencana ini.

#### Retest DEV-002 — lazy account-menu content

Handoff Product Lead: Developer melaporkan **desktop 23 pass / 23 skip**, belum sign-off QA. Build yang dilaporkan
masih `/users` **256.717 byte** (lebih 717) dan `/audit/auth` **256.065 byte** (lebih 65) terhadap batas 256.000 byte.
Ini **laporan kandidat melalui Product Lead**, bukan pengukuran QA baru; hasil baseline S4 tidak ditimpa.
NO-GO tetap berlaku. Lazy account-menu content diotorisasi sebagai koreksi sempit DEV-002, trigger/UX tetap.

Review source QA hanya membaca working tree: loading merender DropdownMenuContent berisi item disabled,
sedangkan wrapper DropdownMenuContent memakai `takeKeyOpen` sekali pada attach; `ChunkBoundary` generik semula
dirancang untuk panel. Kombinasi ini menimbulkan risiko fokus keyboard pertama hilang saat konten asli mengganti
loading dan risiko fallback di luar konteks menu. **Belum direproduksi sebagai defect QA**; kandidat masih berubah.

| ID | Skenario kandidat / bukti | Expected dan batas klaim |
| --- | --- | --- |
| ACCOUNT-T01 | Context/cache dingin, buka pertama lewat Enter/Space/ArrowDown pada trigger; ulang dengan overlay sudah siap tetapi account-content belum dimuat | Menu membuka sekali; setelah ready fokus pada item enabled pertama (Profile), panah dan aktivasi bekerja, tanpa perlu reopen/pointer untuk memulihkan fokus. Rekam focus timeline dan jumlah open/asset request |
| ACCOUNT-T02 | Tahan chunk account-content sebelum first keyboard-open; loader tampil lalu lepaskan; ulang cold pointer-open sebagai kontrol | Pending dapat diketahui; loading item disabled tidak menghabiskan intent fokus keyboard. Saat konten masuk fokus tetap logis; Escape sebelum chunk selesai menutup dan fokus kembali trigger, late chunk tidak membuka ulang/mencuri fokus |
| ACCOUNT-T03 | Gagalkan chunk content sekali secara terkontrol pada cold open; tangkap fallback/console, Tab/keyboard recovery, Escape dan reopen | Error terisolasi di account menu, bukan menjatuhkan shell atau meninggalkan fallback lepas dari menu/context. Recovery yang disediakan dapat dijangkau, semantik/fokus aman, closed trigger tidak menjadi inert selamanya. Jangan menganggap retry/reload berhasil tanpa menjalankannya |
| ACCOUNT-T04 | Sesudah load pertama, open/close ulang, navigasi Profile/Security/Sessions/shortcuts dan Escape kembali ke trigger | Trigger, label, item, navigasi dan fokus seperti sebelum split; tidak ada duplicate menu, request/load berulang yang tidak perlu atau aksi tak sengaja dari key open |
| ACCOUNT-T05 | Desktop expanded/compact rail, tablet dan phone drawer; keyboard/pointer/touch, light/dark, resize dan reduced motion | Semua konteks account menu tetap dapat dibuka/ditutup; nested drawer dan menu mengembalikan fokus ke pemicu yang benar, target/hit area serta scrolling konten tidak rusak |
| ACCOUNT-T06 | Ulang theme, palette, comfortable/compact density, persistence reload dan sign out; ukur bundle seluruh route setelah build yang sama | Preferences tetap konsisten, logout mengakhiri akses sesuai suite existing. Account-content benar-benar lazy; pengurangan ukuran bukan hasil menghapus item/fitur, mengecualikan route atau mengubah cakupan hitung. Semua route ≤256.000 byte |

Reuse terarah: browser `auth.spec.ts` (account logout), `design-system-implementation.spec.ts` (theme/palette),
`ds-components.spec.ts`/`responsive.spec.ts` (account/shell/drawer/compact), `ux-patterns.spec.ts` (early press),
serta dropdown/deferred-overlay dan ChunkBoundary tests. Tambahkan cold first-open, slow/failed content chunk,
density dan focus handoff yang belum benar-benar dibuktikan oleh suite; chart chunk failure bukan bukti menu chunk
failure. Request interception harus menargetkan chunk kandidat yang teridentifikasi, bukan menebak nama/hash atau
memblokir semua JS. Eksekusi menunggu paket fingerprint/revisi, byte tepat dan slot serial; **tidak dijalankan sekarang**.

#### Retest DEV-002 — ekstraksi users actions ke chunk dialog

Koreksi angka build anchor: Product Lead membaca `S4/../developer-session-3/anchor-budget-first.json`; QA juga
**membaca artifact JSON yang sudah ada**, tanpa menjalankan build/budget. `/users` **256.049 byte / over49**,
`/audit/auth` **255.180 / headroom820**, `/audit/activity` **255.084 / headroom916**. Angka over554 yang sempat
beredar bukan hasil artifact ini. Build berbeda sebelumnya tetap dilabeli terpisah; gate build ini **masih red**.
Tidak ada pengukuran kandidat baru atau sign-off QA.

Product Lead mengotorisasi ekstraksi sempit `confirmUserAction` (single delete/bulk API+toast) ke chunk
`UsersActionDialog` existing untuk DEV-002; **bukan lazy geometry**, bukan perubahan backend/permission.
QA membaca WIP `users-page.tsx`/`users-action-dialog.tsx`: page masih memegang selection reset/query invalidation,
helper memegang mutation/toast. Pembacaan itu bukan bukti behavioral equivalence; source/fingerprint dan hasil
regresi kandidat tetap diperlukan.

| ID | Regresi kandidat | Expected / evidence |
| --- | --- | --- |
| USERACT-T01 | Intent hover/focus/pointer preload chunk, render/open dialog, lalu Cancel/Escape; cold dan warm | **Tidak ada POST/PATCH/DELETE** dari import/preload/render/open/cancel. GET/prefetch normal tidak dianggap mutation. Request log tersensor dan state record tetap |
| USERACT-T02 | Single delete eligible user dan bulk masing-masing satu confirm; double-click/Enter cepat serta respons ditahan | Tepat satu mutation per konfirmasi, pending jelas; tidak ada double toast/request saat lazy import resolve. Delete target/endpoint dan bulk action sesuai konfirmasi, API mutation tidak otomatis di-retry |
| USERACT-T03 | Bulk selected IDs vs Select all matching; filter multivalue/search/page berubah atau pending response terlambat; assignRole pilih role lalu submit | `ids` atau `filter` sesuai snapshot target dialog, tidak keduanya; full filtered set bukan page. Role assign snapshot pada submit tetap scalar; tidak terpengaruh perubahan/filter race setelah confirm. Nama/count/dampak dialog tetap konsisten |
| USERACT-T04 | API403/409/500/network failure, lalu explicit retry atau cancel | Failure recoverable dalam dialog; selection/target/role tidak di-reset hanya karena import/request gagal, tidak ada success toast. Explicit user retry boleh satu mutation baru; tidak disamakan dengan duplicate otomatis |
| USERACT-T05 | Bulk semua done, partial done/skipped dan semua skipped; baca toast/audit/list setelah sukses | Jumlah dan alasan done/skipped tepat; all-skipped memberi notifikasi error yang sesuai tetapi tetap hasil bulk HTTP sukses, bukan network failure. Selection reset/query invalidation mempertahankan semantik existing pada success; hanya done tercatat audit |
| USERACT-T06 | Role tanpa action permission, revoke setelah dialog dibuka, target self/higher rank/last Superadmin; desktop/tablet/phone | Guard/rule tetap authoritative, tidak ada mutation tak diizinkan; menu/dialog dan alasan terblokir konsisten. Fokus setelah cancel/error/row terhapus aman; extraction tidak mengubah CSRF atau permission contract |

Reuse browser `ux-patterns` select-all/confirm, `responsive-data` selection/actions dan `permissions`/`own-role`,
serta users integration bulk/rank/audit/concurrency yang memang relevan. Kasus existing yang hanya membuka lalu
Cancel dialog tidak membuktikan submit tepat sekali; tambahkan assertion request/payload dan fixture QA untuk
gap tersebut pada kandidat. Unit/import-side-effect probe boleh melengkapi, tidak menggantikan interaksi browser.
Tidak ada run/build tambahan pada WIP ini; setelah source dibekukan ukur seluruh route tepat-byte dan pilih regresi
berdasarkan diff, tanpa mengulang setup atau menerima budget dengan menaikkan batas.

### Rekomendasi audit awal — riwayat sebelum retest kandidat

**Catatan historis:** rekomendasi terbaru dan status penutupan ada pada bagian retest kandidat beku di atas.

**Belum merekomendasikan sign-off rilis lokal.** Fondasi/check, quick start dan flow inti baseline yang diuji lulus;
tiga bug S4 belum ditutup QA, gate ukuran baseline gagal dan full browser awal tetap memiliki kegagalan yang dicatat.
Scope baru mempunyai **QA-FIL-001 Open/S3** dari review artifact red Developer, tanpa verifikasi post-fix.
Audit awal/QA-PLAN-001 dan perencanaan delta selesai; QA-REL-001/FIL-QA-004 tetap conditional, bukan diluluskan oleh
bukti awal/laporan implementor. Tidak ada fix produk yang diverifikasi atau ditutup QA pada pembaruan ini.

- **Developer (DEV-002/003):** reproduksi S4-BUG-001/002/003 dan diagnosis S4-TEST-001; sertakan revisi fix dan failing regression yang relevan. QA akan menguji revisi itu, bukan klaim perbaikan.
- **Designer (DES-001/002, FIL-DES-002):** gunakan screenshot/state sebagai input review; spesifikasi Bifrost mengikuti DEC-017 dan handoff terakhir, pola notice stale mengikuti standar yang ada. QA tidak mengambil keputusan visual atas nama Designer.
- **Product Lead:** triase prioritas dan penerimaan risiko non-blocking secara eksplisit; bekukan scope/revisi kandidat, termasuk keputusan apakah perubahan filter ikut rilis. Pilihan distribusi/lisensi dan dependency dokumentasi tetap milik PL-002/003/DEV-004.
- **QA berikutnya (QA-REL-001/FIL-QA-004):** retest semua fix, jalankan gate kandidat dengan runtime pin dan browser serial, jelaskan skip lagi; koreksi yang mengubah source/build membutuhkan pengukuran ulang area terdampak. FIL-QA-002 modal/Apply bukan acceptance Bifrost. Build/budget Linux belum diulang sesi ini. Tidak ada staging/HTTPS/provider nyata, restore drill, capacity/RUM, WebKit/real-device atau screen-reader manual; jangan menganggapnya lulus. OPS/INT berada di tahap berikutnya dan bukan alasan tunggal menolak template lokal.

Automation/evidence tambahan hanya di scratch; tidak menambah dependency atau mengubah kode produk. Reproduksi dapat memakai script lokal di atas selama artifact tersedia; candidate/CI perlu menyimpan artifact yang sudah diredaksi agar bukti tidak bergantung pada workstation ini.

## Masukan Designer — Sesi 2

Review Designer pada source `2ba4b9f`, production preview terpisah web `:3180` / API `:4180`, Chrome/macOS,
8 November 2026. Tidak ada reset/seed database atau save/delete project. Ini masukan review UX, bukan pengganti
hasil pengujian Sesi 4 atau persetujuan rilis.

- **DES-002A, dampak mayor:** edit Apollo → ubah Name → Cancel langsung kembali ke detail dan membuang draft,
  **2/2**. Breadcrumb justru membuka konfirmasi unsaved. Expected: Cancel dirty melalui guard yang sama;
  Cancel/Escape/Close dialog mempertahankan nilai, Leave page menuju tujuan internal yang ditetapkan tanpa mutation.
- **DES-002B, dampak sedang:** create nama `Apollo` existing → pesan duplicate muncul di bawah Status tanpa
  field error/fokus Name, satu reproduksi browser + source. Expected: error Name dan linked summary, fokus Name,
  Description/Status tetap. Severity final dan prioritas menunggu triase Product Lead/QA.
- **DES-OBS-001:** satu observasi AX fokus sesudah Cancel dialog kembali ke container halaman; perlu retest keyboard
  sebelum dinyatakan defect. S4-BUG-001/002 tetap memakai ID QA; expected stale/normalisasi sudah dicantumkan Designer.

Required Name dan form 360/390/834 dilihat; tidak tampak horizontal overflow pada form yang diamati. Browser dark,
network fault injection, slow success dan screen reader menyeluruh tidak diuji ulang Designer. Full check Bun 1.4.3 /
Node 24.21.0 lulus **1.528 tes** + typecheck/lint; `.superpowers/scratch/designer/check.log`. Tidak ada run E2E/build/budget
baru yang diklaim. [Handoff dan batas bukti](design.md) memuat spesifikasi, Figma v1.0.1 In review dan test expectation.
**Implementasi belum mendapat persetujuan visual.** Retest harus memakai revisi fix yang sama.

## Riwayat integrasi Core — hasil historis

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
