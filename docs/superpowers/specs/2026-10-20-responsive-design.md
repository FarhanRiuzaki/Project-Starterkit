# Responsive desktop + mobile — design

Tanggal: 2026-10-20. Keputusan pemilik: "UI/UX FE responsive ready, di desktop maupun mobile, jadi standar starterkit".
Ini menggantikan aturan lama "desktop only, tidak pernah dibuka di ponsel" di `docs/standards/design-system.md` §0,
`ui-standard.md` (bagian lebar layar) dan `AGENTS.md` §7. Detail di bawah adalah rekomendasi Claude **(Claude)**
kecuali yang ditandai pemilik.

## Maksud

Setiap layar starterkit (auth, dashboard, users, roles + matrix, permissions, audit, `/me`, `/ds`) bisa dipakai penuh
di ponsel, tablet dan desktop, dengan kualitas yang sama: lima state data, motion, tanpa flicker, a11y, anggaran JS.
Produk turunan (CMS, aplikasi manajemen) mewarisi pola yang sama tanpa merancang ulang.

## Lebar layar

| Kelas | Lebar | Referensi | Navigasi |
|---|---|---|---|
| Ponsel | 360–767 px | 390 px | bilah atas (logo, judul halaman, tombol menu, akun); sidebar jadi drawer dari kiri |
| Tablet | 768–1279 px | 834 px | rail ikon 64 px (seperti sekarang) |
| Desktop | ≥ 1280 px | 1440 px | sidebar penuh / rail (seperti sekarang) |

Tidak ada scroll horizontal halaman di lebar mana pun dari 360 px. Satu-satunya scroll horizontal yang boleh adalah di
dalam komponen yang memang lebar (matrix permission, tablist), dengan petunjuk visual dan kolom pertama sticky.

## Pola per komponen

- **Shell:** di ponsel, `Sidebar` dirender di dalam drawer (Radix Dialog, focus trap, Escape, tutup saat navigasi,
  `inert` pada konten di belakang), dibuka dari tombol menu di bilah atas. Command palette tetap ada (tombol cari).
  Safe-area inset (`env(safe-area-inset-*)`) di bilah atas dan drawer.
- **PageHeader:** judul + deskripsi membungkus; aksi utama tetap terlihat, aksi sekunder masuk menu "More" di ponsel.
- **DataTable:** di ponsel baris dirender sebagai daftar kartu ("stacked rows"): kolom yang ditandai `mobile: "title"`
  menjadi judul kartu, kolom `"meta"` menjadi pasangan label–nilai, `"hidden"` disembunyikan; pilih baris dan aksi baris
  tetap ada (checkbox, menu aksi). Urutkan lewat select "Sort by". Pagination ringkas (sebelumnya / "Halaman x dari y" /
  berikutnya) + pemilih ukuran halaman. Semua aturan tabel server-side (15/25/50/100, URL state, `totalCapped`) tetap.
- **Toolbar filter:** di ponsel, pencarian tetap terlihat; filter lain masuk sheet "Filters" dengan jumlah filter aktif.
- **Dialog / ConfirmActionDialog / form overlay:** di ponsel menjadi bottom sheet selebar layar (tinggi maks 90 dvh,
  isi scroll, tombol aksi menempel di bawah), dengan token motion overlay yang sama.
- **Form:** satu kolom di ponsel; tombol submit selebar penuh; `inputmode`/`autocomplete` yang benar; tidak ada
  zoom otomatis iOS (ukuran font input ≥ 16 px di ponsel).
- **Detail & grid kartu:** 12 kolom → 1 kolom di ponsel, 2 di tablet; KPI tray 2 per baris di ponsel.
- **Tabs:** tablist scroll horizontal di dalam dirinya, indikator tetap.
- **Matrix permission:** scroll horizontal di dalam kartu, kolom modul sticky, header sticky.
- **Chart:** lebar mengikuti kontainer, tick lebih sedikit di ponsel, tooltip bisa disentuh.
- **Target sentuh:** minimal 44 × 44 px saat `pointer: coarse` (tanpa mengubah ukuran desktop 28/32 px);
  aksi yang hanya muncul saat hover punya jalan lain di layar sentuh.

## Yang tidak berubah

Token warna, tipografi, motion (durasi, easing, stagger, reduced motion), aturan tanpa flicker (prefetch server,
`useDelayedFlag`, `placeholderData`), lima state, copy guide, anggaran JS ≤ 250 kB per rute (drawer dan sheet dimuat
lewat `deferred-overlay`, tidak menambah first-load).

## Bukti selesai

- E2E Playwright berjalan di tiga viewport: ponsel 390×844 (`hasTouch`, `isMobile`), tablet 834×1112, desktop
  1440×900. Di setiap halaman: tidak ada scroll horizontal (`scrollWidth ≤ innerWidth`), navigasi tercapai, axe 0
  serious/critical (terang dan gelap), tanpa flicker, target sentuh ≥ 44 px di ponsel.
- Snapshot `/ds` ditambah versi ponsel.
- Standar diperbarui: `design-system.md` §0 dan grid, `ui-standard.md` lebar layar + checklist, `AGENTS.md` §7.
