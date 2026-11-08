# Desain SunnyGo

Sumber desain: [Figma SunnyGo](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA). Arah saat ini adalah UI admin netral dengan brand SunnyGo, reusable components, semantic tokens, tray/card bertingkat, light/dark, palette dan density terpisah.

Rujukan rinci: [design system](standards/design-system.md), [UI standard](standards/ui-standard.md), [copy guide](standards/copy-guide.md), [pemetaan implementasi](standards/figma-implementation.md) dan [coverage komponen](standards/figma-component-coverage.md). Teks produk berbahasa Inggris; dokumen koordinasi tim boleh berbahasa Indonesia.

## Flow dan state

- Sign in → proof kedua jika diperlukan → dashboard atau tujuan internal yang diizinkan. Profil/security/session berada di akun; menu mengikuti permission.
- List → search/filter draft → Apply atomik → hasil server; page/sort/filter/range di URL, saved views milik pengguna, kolom tersembunyi di preferences. Filter desktop memakai kartu di gutter; di bawah xl memakai dialog/sheet. Chip aktif tetap terlihat setelah panel ditutup.
- Detail → edit/create → validasi terhubung ke field, pending trigger dan feedback; perubahan belum tersimpan memakai leave guard.
- Delete dan bulk memakai ConfirmActionDialog dengan dampak. Perubahan tunggal yang reversible memakai Undo sesuai standar; aksi terblokir menjelaskan sebab.
- Setiap region data: loading sesuai bentuk, empty dengan petunjuk, error/retry, stale dengan data sebelumnya, dan data.
- `projects`: list/detail/create/edit, status Active/Archived, permission-aware actions dan activity; mengikuti komponen serta interaksi list bersama.

Phone 360–767 px (referensi 390), tablet 768–1279 (834), desktop ≥1280 (1440); CSS menentukan breakpoint. Tabel phone berupa cards, touch target diperluas, wide content scroll dalam card, keyboard/focus dan reduced motion dipertahankan.

## Status Figma

Dokumen versioning menetapkan baseline `v1.0.0` dan duplikasi page untuk patch berikutnya. **Penerapannya di file Figma belum diverifikasi selesai**; status yang diwarisi menyatakan migrasi belum diterapkan. Integrasi repository ini tidak mengubah Figma dan tidak mengesahkan rilis desain. Designer menindaklanjuti sesuai [figma-versioning](standards/figma-versioning.md), menjaga masters/tokens/styles versi lama.

Contoh `projects` di repository belum memiliki screen Figma yang diverifikasi; gunakan standar yang ada dan catat review Designer sebagai backlog terpisah.
