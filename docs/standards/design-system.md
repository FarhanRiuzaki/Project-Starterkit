# Design System v3 ("Tray")

Visual and motion rules for `@starterkit/ui` and `apps/web`. Companion to `docs/standards/ui-standard.md` (page rules) and
`docs/standards/copy-guide.md` (text). Section numbers are kept stable; §1, §8 and §10-§12 of the source spec are not part of the
starterkit.

---

## 0. Principles

1. **Responsive: phone, tablet, desktop.** Every screen works fully at every width from 360 px, with the same five
   states, motion, no-flicker rules, a11y and JS budget (spec `docs/superpowers/specs/2026-10-20-responsive-design.md`).
   Three width classes, on Tailwind's `md` (768) and `xl` (1280) breakpoints:

   | Class | Width | Reference | Navigation |
   |---|---|---|---|
   | Phone | 360–767 px (`max-md:`) | 390 px | Top bar (menu button, logo mark, page title, search, account); the sidebar opens as a drawer from the left |
   | Tablet | 768–1279 px | 834 px | 64 px icon rail |
   | Desktop | ≥ 1280 px (`xl:`) | 1440 px | 248 px sidebar, collapsible to the rail |

   - **No horizontal page scroll** at any width from 360 px. Only a component that is wide by nature (permission
     matrix, a wide table, a tablist) scrolls sideways, inside its own card. (`tests/e2e/responsive.spec.ts`
     "no horizontal page scroll", helper `expectNoHorizontalScroll`, on the desktop, tablet and mobile projects.)
   - **Targets**: drawn at **28 px minimum, 32 px default** for buttons, icon buttons, segments and pagination at every
     width. Under `@media (pointer: coarse)` every control also has a hit area of at least **44 × 44 px**
     (`--touch-min`): a transparent `::before` from `base.css`, so the drawn size never changes; text fields and selects
     grow to 44 px instead. (`responsive.spec.ts` "touch targets", signed-in and sign-in pages, mobile project.)
   - **Hover-only details have a touch path**, CSS only (`pointer-coarse:`, both versions in the server HTML): row
     actions are always shown; `RelativeTime` adds the short absolute time as a second line in fg-3; a `BlockedButton`
     shows its reason as a caption under it (`caption={false}` only in table row actions whose reason is also shown
     elsewhere on touch: the users list's Actions menu, which below 1280 px and on a touch screen carries Deactivate /
     Activate user with the reason under the label (the row button then shows only while its action runs, as the
     pending state), and the user detail's Edit user caption); `className` stays on the button
     and `wrapClassName` places the button + caption box (`w-full`, `ml-auto items-end`); on a tablet with a touch
     screen (768–1279) the top bar shows the menu button, so the rail's labels are reachable in the drawer; from 1280
     the full sidebar has them and the button hides.
     (`packages/ui/src/ds/{relative-time,blocked-button,data-table}.test.ts`, `responsive.spec.ts` "hover-only details",
     "tablet with touch".)
   - **Inputs** use at least 16 px text under a coarse pointer (`--text-input-touch`, `base.css`), so iOS never zooms.
   - **Overlays**: below 768 px a `Dialog` (and so `ConfirmActionDialog` and every form dialog) is a bottom sheet:
     full width, at most 90 dvh, scrolling content, the action row stuck to its bottom, safe-area padding; same
     motion tokens (`packages/ui/src/ui/dialog.test.ts`, `responsive.spec.ts` "bottom sheet"). A dialog built around
     a text field passes `phone="top"`: it hangs from the top edge instead, so the on-screen keyboard doesn't cover it
     (the command palette, results at most 50 dvh; `responsive.spec.ts` "command palette").
   - **Safe areas**: `viewport-fit=cover`; the phone top bar, the drawer, the bottom sheet and the shell's sides pad
     with `env(safe-area-inset-*)` (`pt-safe`, `pb-safe`, `pl-safe`, `px-safe` utilities in `base.css`). The top bar's
     min-height adds the inset to its 56 px row.
   - **Known limit**: the responsive checks run in Chromium emulation only (`isMobile`, `hasTouch`, a 390 px viewport):
     no WebKit project and no real iPhone or iPad. Safari-only behaviour (the keyboard over fixed layers, `env()` insets
     on a real notch, `dvh` while the toolbar collapses) is not tested.
   - **Data surfaces on a phone** (`tests/e2e/responsive-data.spec.ts`, `packages/ui/src/ds/{data-table,data-table-dom,toolbar}.test.ts`):
     - `DataTable` rows are **stacked cards**: each `Column` declares `mobile: "title" | "meta" | "hidden" | "lead"`
       (title = the card heading, exactly one, checked in development; meta = a label–value line with the header as the
       label; lead = the row checkbox left of the title); row actions sit top right and are always shown. One DOM for
       every width, switched in CSS (no second list, no hydration difference); the table keeps its semantics through
       explicit ARIA roles. Sorting is a "Sort by" select, pagination is compact (previous / "Page x of y" / next +
       rows per page); URL state, `placeholderData` and the delayed skeleton are the same, and the loading shape is a card.
     - Module lists use shared `FilterLayout`: a default collapsed right rail and nonmodal checkbox sidebar from `md`,
       a launcher row and modal sheet on phones. Checkbox selections auto-apply; search debounces300ms. Clear all acts
       immediately. Badge/chips show applied selections; geometry, coverage and focus follow §5.6.
     - The users list's bulk bar sticks under the top bar (`--topbar-h`, the token the top bar's height uses) while
       rows are selected (`Panel flush` clips with `overflow: clip`, so a sticky child sticks to the page).
     - A `Panel` description takes its own line under the title row, without the middot.
     - Tablet: identity columns keep a `min-w-*`; the users table hides Sign-in and Created below 1280 so it fits its
       card (`responsive-data.spec.ts` "identity columns keep their text").
     - The permission matrix scrolls inside its card (at most 70 dvh) with a sticky header row and module column
       (a rule marks the column edge on a phone), 44 px rows under a coarse pointer; a press on a read-only cell shows
       its reason under the matrix (`role="status"`).
     - Charts take the container's width; the column chart's x labels keep a 16 px gap, so a phone shows about every
       other day; a tap shows the tooltip (Recharts' touch handling). Line tabs scroll inside the tablist; the
       indicator is positioned in the list's own coordinates and scrolls with it.
     - Detail grids: one column on a phone, two from 768 (`md:grid-cols-2`, `md:col-span-6`).
   - New layout uses `md` and `xl` only. Older uses of other breakpoints: `lg` (1024) in the KPI tray (`stat-tile.tsx`:
     2 per row up to 1023, one row from 1024); `sm` (640) for the filter input width and two `/ds/components` grids; `max-lg`
     narrows the top bar's search field.
2. **Tray and sheet.** Every region has exactly one job, and its surface says it. App background → content
   sheet → tray (grouping, header, label) → card (the data itself). Each step is a visible but quiet value change
   of 2–4 % lightness, plus a 1 px hairline. The overlay shadow is only for things that float; what a resting
   surface may carry is in §3.4.
3. **Symmetry by construction.** 12-column grid, equal-width siblings, equal heights per row, the same 16 px gap
   everywhere at panel level. A row of tiles always fills the row: 4 × 3 col, 3 × 4 col or 2 × 6 col, never 5 tiles.
4. **Numbers are the interface.** KPI values are large, regular weight (not bold), tabular. Units, denominators
   and minor digits drop to the muted ink ("82 % / 100 %", "4.2M"). Deltas sit beside the number in a tinted pill.
5. **Ink is neutral; colour is information.** Text and chrome are greyscale. Navy (the brand ink) means selection/primary;
   blue means "series 1". Status colours are reserved for the five health states. The categorical palette is for series only.
6. **Charts are quiet.** Dashed recessive grid, no axis lines, rounded bar caps, 2 px lines, gradient-to-zero area,
   one highlighted point with a dark tooltip. Every chart has a legend for ≥ 2 series and a table view.
7. **Smooth, never showy.** Motion explains change (where did it come from, what is loading, what moved) in
   200–280 ms, honours `prefers-reduced-motion`, and never animates layout on large tables (§7).
8. **Same contract.** v3 is a reskin plus layout changes. Routes, URL state, BFF, data, copy, the five states and
   AA contrast stay binding.

---


---

## 2. Layout system

### 2.1 Frame (1440 reference)

```
┌ bg ─────────────────────────────────────────────────────────────────────────────────────────┐
│┌ sidebar 248 ──────┐ 8 ┌ sheet (radius 20, line) ─────────────────────────────────────────┐ 8│
││ logo · collapse   │   │ top bar 56: breadcrumb ............ search ⌘K · bell · account   │  │
││ MAIN              │   ├──────────────────────────────────────────────────────────────────┤  │
││  Dashboard        │   │ content: padding 32 / 24 top, full width, 12 col, gap 16         │  │
││  Users        24  │   │                                                                  │  │
││ ...               │   │                                                                  │  │
││ SETTINGS (bottom) │   │                                                                  │  │
│└───────────────────┘   └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Sidebar 248 px expanded, 64 px collapsed (icon rail, tooltips); collapse state persists per viewer.
- Sheet inset 8 px top/right/bottom; content padding 24 px horizontal, 24 px top, 40 px bottom.
- At 1440: content width 1440 − 248 − 8 − 8 − 64 = 1112 px; 12 columns, 16 px gutters → column 78.0 px.
- The content fills the sheet at every width (no max width): at 1920, or with the sidebar collapsed, the grid widens
  instead of leaving empty margins. At 1280: 952 px content, same 12 columns.
- Tablet, 768–1279: the sidebar is always the 64 px rail; 12-col spans of 3 become 6, 4 become 6 (2 per row).
- Phone, below 768: no sidebar (drawer), the sheet fills the window edge to edge (no inset, no radius), content padding
  16 px, top bar sticky; every span becomes 12 (one column) and a KPI tray shows 2 tiles per row; tables are stacked
  cards (§0); no horizontal scroll.

### 2.2 Rhythm

| Gap | Value | Use |
|---|---|---|
| `--gap-section` | 24 px | Between page sections (header → tiles → toolbar → panels) |
| `--gap-grid` | 16 px | Between sibling panels/tiles (row and column) |
| `--gap-tray` | 4 px | Tray padding around its inner card(s); between tiles inside a KPI tray |
| `--gap-panel` | 16 px | Inside a card |
| `--gap-dense` | 8 px | Rows of chips, label ↔ value |

Symmetry rules: siblings in a row share width and height (`grid-auto-rows: 1fr` per row); charts in one row share
`CHART_HEIGHT`; a right rail is always 4 columns next to an 8-column main; never 5 or 7 equal items in a row.

### 2.3 Spans

| Pattern | Span |
|---|---|
| KPI strip | one tray, 4 tiles (or 3), equal |
| Primary chart | 8 col + 4 col companion (legend cards, insights, top-N) |
| Paired charts | 6 + 6 |
| Card grid | 3 col each (4 per row) ≥ 1440; 4 col (3 per row) 1280–1439; 6 col (2 per row) on a tablet; 12 col on a phone |
| Tables | 12 col (stacked cards on a phone, §0) |

---

## 3. Tokens

All colours are CSS custom properties in `packages/ui/src/styles/tokens.css`, mapped into Tailwind v4 `@theme inline`. Light and dark are both selected values, not a computed inversion.

### 3.1 Colour — light

| Token | Hex | Role | Contrast note |
|---|---|---|---|
| `--bg` | `#f3f3f4` | App background, sidebar | — |
| `--sheet` | `#ffffff` | Content sheet | — |
| `--tray` | `#f7f7f8` | Tray, table header, segmented track, KPI group | fg-3 on tray 4.6:1 |
| `--card` | `#ffffff` | Inner card, table rows, chart surface | — |
| `--inset` | `#f4f4f5` | Inset well inside a card (sparkline wells, code) | fg-3 4.59:1 |
| `--raised` | `#ffffff` | Menus, popovers, dialogs (with shadow) | — |
| `--line` | `#ececee` | Hairlines: sheet, tray, card, row dividers, the secondary button's edge, the header's search, time range and refresh groups | non-text |
| `--line-strong` | `#dcdce0` | Stronger hairlines: radio and switch at rest, step and timeline rails, chart baseline, a hovered card | non-text |
| `--control-border` | `#858591` | The boundary of a field: input, select, textarea, affix, number input and the combobox field (§5.12) | 3.65:1 on card (WCAG 1.4.11) |
| `--grid` | `#ececee` | Chart gridlines (dashed) | non-text |
| `--fg` | `#151518` | Primary text, KPI values | 18.2:1 on card |
| `--fg-2` | `#4a5263` | Secondary text, labels, panel titles' icons (cool grey, from Airform's ink family) | 7.84:1 card, 6.95:1 stopped-soft |
| `--fg-3` | `#636b7c` | Muted text, captions, axis ticks, denominators | 5.35:1 card, 5.00:1 tray, 4.74:1 stopped-soft |
| `--fg-4` | `#a1a1aa` | Disabled, placeholder glyphs only — never information | decorative |
| `--primary` | `#0d1530` | Brand navy: selection, links, focus ring, checkbox, active tab underline. Links are always underlined: navy is 1.01:1 against `--fg` | 17.99:1 card, 16.23:1 bg |
| `--primary-hover` | `#1b2547` | | white on it 14.98:1 |
| `--primary-soft` | `#eff2fa` | Mist (`#eef2fa`, one step lighter so fg-3 on it is 4.51:1): selected nav item tint, info chip bg | primary on it 16.07:1 |
| `--action` | `#18181b` | Primary button fill (near-black CTA) | white on it 17.7:1 |
| `--action-hover` | `#2c2c31` | | |
| `--action-top` / `--action-bottom` | `#323137` / `#201e25` | Primary button gradient over `--action`, top to bottom (§3.7); a palette other than Current aliases both to `--action` | white on them 12.88 / 16.49:1 |
| `--action-hover-top` / `--action-hover-bottom` | `#3c3b42` / `#29272f` | The same gradient on hover | white on them 11.07 / 14.73:1 |
| `--action-ring` | `#0d0d0d` | The primary button's ring: its 1 px border, inside the box | non-text |
| `--action-edge-top` / `-mid` / `-bottom` | `#4b4951` / `#31303a` / `#18171b` | The lit edge just inside the ring (inset shadows): top, sides, bottom | non-text |
| `--row-selected` | `#f5f9ff` | Selected table row | primary 17.03:1 |
| `--brand-ink` | `#0d1530` | Logo letters only (`components/brand`) | logo, exempt |
| `--brand-sun` | `#ffa928` | Logo sun only; amber is never a UI colour | logo, exempt |

Status (reserved — never used as series colours). Each has a mark (icon/dot), an ink (text, ≥ 4.5:1 on its soft)
and a soft (chip bg):

| State | Mark | Ink | Soft | Shape |
|---|---|---|---|---|
| Healthy | `#16a05a` | `#117a46` | `#e9f7ef` | filled circle-check |
| Degraded | `#c96a05` | `#b25309` | `#fff2e6` | triangle |
| Down | `#e5303a` | `#c8262f` | `#feeced` | circle-x |
| Stopped | `#8a8a93` | `#55555c` | `#f1f1f3` | square |
| Unknown | `#a1a1aa` (dashed ring) | `#55555c` | `#f1f1f3` | dashed circle |

Contrast verified: Healthy ink on soft 4.88:1, Degraded 4.62:1, Down 4.88:1, Stopped ink on soft 5.54:1;
marks ≥ 3:1 on white (3.38 / 3.79 / 4.36) except Stopped/Unknown, which are always paired with their label.
`--down-soft-hover` `#fde3e5` (dark `#4d2024`) is the Danger button's hover fill, one step stronger than Down soft:
Down ink on it 4.58:1 (dark 5.39:1), pinned by `tokens.test.ts` "text down-ink on down-soft-hover ≥ 4.5:1".

### 3.2 Colour — dark

| Token | Hex | Notes |
|---|---|---|
| `--bg` | `#0e0e10` | |
| `--sheet` | `#151517` | |
| `--tray` | `#1a1a1d` | |
| `--card` | `#1f1f23` | chart surface (validator run against it) |
| `--inset` | `#18181b` | wells are *darker* than the card in dark |
| `--raised` | `#26262b` | popovers + `0 0 0 1px #2c2c31` ring |
| `--line` | `#2c2c31` | |
| `--line-strong` | `#3a3a40` | |
| `--grid` | `#2c2c31` | dashed |
| `--fg` | `#f2f2f3` | 14.7:1 on card |
| `--fg-2` | `#a8a8b1` | 6.96:1 |
| `--fg-3` | `#8e8e98` | 5.06:1 card, 4.64:1 raised |
| `--fg-4` | `#5d5d66` | decorative |
| `--primary` | `#c9d3f0` (text `#0d1530`) | navy tint: 11.00:1 card, 12.91:1 bg; navy on it 12.05:1 |
| `--primary-hover` | `#dde3f6` | navy on it 14.05:1 |
| `--primary-soft` | `#18233a` | primary on it 10.49:1 |
| `--brand-ink` / `--brand-sun` | `#ffffff` / `#ffa928` | logo only (dark version of the kit) |
| `--action` | `#f2f2f3` (text `#151517`) | the CTA inverts to white in dark |
| `--action-top` / `--action-bottom` | `#f4f4f5` / `#e4e4e7` | primary button gradient; `#151517` on them 16.59 / 14.37:1 |
| `--action-hover-top` / `--action-hover-bottom` | `#ffffff` / `#ececef` | `#151517` on them 18.24 / 15.47:1 |
| `--action-ring` | `#d4d4d8` | the ring; upstream's 60 % black is lost on a dark page, so inside the box it is the edge's darkest stop |
| `--action-edge-top` / `-mid` / `-bottom` | `#ffffff` / `#ececef` / `#d4d4d8` | the lit edge |
| `--control-border` | `#80808c` | field boundary, 4.21:1 on card |
| `--row-selected` | `#172033` | |
| Healthy | mark `#3ec27e` · ink `#4cc98a` · soft `#143323` | ink/soft 6.57:1 |
| Degraded | mark `#ea7a3a` · ink `#ee8548` · soft `#3a2614` | ink/soft 5.51:1, mark on card 5.74:1; kept ≥ 1.3:1 from the sun (1.49 / 1.36), amber is the logo's only |
| Down | mark `#ff6b70` · ink `#ff7a7f` · soft `#3d1a1d` | 6.12:1 |
| Stopped | mark `#7d7d86` · ink `#a8a8b1` · soft `#2a2a2f` | 6.05:1 |
| Unknown | mark `#5d5d66` dashed · ink `#a8a8b1` · soft `#2a2a2f` | |

### 3.3 Categorical chart palette (6 slots, fixed order)

| Slot | Hue | Light | Dark | Typical entity |
|---|---|---|---|---|
| 1 | blue | `#1a7cf0` | `#3a8ff5` | primary series, "Success", role A |
| 2 | orange | `#e8690c` | `#d9692a` | comparison series, "Failed", role B |
| 3 | teal | `#0f9e86` | `#1a9c86` | role C |
| 4 | violet | `#8a3ff0` | `#9b6bf0` | role D |
| 5 | ochre | `#b88700` | `#b8890f` | role E |
| 6 | magenta | `#d6428e` | `#d65592` | role F |

Role chips: Superadmin slot 4 (violet), Admin slot 1 (blue), Viewer `neutral` (grey, no hue), any other role slot 3, so
they never read as the green/orange status pills beside them (`apps/web/src/components/role-chips.tsx`).

Rules: hue follows the entity, not its rank (a fixed map per entity, e.g. `role-chips.tsx`); a 7th series folds
into "Other" (`--fg-3`); scatter/heatmap-like all-pairs forms use at most slots 1–3. Sequential (magnitude,
heatmap) = slot-1 blue ramp: light `#ebf4ff #cfe3fd #a6cbfa #74adf5 #3f8cef #1a7cf0 #0f5fc2 #0a4590`, dark
`#162236 #1b3254 #214577 #2a5c9e #3a78cc #5aa6ff #8cc1ff #bfdcff`. Texture: 45° stripes, 2 px line / 4 px gap at
35 % white (light) or 25 % black (dark) on top of the fill — every bar's surface (§6.3); a partial or projected
series is told apart by its soft tint, not by the texture.

**CVD validation** (`validate_palette.js` from the dataviz skill, run 17 Oct 2026):

```
$ node validate_palette.js "#1a7cf0,#e8690c,#0f9e86,#8a3ff0,#b88700,#d6428e" --mode light --surface "#ffffff"
Palette (light, surface #ffffff, categorical): 6 slots
  [PASS] Lightness band         all 6 inside L 0.43–0.77
  [PASS] Chroma floor           all 6 >= 0.1
  [PASS] CVD separation         worst adjacent #0f9e86↔#e8690c ΔE 12.7 (protan) · tritan 12.0
  [PASS] Normal-vision floor    worst adjacent #d6428e↔#b88700 ΔE 24.1 (normal)
  [PASS] Contrast vs surface    all 6 >= 3:1
  → ALL CHECKS PASS

$ node validate_palette.js "#3a8ff5,#d9692a,#1a9c86,#9b6bf0,#b8890f,#d65592" --mode dark --surface "#1c1c1f"
Palette (dark, surface #1c1c1f, categorical): 6 slots
  [PASS] Lightness band         all 6 inside L 0.48–0.67
  [PASS] Chroma floor           all 6 >= 0.1
  [PASS] CVD separation         worst adjacent #1a9c86↔#d9692a ΔE 12.1 (protan) · tritan 9.8
  [PASS] Normal-vision floor    worst adjacent #d65592↔#b8890f ΔE 21.9 (normal)
  [PASS] Contrast vs surface    all 6 >= 3:1
  → ALL CHECKS PASS
  (re-run against the final dark card #1f1f23: identical results, ALL CHECKS PASS)

$ node validate_palette.js "#1a7cf0,#e8690c,#0f9e86" --mode light --surface "#ffffff" --pairs all
  [PASS] CVD separation         worst all-pairs #0f9e86↔#e8690c ΔE 12.7 (protan) · tritan 4.4
  [PASS] Normal-vision floor    worst all-pairs #0f9e86↔#1a7cf0 ΔE 20.9 (normal)
  → ALL CHECKS PASS

$ node validate_palette.js "#3a8ff5,#d9692a,#1a9c86" --mode dark --surface "#1c1c1f" --pairs all
  [PASS] CVD separation         worst all-pairs #1a9c86↔#d9692a ΔE 12.1 (protan) · tritan 5.0
  [PASS] Normal-vision floor    worst all-pairs #1a9c86↔#3a8ff5 ΔE 18.6 (normal)
  → ALL CHECKS PASS
```

Why this order: blue next to violet is a common pairing, but blue↔violet collapses under deuteranopia
(ΔE 2.7 all-pairs), so violet moves to slot 4 and teal/orange take 2–3.

### 3.4 Radii, elevation, shadows

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4 px | checkbox, ticks, heatmap cells (3 px) |
| `--radius-tick` | 2 px | tick meter ticks (§5.10) |
| `--radius-sm` | 6 px | category chips, kbd; segments and their thumb inside a segmented or default-tabs track; a button nested in a field |
| `--radius-md` | 10 px | buttons, inputs, nav items, pagination, menu items, UI tooltip, notices |
| `--radius-ctl` | 10 px | segmented and default-tabs track; the chart tooltip and chart wells are 10 px too (`charts.css`) |
| `--radius-lg` | 16 px | inner cards, menus, popovers, toasts |
| `--radius-xl` | 20 px | trays, sheet, dialog |
| `--radius-full` | 9999 px | status pills, count badges, progress bars, avatars |

Values since the re-skin (§3.7; before it md 8, lg 12, xl 16), defined in the `@theme` block of `base.css` and pinned
by `tokens.test.ts` "radius scale: md 10, lg 16, xl 20; xs, sm, tick, ctl, full unchanged; xl − tray padding = lg".

Nesting rule: inner radius = outer radius − tray padding (20 − 4 = 16). An element nested in a smaller parent, or
under about 24 px tall, sits one step down. The exceptions made for the new scale:

| Element | Sits on | Why |
|---|---|---|
| Segments, the thumb and the shared indicator of `Segmented` and default `Tabs` | `--radius-sm` (was md) | the track is 10 px with 2 px padding: 10 − 2 = 8, so 10 would be rounder than the track allows (`ds/segmented.tsx`, `ui/tabs.tsx`; `markup.test.ts` "Segmented: the track keeps its 1 px box…") |
| A button inside a `--radius-md` field: number steppers, the password toggle, the date picker's calendar button | `--radius-sm`, set in `base.css` | nested in a 10 px field (`tokens.test.ts` "a button nested in a field sits one radius step under it") |
| `StatusChip wrap` (the multi-line chip, 22 px minimum) | `--radius-lg` (was xl) | a small element (`ds/status-chip.tsx`) |
| The collapsed filter rail (48 px wide) | `--radius-lg` (was xl) | 20 px on a 48 px wide box is close to a full pill at 24 px (`ds/filter-panel.tsx`) |
| `Notice` and the sign-in form error (one line = 40 px) | `--radius-md` (was lg) | 16 px on a 40 px box leaves 8 px straight and reads as a pill (seen on the /ds/data baseline; `ds/notice.tsx`, `features/auth/auth-card.tsx`) |
| The time range's error bubble (26 px) | `--radius-sm` (was md) | a small element: 10 px on 26 px is close to a pill (`ds/date-range-control.tsx`) |

The other one-line boxes on `--radius-lg` (the `Disclosure` summary 44 px, radio cards) stay on the token; at 16 px
their corners are large for the height and have not been reviewed by eye.

| Level | Surface | Light | Dark |
|---|---|---|---|
| 0 | bg | — | — |
| 1 | sheet, tray | 1 px `--line` | 1 px `--line` |
| 2 | card; a secondary button; a field at rest (§5.12) | 1 px `--line` (a field: `--control-border`) + `--shadow-xs` `0 1px 2px rgb(21 21 24 / 0.04)` | 1 px line, no shadow; a card also has the inner top highlight `inset 0 1px 0 rgb(255 255 255 / 0.03)` |
| 2 | primary button | no shadow outside the box: the ring is its 1 px border (`--action-ring` `#0d0d0d`), the lit edge three inset shadows | ring `#d4d4d8` |
| 3 | active segment, active nav, hovered card | `--shadow-sm` `0 1px 2px rgb(21 21 24 / 0.06), 0 1px 1px rgb(21 21 24 / 0.04)` | fill `#2c2c31` |
| 4 | popover, menu, tooltip, dialog | `--shadow-overlay` `0 1px 2px rgb(21 21 24 / 0.06), 0 12px 32px rgb(21 21 24 / 0.12)` | `0 0 0 1px #2c2c31, 0 16px 40px rgb(0 0 0 / 0.5)` |

### 3.5 Typography

- **Sans: Inter Variable** (`@fontsource-variable/inter`, OFL). `font-feature-settings: "cv11", "ss01"` off; `"tnum"` on for every number.
- **Mono: Geist Mono Variable** (already installed) for machine values only: IDs, IPs, hashes, codes, permission
  names, usernames, timestamps in tables. Never for words people read as words: names, emails, search text, labels.

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 32 / 40 | 400 | −0.02em | Dashboard hero number |
| `title-1` | 22 / 28 | 600 | −0.02em | Page title |
| `title-2` | 15 / 22 | 500 | −0.01em | Panel title |
| `title-3` | 14 / 20 | 600 | −0.006em | Card title, dialog section |
| `stat` | 28 / 32 | 400 | −0.02em | KPI value (unit/denominator at `body`, `--fg-3`); regular, not bold, so the number reads light |
| `stat-sm` | 20 / 28 | 400 | −0.01em | Card metric (CPU 52 %) |
| `body` | 14 / 20 | 400 | −0.006em | Default, table cells |
| `body-sm` | 13 / 18 | 400 | 0 | Secondary line, descriptions |
| `label` | 12 / 16 | 500 | 0 | Chips, field labels; table header cells use it at 400 (`ui/table.tsx`) |
| `caption` | 11 / 16 | 400 | 0.01em | Axis ticks, footnotes |
| `eyebrow` | 11 / 16 Inter | 500 | 0.04em uppercase | Sidebar section labels, tooltip period |

Numerals: tabular everywhere numbers stack; minor parts (decimals, units, "/ 100 %") in `--fg-3` at one step
smaller; negative values use the true minus sign `−`.

### 3.6 Spacing scale

4 px base: `0 · 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`. Control heights: 28 (sm), 32 (default),
36 (nav item, lg), 40 (table header, login input 40). Icons: Hugeicons Stroke Rounded (`@hugeicons/core-free-icons`, rendered by the local `Icon` in `packages/ui/src/ui/icon.tsx`;
one icon per meaning, taken only from `packages/ui/src/ui/icons.ts`), `currentColor` with text tokens, 16 px (stroke 1.5)
in nav, toolbars, panel headers and KPI tiles, 14 px in chips, 20 px in empty states. Table column headers carry no
icon: the table's card header names it with its icon ("All users"), the columns are words only.

### 3.7 affectUI look (re-skin) (2026-11-14)
The shared components in `ui/` and `ds/` take the look of their affectUI twins (`packages/ui/src/affect/`, MIT) at
the starterkit's density, at the owner's request (DEC-031). The starterkit's default control, 32 px, is the height
of affectUI's `sm` button and `sm` text field, so the look is adopted at that size. The values live in
`tokens.css`, the `@theme` block of `base.css` and a few `base.css` rules; no screen sets them. What was run, and
what has not been seen in a browser, is recorded in DEC-031.

Adopted:
- **Density is unchanged.** Control heights 28 / 32 / 36 (login 40), paddings, the type scale (§3.5), the 44 px
  touch area (§0) and every spacing token (§3.6) are as before. (`ds-components.spec.ts` "header time controls share
  one height and baseline with search"; `responsive.spec.ts` "touch targets of visible controls are at least
  44 × 44 px on every page")
- **Radius scale.** `--radius-md` 8 → 10 px, `--radius-lg` 12 → 16 px, `--radius-xl` 16 → 20 px; `xs`, `sm`, `tick`,
  `ctl` and `full` stay. The nesting rule still holds (20 − 4 = 16); the elements that moved one step down are
  listed in §3.4. (`tokens.test.ts` "radius scale: md 10, lg 16, xl 20; …")
- **Primary button.** `--action` under a top-lit gradient (`--action-top` → `--action-bottom`), a 1 px ring
  (`--action-ring`) and a lit edge (`--action-edge-top` / `-mid` / `-bottom`); the hover stops are
  `--action-hover-top` / `-bottom`. The stops are the light and dark values of
  `packages/ui/src/affect/button.tsx`. Unlike upstream, all of it is inside the box: the ring is the transparent
  1 px border (a second background layer) and the edge three inset shadows just inside it (top, bottom, the middle
  stop down the sides), so a 32 px button draws 32 px beside its neighbours (§5.2) and the focus outline keeps its
  2 px gap. Upstream's ring is a 1 px spread outside the box, which drew 34 px. In dark the ring is `#d4d4d8`, the
  edge's darkest stop: upstream's 60 % black is lost on a dark page. The label stays above 4.5:1 on every stop:
  light 12.88 / 16.49, hover 11.07 / 14.73; dark 16.59 / 14.37, hover 18.24 / 15.47. A palette other than Current
  (`palettes.css`) aliases the stops, the edge and the ring to its flat `--action`, since the stops are tuned for
  Current only.
  The rule is `.bg-action[data-variant="default"]` in `base.css`: under an `asChild` trigger the `data-slot` is the
  trigger's, so the class and the variant are the key, and a caller that replaces `bg-action` loses the gradient.
  (`tokens.test.ts` "the primary button's gradient, edge and ring are tokens, …", "the primary button draws nothing
  outside its box: …", "a palette other than Current
  keeps its flat --action on the primary button", "text action-fg on action-top ≥ 4.5:1" and its three siblings;
  `packages/ui/src/ui/button.test.ts` "default: …", "under an asChild trigger …")
- **Danger button.** A soft Down fill (`--down-soft`) with `--down-ink` text, no border and no shadow; hover
  `--down-soft-hover`. Down ink on the fill 4.88:1, on the hover fill 4.58:1 (dark 6.12 / 5.39). Disabled is the
  one state with an edge, `--down-mark`: at 0.4 the soft fill alone is 1.05:1 on the card (dark 1.02:1), so the box
  would be lost; the edge is about 1.8:1 there (dark 2.0:1), the weight of the disabled label (1.87:1).
  (`button.test.ts` "destructive: a soft Down fill with Down ink and no border or shadow"; `tokens.test.ts` "text
  down-ink on down-soft-hover ≥ 4.5:1", "a disabled Danger button keeps a boundary: …")
- **Secondary button.** Card fill, `--line` instead of `--line-strong`, `--shadow-xs` kept; `outline` is the same.
  The header's button groups drawn in the same look by hand (the search trigger, the time range group and the
  refresh group, §5.2) take `--line` too, so one row has one edge weight. They hold buttons, not a text input, so
  the 3:1 field boundary does not apply to them. (`button.test.ts` "secondary: card fill, --line edge, shadow-xs")
- **Press and disabled.** `--press-scale` 0.98 → 0.97; a natively disabled button 0.5 → 0.4. `BlockedButton` stays
  at 0.5 (`aria-disabled`): it keeps focus and its label must stay readable. (`tokens.test.ts` "press scale 0.97";
  `button.test.ts` "default: …")
- **Fields.** Input, select, textarea, affix and number input rest on `--shadow-xs` (light; the token is `none` in
  dark), one `:where()` rule in `base.css`, so the focus ring replaces it; the input inside an affix or number
  field has none. The boundary stays `--control-border` (3.65:1 on card, dark 4.21:1), and `Textarea`, the
  confirm dialog's audit note and the combobox field (`ds/combobox-search.tsx`) now use it too (they had
  `--line-strong`, 1.37:1). Focus ring, invalid wash and
  placeholder are as before. (`tokens.test.ts` "fields rest on --shadow-xs at zero specificity; …"; the boundary:
  "… keeps body text, action labels and field boundaries accessible" for the four palettes)
- **Menus and popovers.** Panel and row radius follow the tokens (16 and 10 px). Padding stays 4 px and rows 32 px:
  affectUI's 5 px padding is not on the spacing scale and lies midway between 4 and 6, and its 34 px row is off the
  28 / 32 / 36 heights. No class changed in `dropdown-menu-impl.tsx` or `popover-impl.tsx`.
- **Segmented control, default tabs, pagination.** The track draws no line: its 1 px border is transparent
  (`.rounded-ctl.bg-tray` in `base.css`), so the box stays 34 px; a third element with both classes would lose its
  line too. The current page is a tray fill without a line. (`tokens.test.ts` "the segmented / default-tabs track
  keeps its 1 px box but draws no line"; `packages/ui/src/ds/markup.test.ts` "Segmented: …", "Pagination: …")
- **Cards and panels** follow the radius tokens only: tray 20, card 16. Shadows, the surface steps
  (bg → sheet → tray → card), colours, ink and the primary and focus colour did not change.
- **Vendored items** keep following the app through the `--aui-*` aliases (§7.10) and now draw 6 / 10 / 16 px,
  against upstream's own 12 px button, 10 px text field and 16 px card.

Not adopted, and why:
- **40 px controls.** affectUI's default button is 40 px and its default text field 36 px. The density rules (§0,
  §3.6) and `ds-components.spec.ts` pin 32.
- **affectUI's faint field edge** (`#e6e6e8`, 1.25:1 on white; its stronger edge `#d4d4d8`, 1.48:1). A field's
  boundary needs 3:1 (WCAG 1.4.11), which `--control-border` gives.
- **Its blue focus ring** (`rgba(0, 96, 226, 0.7)`). Focus stays `--primary` (§9).
- **Blur** (`filter: blur()` in upstream's label and message swaps). §7.7 allows `transform` and `opacity`; Text
  Reveal is the one `filter` animation (R10).
- **Its type sizes** (13.5 px in a text field, 13 px in a small button). The type scale of §3.5 is unchanged.
- **The drop under the primary button** (`0 2px 4px`): a button is not a floating layer (§3.4). **Its ring outside
  the box**: the ring is drawn as the border instead (above), since header controls share a 32 px drawn height.

Known limits:
- In dark a secondary button's edge is `--line` on card, 1.18:1, with no shadow (`--shadow-xs` is `none`); the
  header's search, time range and refresh groups have the same edge.
- The combobox field and OTP cells have no resting drop; the header groups have none either, beside a secondary
  button that has one in light.
- A disabled Danger button's label is 1.87:1 (dark 2.08:1) at 0.4; a disabled control is exempt from WCAG 1.4.3,
  and its edge keeps the box visible (above).
- In `ConfirmActionDialog` the Danger confirm button and the failure alert now share the Down soft fill and ink.
- Forced-colors mode is not checked for the gradient.
- Figma is not updated. The code is ahead of the Figma file for everything in this section; a versioned draft is
  owed (`docs/standards/figma-versioning.md`, "Code ahead of Figma").

---

## 4. Shell

```
┌──────────────────────┐ ┌───────────────────────────────────────────────────────────────────┐
│ [■] App name      [⫞]│ │ ▦ Users / Rina Wulandari                                          │
│ ──────────────────── │ │ ───────────────────────────────────────────────────────────────── │
│                      │ │                                                                   │
│ MAIN                 │ │  Page title            [Last 24 h ▾] [Legend] [Action]            │
│ [▦ Dashboard       ] │ │  One sentence scope + freshness.                                  │
│  ▣ Users             │ │  ┌ All users 50 ───────────── [⌕ Search] [Role ▾] [Status ▾] ⓘ ┐ │
│ ACCESS               │ │  …                                                                │
│  ⛨ Roles             │ │                                                                   │
│  ⚿ Permissions       │ │                                                                   │
│ AUDIT                │ │                                                                   │
│  ☰ Activity log      │ │                                                                   │
│  ⇥ Sign-in log       │ │                                                                   │
│                      │ │                                                                   │
│ ─────────────────    │ │                                                                   │
│  ◫ Design system     │ │                                                                   │
│ (RW) Profile       ▾ │ │                                                                   │
└──────────────────────┘ └───────────────────────────────────────────────────────────────────┘
```

On a design system page (`/ds` or below) the item is open and lists its eight pages; the open one carries the
highlight:

```
│  ◫ Design system     │
│  ├─ Overview         │
│  ├─ Foundations      │
│  ├[ Components     ] │
│  ├─ Forms            │
│  ├─ Feedback         │
│  ├─ Data display     │
│  ├─ Illustrations    │
│  ╰─ Motion           │
│ (RW) Profile       ▾ │
```

The top navbar holds the breadcrumb, applicable custom date range/refresh controls and search (⌘K anywhere). Account, profile, theme, palette and density live in the sidebar footer (inside the navigation drawer on phones). Date controls appear only on Dashboard and audit logs; refresh appears only on live-data modules. Forms and other modules without live data hide both controls. Shared Calendar/DatePicker and RefreshControl use custom popovers/menus. The range picker has a calendar quick-select segment, a Show dates summary and separate Absolute / Relative / Now endpoint editors. Quick select includes amount/unit, common and recent ranges, and Refresh every; precise ranges apply as one draft. Header range arrows, date trigger, refresh group and search share a 32 px drawn height and vertical alignment; touch targets remain at least 44 px. Submenu trunks connect with curved elbows and stop at the last child. Route tabs use grey active fill. Login artwork covers the entire page without a frame.

Phone (below 768 px): the sidebar is not shown. The top bar holds the menu button ("Open navigation", 32 px), the logo
mark, the nav page's name as its title and search as a 32 px icon button. Account and theme stay in the drawer footer. Applicable time controls occupy a second row. The menu button opens the same sections in a drawer from the left (`Drawer`, `packages/ui/src/ui/drawer.tsx`:
a Radix dialog loaded through `deferred-overlay`): 288 px (at most 5/6 of the width), items 44 px, focus trapped,
Escape and the scrim close it, any route change closes it, the page behind is `inert`, focus returns to the menu
button (`packages/ui/src/ui/drawer.test.ts`, `responsive.spec.ts` "phone"). The bar is server-rendered and switched by
CSS, so it never shifts on first paint.

Rules: the nav is exactly Dashboard, Projects, Users, Roles, Permissions, Activity log, Sign-in log, Design system and Profile
(own sessions live at /me/sessions and on a user's detail page; there is no global Sessions page). Design system
alone has a submenu, its eight pages in this order: Overview (`/ds`), Foundations (`/ds/foundations`), Components
(`/ds/components`), Forms (`/ds/forms`), Feedback (`/ds/feedback`), Data display (`/ds/data`), Illustrations
(`/ds/visuals`) and Motion (`/ds/motion`) (`apps/web/src/lib/shared/nav.test.ts` "Design system lists its eight pages
in order, without icons", `apps/web/src/features/ds/pages.test.ts`). Nav items carry no
badges; count badges elsewhere are counts, never words ("New" pills are not used). A hairline separates the logo from
the nav. The nav scrolls inside the sidebar when the menu is longer than the window, in a `ScrollArea`
(`packages/ui/src/ui/scroll-area.tsx`): no native scrollbar, a 4 px thumb drawn in the sidebar's padding, shown on
hover, focus or while scrolling, so menu rows share one width on every system. In the
rail (below 1280 px, or collapsed) each navigation control is a centred 36 px square, and a hairline
separates the groups in place of their hidden labels. An item may optionally have `children`
(`NavItem.children` in `apps/web/src/lib/shared/nav.ts`): views of its own page (the same path, a filter in the
query) or pages below it (a sub-route; they share the item's permission and breadcrumb),
shown under it with a connected vertical trunk and curved branch lines while the page or a page below it is open, in the
expanded sidebar (≥ 1280 px) and the phone menu; the open child carries the highlight and `aria-current`, the item
itself then has none (`activeChild`: a sub-route child on its path or below it, a child on the item's own path only on
that exact path; `nav.test.ts` "a sub-route child is active on its path and below it; the child on the parent's path
only on that exact path"). In the icon
rail, leaf links use the standard inverse tooltip on hover/focus. A parent shows the same label tooltip and a small
chevron; click, tap, Enter or ArrowDown opens the shared non-modal menu to its right with its children and the current one
highlighted (Design system is the one parent today). Tooltips contain labels only. The flyout supports arrow keys, Escape, outside dismissal and focus return;
its tooltip stays quiet while the menu is open and when focus returns. Expanding the sidebar or resizing out of the
rail closes the flyout when CSS hides its trigger. The expanded tree and phone drawer retain their existing links.

Users is a single direct destination, without All/Active/Inactive navigation children (DEC-022). This applies to the
expanded sidebar, collapsed/tablet rail, phone drawer, command palette and G U. The rail uses the leaf tooltip/link,
not a Users submenu. Status multi-selection, chips and saved views remain on the Users page; old filtered URLs stay
valid. Navigation restores the existing remembered view rather than resetting to All (`viewHref`, `prefs.test.ts`,
`nav.test.ts`, `tests/e2e/sidebar-rail.spec.ts`). Optional child support remains available for other nav items.

Breadcrumb (top bar): the nav page, then the open page's parents and itself: `Users / Rina Wulandari`, `Users /
Rina Wulandari / Edit user`, `Roles / Admin`, `Profile / Security`. `PageHeader` publishes its title as the last crumb
on a sub-page (`trail` adds parents; `apps/web/src/lib/client/crumb-trail.ts`); every crumb but the last links back.
On a phone the bar shows the nav page only (it is the bar's title, in the server HTML).

---

## 5. Components

### 5.1 Sidebar nav item
36 px tall, radius 10, padding 0 10, icon 16 + 10 gap + `body` label.
States: rest fg-2 · hover `--tray` fill · active **light** `--card` fill + 1 px `--line` + `--shadow-sm`, fg, icon
filled; **dark** `#26262b` fill · focus ring 2 px `--primary` offset 2. Section label `eyebrow` `--fg-3`, 24 px above,
8 px below.

### 5.2 Top bar
56 px, bottom 1 px `--line`. Breadcrumb: 16 px icon + `body` per crumb, separator `/` in `--fg-4`, current crumb fg,
ancestors fg-2 (links). Header controls share a 32 px drawn height, radius 10 and aligned centers. Search: 176 px wide on desktop, 32 px icon button below desktop, 1 px `--line` (the edge of a secondary button, as on the time range and refresh groups), leading icon; ⌘K opens it globally. Range arrows are 32 × 32. The refresh group includes its border within the 32 px height. Date and refresh controls hide when unused; phone time controls use a second row.

### 5.3 Buttons
| Variant | Fill | Text | Border | Height |
|---|---|---|---|---|
| Primary | `--action` under a top-lit gradient, `--action-top` → `--action-bottom` (hover: `--action-hover-top` → `--action-hover-bottom`, swapped without a fade) | white (dark: `#151517`) | the 1 px ring `--action-ring` as the border, the lit edge (`--action-edge-top` / `-mid` / `-bottom`) inset just inside it; nothing outside the box | 32 (28 sm) |
| Secondary | `--card` | fg | 1 px `--line` + `--shadow-xs` | 32 |
| Ghost | transparent → `--tray` on hover | fg-2 | none | 32 |
| Danger | `--down-soft` → `--down-soft-hover` on hover | Down ink | none, no shadow; disabled: 1 px `--down-mark` | 32 |
Padding 0 12, icon 16 + 6 gap, radius 10, `label`→ `body` 14/500. Press: scale 0.97 (`--press-scale`, §7.5).
Disabled: opacity 0.4; a `BlockedButton` stays at 0.5, since it keeps focus and its label must stay readable. One
primary per page. The primary's gradient, edge and ring are drawn by `base.css` on
`.bg-action[data-variant="default"]` (under an `asChild` trigger the `data-slot` is the trigger's, so the rule keys on
the class); under a palette other than Current the button is flat `--action`. Values, contrast and
tests: §3.7.

### 5.4 Panel (tray + card) — the v3 signature
```
┌ tray (radius 20, --tray, 1px line, padding 4) ───────────────────────────┐
│  ◫ Panel title · caption            [segmented] [Last 7 d ▾] [⋯]        │  ← header on tray: 44 px, padding 0 12
│ ┌ card (radius 16, --card, 1px line, shadow-xs, padding 16) ───────────┐ │
│ │ content (chart / table / list)                                       │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│  footnote / StaleNote (optional, caption, padding 8 12)                  │
└──────────────────────────────────────────────────────────────────────────┘
```
- Title `title-2` with a 16 px fg-3 icon; optional count pill; actions right. A tray may hold 2–4 cards side by side
  with a 4 px gap (KPI strip, legend cards).
- Tables: the table **is** the card (header row on the card top uses `--tray`, rows `--card`).
- Every standalone content card, including login, forms and Home summaries, uses the outer tray. `flat` is reserved for content already enclosed by a floating dialog.

### 5.5 KPI tile (`StatTile`)
Lives in a KPI tray (4 tiles, 4 px gap). Tile = card, padding 16, min-height 104.
```
┌──────────────────────────────┐
│ ◎ Active users         ↑ 3  │  label: 16 icon + body-sm fg-2; delta pill right
│                              │
│ 19 / 24                      │  stat 28 fg  + " / 24" body fg-3
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░ 79 %     │  optional 6 px striped progress or 28 px sparkline
└──────────────────────────────┘
```
Delta pill: 20 px, radius full, padding 0 6, `label`, arrow 12 px; good = Healthy ink on Healthy soft, bad = Down
ink on Down soft, neutral = fg-2 on `--tray`. Direction of "good" is set per metric (cost up = bad). Caption
"vs previous 24 h" in `caption` fg-3. Number tween on change (§7.4). The value is the tile's accessible name
together with its label.

### 5.6 Toolbar & filters
Active direction: **FIL-DES-004 / DEC-019** rail/refresh, **FIL-DES-003 / DEC-018** anchor, DEC-017 live multi.
Module lists share FilterLayout. From `md`, collapsed rail is48 px wide and **hugs its content**, with py12/gap12:
sidebar toggle16, filter16, optional CountBadge18, vertical Filters box44 (Inter14/500/line20). Center items with at
least4 px side clearance. Reference156 px with badge /126 without is derived from content/padding/border, not a fixed
height. No full-height/min-height track, bottom constraint or empty stretch on collapsed rail.

For the RIGHT filter, expand-left uses SidebarCollapseIcon (PanelLeftOpenIcon); expanded collapse-right uses
SidebarExpandIcon (PanelLeftCloseIcon). Their aliases describe the left navigation, so preserve the action's physical
direction and accessible name. No generic chevrons. Phone Close remains X.

Rail/panel start **at the first visible content surface after the nearest local PageHeader, with no added gap**.
A preceding Notice/KPI counts; hidden siblings do not. Use the outer card/table region, not thead or global header.
Nested design system demos without a local PageHeader (`/ds/data`) use their own results. Maintain constant64 px end clearance so rail
cannot cover row actions. Expansion320 adds no further gutter/reflow; desktop is nonmodal without scrim/inert/trap.
Expanded header stays fixed, body scrolls, bottom clearance16. Saved views, Columns and Export remain in Panel toolbar.

Scroll bounds protect visible PageHeader: max(16, content.top, visiblePageHeader.bottom). Stable CSS inline sticky rail
in its owning first-surface wrapper is accepted; naturally offscreen content is never hoisted over earlier sections.
Pointer events belong only to visible controls, not the transparent lane. Keyboard focus may scroll its own surface
into view. Do not reparent the collapsed rail or switch JS visibility to mask hydration. Initial SSR/count/theme/height
must match the final collapsed state and content layout; no wrong-position/full-track flash or independent rail entry
pop/fade/translate on refresh. If a measurement fallback is unavoidable, insert once statically at correct geometry;
hiding until hydrated alone does not prove the flicker fixed.

At CSS viewport-height<=399 px, desktop uses one48x44 compact button: filter16 over optional badge18/gap2, no toggle
glyph or vertical label. At>=400 regular hug is used. This is CSS from first paint, not a post-hydration height change.
Explicit open with available height<160 may scroll the actual surface to safe16 then remeasure/focus; no scroll-back
on collapse. Expanded portal height remains unchanged. User-triggered toggle motion keeps existing tokens; reduced
motion is opacity-only/no spatial movement. Startup whole-page motion must not introduce an independent rail cycle.
Check rail and ancestor animationName/opacity/transform through SETTLED, not just READY or a final still image.

Below `md`, keep the horizontal Filters/count launcher row and modal phone bottom sheet (max90dvh, safe-area,
scrollable body, Close header, no Apply footer). Initial open focuses heading. Explicit Close/Escape restores trigger;
desktop outside click/focus collapses while preserving target action/focus, no pointer through opaque panel. Resize
preserves open/search/selections/groups and restores the same field by stable id; Radix semantic remount is allowed,
with one visible control tree. Coarse targets44 px and input16 px remain required.

Search remains visible. Category filters use independently collapsible **multi-checkbox groups**, expanded on first
open, with local group state retained across collapse/reopen. None selected means unrestricted; OR within a group,
AND across groups. Selected-option summaries/counts are not facet counts. Do not add domain fields or option result
counts from screenshots. Roles search-only has no invented category. Static groups show6 options then Show more/less;
roles remain paged/searchable, preserving selected values outside the current options page. Option loading/error has
local skeleton/retry and never clears selections or claims an error is an empty result.

Checkbox changes auto-apply immediately, history push/page1, and keep the sidebar open. Search uses **300ms debounce**,
history replace; Enter/blur/collapse flush. A checkbox flushes pending search and its toggle as one atomic snapshot.
Clear all immediately clears text/categories and cancels the timer, preserving sort/pageSize/header date; push only
when applied criteria change. Pending text alone still enables Clear. Back/view/chip/external state cancels pending
search and adopts the latest snapshot; late results cannot restore old criteria. Badge = selected checkbox options +1
for nonempty applied search. Chips are per selected option; there is no draft, Apply, Applied, Unapplied or category radio.

Keep checked state/URL on GET error. Retained results show Updating results or an honest error/stale notice with Retry;
requests must match the latest snapshot. At50 selections/group, block only additional unchecked choices with an inline
reason; uncheck/Clear remain enabled. Named views allow4096 characters; automatic remembered navigation remains300:
over300 clears stale remembered state and explains Save view, without truncating URL criteria. Over4096 Save gives a
recoverable error. API encoding/canonical rules remain DEC-017's contract, not a design-only parser choice.

Keep deferred overlays recoverable: before primitive arrives, launcher busy/status+Retry without claiming modal;
after shell is available, local fields can load/retry with Close reachable. Use existing colors/radii/motion/shadow,
Inter/Geist Mono and reduced motion. `/ds/data` (`#ds-tables`) demonstrates the shared pattern; do not ship per-feature variants.
[Complete active UX and QA acceptance](../design.md#fil-des-004--rail-hug-content-ikon-sidebar-dan-refresh-stabil) and
[Figma v1.0.4 review](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-10924) are In review;
implementation approval waits for review of the delivered revision.

### 5.7 DataTable
| Part | Spec |
|---|---|
| Container | card radius 16, 1 px line, overflow hidden |
| Header | 40 px, `--tray`, `label` fg-3, optional 14 px icon before label, sort caret 12 px; 1 px bottom line; **no vertical rules** |
| Rows | 44 px single-line, 52 px identity (avatar 28 + name `body` fg + secondary `body-sm` fg-3 mono for IDs); padding 0 12; 1 px `--line` dividers; **no zebra** |
| States | hover `--tray` @ 60 %; selected `--row-selected` + 2 px primary inset left; focus-visible ring inside row |
| Cells | numbers right-aligned tabular; inline bar 64 × 6 px radius full (fill primary, track `--inset`) + value; status = `StatusChip`; time = `RelativeTime` |
| Checkbox | 16 px radius 4, 1.5 px `--line-strong`; checked primary fill + white check |
| Footer | 48 px: "1–25 of 312" fg-3 left · rows-per-page dropdown · pagination right (28 px square buttons radius 10, current = `--tray` fill without a line; `markup.test.ts` "Pagination: the current page is a tray fill without a line") |
| Density | `data-density="compact"` → rows 36/44 |

### 5.8 Chips & badges
- **StatusChip** (glossary states only): 22 px, radius full, padding 0 8 0 6, 1 px `--line`, `--card` bg, 12 px state
  icon/shape in the mark colour + label in the ink colour (`label`). Strong variant (tables with many rows): soft bg,
  no border. Always with tooltip description from `packages/ui/src/lib/status.ts`.
- **Category chip** (role, team, event type): 22 px, radius 6, padding 0 8, soft tint of its categorical slot
  (10 % on card) with text in `--fg` (never the series colour, per text-token rule) and a 6 px slot-colour dot.
  `slot="neutral"` (inset fill, `--fg-4` dot) is the plain, lowest member of a set (Viewer).
- **Count badge**: 18 px pill, `--tray` (in tray: `--card`), `label` fg-2, tabular.
- **Result chip** (sign-in Success / Failed, or any pass / block outcome): use slot 1 / slot 2 dots, not status
  colours (a failed sign-in is an event, not a system failure).

### 5.9 Segmented control, tabs
- Segmented: track `--tray` without a visible line (its 1 px border is transparent, set in `base.css` on
  `.rounded-ctl.bg-tray`, so the box stays 34 px), radius 10, padding 2; segments 28 px, radius 6, padding 0 10,
  `label`; active = `--card` + `--shadow-sm` (dark `#2c2c31`), fg; inactive fg-2. Optional count pill after label. The
  active "thumb" is a shared-layout element that slides between segments (§7.3). Roving focus. On a Panel header the
  track sits on the tray's own colour, so only the thumb shows.
- Tabs (detail pages): line variant, 40 px, `body` 500, inactive fg-2, active fg + 2 px fg underline (radius 1);
  count pill after label; shared-layout underline. The `default` variant is the segmented look: the same borderless
  track and 6 px thumb.

### 5.10 Progress, meters, rings
- **Bar**: 8 px (6 px in tiles), radius full, track `--inset` (light) / `#2a2a2f` (dark); fill = primary or status
  mark; striped texture on the fill (45°, 2/4 px) for "in progress / partial"; label row above: name left, value right
  tabular.
- **Tick meter** (scores, quotas): 24–40 ticks, 3 px wide, 3 px gap, 16 px tall, radius 2; filled =
  colour, empty = `--line`; threshold tick taller (20 px) in fg-2. Use for quotas and budgets.
- **Ring**: 40 px, 4 px stroke, round cap, track `--line`; value text outside the ring (never inside at this size).
- **Threshold meter** (`Meter`): bar with a 2 × 14 px thumb at the warning threshold.
- **Task progress** (`Progress`, `ds/progress.tsx`): how far a task is, not how full something is. 6 px (4 px `sm`),
  fill primary striped (Down mark when it failed), label left and "64%" or a count ("3 of 5 files") right. Without a
  value it is indeterminate: a third of the bar crosses the track (`animate-progress`, still under reduced motion), and
  no value is read. Prefer a count when the steps are countable; show it only while work runs (Apple HIG, NN/g).

### 5.11 Avatars
28 px tables, 24 px chips, 32 px account. Initials only (no photos): `label` 600 on a tint derived
from the name hash over the 6 categorical softs; 1 px `--line` ring. Stacks overlap −6 px with a 2 px surface ring.

### 5.12 Inputs
32 px (login 40 px), radius 10, 1 px `--control-border`, `--card` bg, padding 0 10, leading icon 16 fg-3, placeholder
fg-3 (format only). At rest a field carries `--shadow-xs` (light only; the token is `none` in dark): input, select,
textarea, affix and number input, set once in `base.css`; the input inside an affix or number field has none, and
the combobox trigger and OTP cells are not covered. Focus: 1 px primary border + 3 px `--primary-soft` ring, which
replaces the drop. Error: Down mark border + message
under the field in Down ink `body-sm` with the 14 px alert icon (`Field error`), never colour alone. `Textarea`: the
same look, 3 lines at least; `limit` adds the count ("120 of 500 characters", "12 characters too many" past it; typing
is never blocked). `Switch`: 36 × 20 pill, primary when on, for a setting that applies at once; in a form that saves
later, a Checkbox.

### 5.13 Empty, error, loading, stale (the five states)
- **Loading**: shimmer skeletons in the final shape (§7.2): text bars 10 px radius 4, chart = gridlines + 3 ghost
  bars, table = header + 8 rows.
- **Empty**: inside the card, centred, 20 px icon in a 40 px `--tray` circle, `title-3` + `body-sm` fg-3, one ghost
  or secondary button. Filtered-empty offers "Clear filters".
- **Error (no data)**: same layout, Down icon, what + why + next, "Try again" secondary.
- **Error (has data)** and **stale**: page `Notice` (40 px, radius 10, Degraded soft, ink text, icon) above the
  tiles; panel-level `StaleNote` in the tray footnote ("Data from 14:02 WIB · source name").

### 5.14 Menus, tooltips, dialogs
Menu: `--raised`, radius 16, padding 4, items 32 px radius 10, `--shadow-overlay`. Popover: the same surface and
radius, padding 16. The re-skin changed only their radii (§3.7). Tooltip (UI): inverse `#18181b`
(dark: `#f2f2f3` text `#151517`), radius 10, `body-sm`, padding 6 10, max 280 px. Dialog: 480 / 640 px, radius 20,
padding 24, title `title-1`, footer buttons right; confirm copy per copy guide. Below 768 px the dialog is a bottom
sheet (§0): full width, top corners 20, at most 90 dvh, content scrolls, footer sticky at the bottom.

### 5.15 Forms and flows (`packages/ui/src/ds`, shown on /ds/forms "Forms and flows")
Sources: WAI-ARIA APG (combobox, disclosure), GOV.UK Design System (error summary, error message, character count,
file upload, question pages, check answers), NN/g (wizards, form errors, progress indicators, toggle switches,
checkboxes vs radios), Apple HIG (toggles, progress indicators, text fields, combo boxes, disclosure controls).
- **Validation** (`lib/validate.ts` rules + `useForm` + `ErrorSummary` + `Field error`): a field's error shows once
  the user has changed it and left it, or tried to submit, and clears as soon as it is fixed (Baymard, NN/g, W3C WAI;
  GOV.UK validates on submit only: our choice is the blur). Tabbing past an empty required field says nothing; its
  "Enter a name." waits for the submit (NN/g: an error before the user had a chance is hostile). A failed submit lists every error in "There is a problem" (links to the
  fields, role=alert) and focuses the first field. Messages are instructions ("Enter an email address like
  name@example.com."), never "invalid" or "required". zod stays server-side.
- **RadioGroup**: 2–6 choices, native radios in a fieldset with a legend (arrow keys, "1 of 3"); `cards` for options
  that need a sentence each (selected: primary border on `--primary-soft`). More choices: Combobox.
- **Combobox** (the select2): APG combobox with a listbox popup. Single (clear button) or `multiple` (chips with a
  named × each; Backspace on an empty field removes the last); local `options` or `loadOptions` (250 ms debounce, the
  previous request aborted, Searching… / Couldn't load + Try again / No matches); `onCreate` adds "Create “text”".
  ↓ opens and moves, Enter picks, Esc closes then clears. The result count is announced.
- **FormWizard** + **ReviewList**: for 3 or more linear steps (Carbon). The form is a card; from 1280 px the steps are
  a vertical list on its right, sticky while a long step scrolls, each with its description (Carbon prefers vertical
  "for easier reading"); below that one row above the card, and on a phone only the current step's name plus "Step 2
  of 4" (Material step text). A step already reached is a button; a step not reached is not (NN/g: no step before
  the ones preceding it are done); going forward from the list still validates this step. Back before Continue,
  sticky at the bottom (FormActions). Continue validates the step's fields and focuses the next step's heading; Back keeps the answers; the last button names the action ("Send
  invitation"); the review lists every answer ("Not provided" when empty) with a Change button that reopens its step.
  Each step mounts fresh (keyed), so a control is never reused for the next step's field.
- **FileUpload**: dashed drop zone (`--tray`, primary on drag) with a "choose files" button opening the native picker;
  paste while it has focus. Limits said up front ("An image or a PDF, up to 5 MB, 4 files at most"). Each file is
  checked before sending (GOV.UK wording: "The file must be smaller than 5 MB."), then sent through the page's
  `upload(file, { onProgress, signal })` with its own Progress, Cancel, Try again, Remove and a thumbnail for images;
  results are announced. Past `maxFiles` the rest are not added and that is said.
- **Timeline**: an ordered list; markers in the StepMarker family (done Healthy check, current primary dot with a soft
  ring, rejected Down cross, upcoming ring, skipped dashed ring), the rail solid up to the last finished step and
  dashed after; each step says its status in words, the current one has aria-current="step"; actor, time and a note
  box. For approvals, tracking and a record's history.
- **Disclosure**: native `<details>` (no script, find-in-page reaches it), 44 px summary with a turning chevron,
  the shared block-size transition. Stack them for an accordion.

### 5.16 Form layout and required fields (`ds/form-layout.tsx`, `ds/field.tsx`; shown on /ds/forms "Form layout")
Sources: Baymard (multi-column forms, required/optional marking, field width, inline validation), NN/g (required
fields, web form design, form white space, placeholders, wizards, OK/Cancel order), GOV.UK (question pages, text
input, button, validation, error summary), IBM Carbon (forms pattern, progress indicator), Atlassian (form usage),
Shopify Polaris (annotated layout, contextual save bar), Apple HIG (layout, text fields, buttons, sheets), W3C (WCAG
2.2 3.3.2, 1.3.5, 3.3.7; technique H90; forms tutorial grouping).

| Rule | Why (source) |
|---|---|
| A required field has a red `*` after its label (`Field required`, `RadioGroup required`; `aria-hidden`, the control gets `aria-required`) and the form says once, above the first field, "Required fields are marked with *" (`RequiredNote`). | NN/g required fields; W3C H90 (asterisk inside the label, explained at the start); Atlassian |
| An optional field in a form that has required ones says "(optional)" (`Field optional`). | Baymard: mark both; with optional-only marking 32% missed a required field |
| Sign-in forms and a form of one field carry no markers. | NN/g required fields (login exception); one field is required by being there |
| One column of fields. Two or three share a row only when they are one thing (city + postal code, first + last name, expiry + CVC). | Baymard multi-column forms |
| Field width follows the expected input: variable text at the column's width (`max-w-xl`, 576 px); a fixed-length value narrower (postal code `max-w-32`, a code `max-w-40`). | Baymard field width; NN/g; GOV.UK text input widths |
| Labels above fields, hint text under the field; a placeholder never replaces a label or a hint. | NN/g placeholders, form white space; GOV.UK text input |
| A form on a settings or create/edit page is `FormSection`s: from 768 px the group's title and a 1–3 sentence purpose on the left third, the fields on the right; stacked on a phone; hairline between groups. One group is one `FormSection` (`profile-form.tsx`), so every page form lines up the same. A dialog stays one column. | Polaris annotated layout; Carbon form sections; GOV.UK two-thirds column |
| Page forms sit in a Panel card padded 16, 24 from 768 px; the buttons are `FormActions`, the last row of the card, sticky to the bottom of the window while the form is taller than it. Never pinned to the top. | Carbon (pinned footer, not top) |
| Button order: on a page form the primary first, then Cancel (ghost), left-aligned under the fields; in a wizard Back then Continue (they map to the direction); in a dialog Cancel then the action on the trailing edge (DialogFooter). A destructive action is never the primary button of a page form: it goes through ConfirmActionDialog. | GOV.UK, Carbon, Atlassian (page forms left); Apple, Carbon dialogs (trailing); NN/g: consistency over either order |
| Never disable Submit because the form is invalid: it validates and shows what to fix. Disabled only while pending, or with nothing changed on an edit form with the reason beside it ("Change a field to save."). | Atlassian, GOV.UK (never disable); Carbon (never on long forms) |
| Radio and checkbox groups are a `fieldset` with a `legend`; a radio's description is its `aria-describedby`, not part of its name. | W3C forms tutorial (grouping) |
| Personal fields carry the right `autocomplete` (`name`, `email`, `current-password`, `new-password`, `one-time-code`); an admin form about someone else uses `off`. `inputMode="numeric"` instead of `type="number"`; `spellCheck={false}` on usernames and emails. | WCAG 1.3.5; GOV.UK text input |
| Unsaved edits ask before leaving (`useLeaveGuard` + ConfirmActionDialog "Leave without saving"). | Polaris contextual save bar; MDN beforeunload |
| Ask nothing twice in a flow: a wizard's review shows what was given, and a later step reuses earlier answers. | WCAG 3.3.7 Redundant Entry |

### 5.17 Setup checklist (`ds/setup-checklist.tsx`; shown on /ds/feedback "Setup checklist")
`SetupChecklist` (`@starterkit/ui/ds`, with the types `SetupGroup`, `SetupTask`, `SetupAction`) shows what is left to
set up, in named groups, with the progress as a count and a bar. Written for the starterkit on existing parts
(`CardSurface`, `Progress`, `Disclosure`, `StepMarker`, `Button`); it has no Figma node yet (DEC-031).
- **Use it** when setup is several tasks in two or more groups and each task opens a screen or runs an action. A
  short flat list with a count is `OnboardingChecklist` (`ds/saas-patterns.tsx`); whether both stay is not decided.
  Steps that must run in order are a `FormWizard` (§5.15).
- **In progress**: a tray whose header has the title (a heading, level 2 unless `headingLevel` says 3 or 4) and
  "3 of 6 done"; under it one card per group, a native `Disclosure` with its own "n of m". Only the first group
  with a task left is open; when its last task is done it closes and the next opens.
- **Task left**: an empty marker, the label, an optional description and its action: a secondary small `Button`
  (`onClick`) or a link drawn as one (`href`, through `renderLink` for the router's link). A task may have no action.
- **Task done**: the check, a quieter label and the word "Done" (`doneLabel`) where the action was; no
  strike-through, so the state is never colour alone. The check draws its stroke only when the task becomes done
  (`tick-draw`, R11), never on first paint or a refetch; reduced motion keeps the fade only.
- **All done**: with `completion`, that message replaces the groups; without it the groups stay, all closed.
- **Empty**: no groups, or only groups without tasks, renders nothing; a group without tasks is left out.
- **Accessibility**: the bar is a `Progress` named by the title, with the same text as its value text
  (`progressText` replaces it); groups and tasks are lists; the summary is 44 px high; the completion message sits in
  a `role="status"` region that is in the document from the start, so it is announced when it arrives, and the
  count in the header is a polite live region, so each task done is announced ("2 of 5 done"). Long titles, labels
  and descriptions wrap; a long action label does not (`Button` is one line).
- **Focus**: a task that becomes done unmounts its action, so focus that was on it would fall to `<body>`. The root
  (`ds/setup-checklist-root.tsx`, the component's one client part) moves it: to the nearest action left in the same
  group (the next, else the one before), else the summary of the open group with a task left, else the completion
  message (the status region takes focus, `tabIndex` −1, and the next Tab reaches a button inside it), else the
  group's own summary. It moves only focus lost that way, never focus the user put elsewhere, as `DataTable` does
  after a row goes away. (`setup-checklist.test.ts` "SetupChecklist (focus after a task is done)"; `ds.spec.ts`
  "setup checklist: …" goes through every task by Tab and Enter)
- Apart from that root it has no hooks: with `href` actions it renders from a server component. Not built: a
  dismiss button, persistence, a pending state on a callback action, a per-group open override.
  (`packages/ui/src/ds/setup-checklist.test.ts`)

---

## 6. Charts

Built with Recharts 3.8 via `@starterkit/ui/charts`; every chart sits in a Panel card, height from `CHART_HEIGHT`
(sm 160 / md 240 / lg 320), sparkline 32 px (in a 56 px inset well).

### 6.1 Plot frame
Padding: top 8, right 8, bottom 24 (x ticks), left = widest y tick + 8. Legend sits in the panel header (right,
before actions) as `dot 8 px + label body-sm fg-2`, never inside the plot.

### 6.2 Grid, axes, ticks
Horizontal gridlines only, `--grid`, 1 px, `strokeDasharray="4 4"`; 4–5 ticks on round values; baseline (0) solid
`--line-strong`. No axis lines, no tick marks. Tick labels `caption` fg-3; x months/days as "Oct 14", hours "14:00"
(WIB); y abbreviated ("1.2K", "4.2M"). One y-axis, always.

### 6.3 Bars
- Band gap: bar = 72 % of the band (`barCategoryGap="28%"`), max bar width 32 px, min 6 px.
- Caps: radius `min(6, width/4)` on the value end, 2 px on the baseline end (stacks: only the top segment rounds).
- Grouped: 2 px gap between bars of one group; stacked: 2 px surface gap between segments.
- Texture: every bar (columns, horizontal top-N, distribution segments, progress fills) carries the 45° stripe
  texture (2 px line / 4 px gap, `--stripe`) over its fill; one look for all bars (`bar-chart.tsx`, `hbar-chart.tsx`,
  `distribution-bar.tsx`, `StatTile progress`).
- Secondary/partial series: the same hue's soft tint (35 %), striped too (reference "Attended / Partial").
- Highlight on hover: other bars drop to 40 % opacity (150 ms).
- Direct labels only on the max or the selected bar, `label` fg above the cap.
- Horizontal bars (top-N): 20 px rows, 8 px bars radius full on a `--inset` track, label left (`body-sm` fg), value
  right (`body-sm` tabular).

### 6.4 Lines and areas
- Stroke 2 px, `strokeLinejoin round`, monotone curve for continuous metrics, linear for counts.
- Area: gradient from series colour 16 % (light) / 24 % (dark) at the top to 0 % at the baseline.
- Markers: hidden by default; on series with ≤ 14 points show hollow 8 px markers (card fill, 2 px ring). Active
  point: 10 px filled + 3 px card ring + vertical crosshair 1 px `--line-strong` dashed.
- Projections / thresholds: dashed `4 4`, 1.5 px; thresholds in Degraded/Down marks with a right-aligned `caption`
  label ("Warning 80 %").
- Mirrored (in/out): series above and below a dashed zero line, each with its own area gradient — **only when both
  series share one unit and one scale**. When magnitudes differ (Success ≈ 2.5K/h vs Failed ≈ 50/h) use **stacked small
  multiples** on a shared x-axis instead (each panel labelled, own baseline), never two scales on one axis.

### 6.5 Distribution bar + legend cards (cost split, quota split)
8 px tall full-width bar of segments in slot order with 4 px gaps, radius full on the ends, striped texture; below
it a row of 2–4 legend cards (tray of cards, 4 px gap): `dot + name` (body-sm fg-2), value (`stat-sm` with minor
digits fg-3), share pill (count badge style).

### 6.6 Donut, ring, gauge, heatmap, sparkline
- Donut only for 2–4 parts of a whole; 120 px, 14 px ring, 2 px gaps, centre value `stat-sm` + caption. Prefer the
  distribution bar.
- Ring (KPI): §5.10. Gauge: not used — use a threshold meter.
- **Heatmap** (hour × weekday): cells 14 × 14 px, 3 px gap, radius 3, sequential blue
  ramp (8 steps, empty = `--inset`), row labels mono `caption`, column ticks every 3 h; hover cell gets 2 px fg ring;
  legend = 8-step ramp strip with min/max labels.
- **Sparkline**: 2 px, area gradient, no axes, last-point dot 6 px; colour = slot 1, or Down mark when the latest
  value is above the critical threshold; in a 56 px `--inset` well with
  label (caption fg-3) left and value (`label` fg) right.

### 6.7 Tooltip (charts)
Inverse surface (`#18181b` light mode, `#26262b` + ring in dark), radius 10, padding 10 12, min-width 168,
`--shadow-overlay`. Eyebrow line = period ("OCT 14 · 14:00 WIB"), then one row per series: 8 px dot, name
`body-sm` (fg-3 inverse), value right-aligned `body-sm` 500 tabular. Appears on hover and keyboard focus, follows
the crosshair with a 12 px offset, flips at plot edges. Fades in 120 ms.

### 6.8 Annotations
Events (deploys, incidents) as a 1 px dashed vertical line + 16 px flag chip at the top of the plot with a `label`.
Max 3 visible; more collapse into a "+2" chip.

### 6.9 Breakdown card (`charts/breakdown-card.tsx`; shown on /ds/data "Breakdown card")
`BreakdownCard` (`@starterkit/ui/charts`; the part type `BreakdownPart` and the pure ranking in
`@starterkit/ui/lib/breakdown`) answers "what makes up this number": a Panel with the total, one 8 px striped
stacked bar and the parts as ranked rows (colour dot, label, value, share). Written for the starterkit on existing
parts (`Panel`, `DataRegion`, `Truncate`, `NumberTween`, `Stagger`, the chart slots); it uses no Recharts, so it is
exported statically like `DistributionBar`. It has no Figma node yet (DEC-031).
- **Use it** for one total split into 2–6 parts where the reader needs each part's value and share as text.
  `DistributionBar` with legend cards (§6.5) is for 2–4 parts beside a chart; a ranking of unrelated values is
  `HBarChart` (§6.3).
- **Rows**: largest first, equal values in the caller's order. More parts than `max` (default 5, held to 2–6; not a
  number → 5) give
  the `max − 1` largest and one last row labelled `otherLabel` in the neutral colour, last even when it is larger
  than a named part. Zero, negative and non-finite parts are left out of the rows and the total. Shares are whole
  percentages that sum to 100, "<1%" under 0.5 % (`distribution()` and `shareLabel()` of `lib/chart-layout.ts`).
- **Colour** follows the part's `slot` (else its input position), not its rank, so a part keeps its colour when it
  changes place (§3.3). No two named rows share a colour: with more than six parts a defaulted slot that meets one
  already taken (a part past the sixth, or one a given `slot` claims) moves to the lowest free slot, the earlier
  input position keeping its own; that colour can change when the named rows do, so pass `slot` to pin it. A given
  `slot` is never moved. (`lib/breakdown.test.ts` "more than six parts without a slot: …", "a slot the caller gave
  stays as given; …")
- **States** (`state`, as `DataRegion`, §5.13): `loading` is the content's shape (total, bar, `max` rows) through
  `Reveal`; `empty` is the caller's copy, also when no part is above zero; `error` is an alert with the cause and
  "Try again" when `onRetry` is given; `stale` is a notice over the kept content; `data`. While refetching pass
  `stale` or `data`: `loading` replaces the rows.
- **Motion** (§7): the bar sweeps in once; a changed total counts (`NumberTween`); rows that trade places glide
  (`Stagger reorder`, once the deferred layer is loaded); a part that arrives after the first data gets the new-row
  wash, compared over every part, so one that only leaves the fold gets none and the folded row never does
  (`breakdown-card-dom.test.ts` "a part that was folded and rises into the named rows …"). A refetch replays nothing; segments resize at once (no width animation). Reduced motion: none of these.
- **Accessibility**: the bar is `aria-hidden`; every part is a list row with its label, value and share as text, so
  colour is never the only cue; the list is named by the title. A label that does not fit is cut on one line and
  gets a tooltip and a tab stop (`Truncate`); rows are not interactive. Needs a `TooltipProvider` above it, as
  `HBarChart` does.
- Not built: a link between a row and its segment on hover or focus, row actions, a tween on row values, a separate
  skeleton row count (the loading shape has `max` rows, so a card with fewer parts shifts when data arrives: set `max`
  to the expected count).
  (`packages/ui/src/lib/breakdown.test.ts`, `packages/ui/src/charts/breakdown-card.test.ts`,
  `breakdown-card-dom.test.ts`)

---

## 7. Motion

Library: **`motion` 14.0.0** (Framer Motion's current package name), imported from `motion/react` only inside
`packages/ui/src/motion/framer.tsx`, which loads after idle (R1 in §7.8). Route first-load stays **≤ 250 kB gz**
(`bun run budget`). No `layout` prop on large lists, no `drag`. Anything that can be CSS is CSS.

### 7.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 100 ms | press, checkbox, toggle thumb, tooltip, menu out, reduced-motion fades |
| `--dur-fast` | 150 ms | hover, exit of small elements |
| `--dur-pop` | 180 ms | menu and popover in, badge pop |
| `--dur-enter` | 220 ms | content reveal, dialog scrim in |
| `--dur-page` | 260 ms | page enter |
| `--dur-exit` | 160 ms | page exit, dialog out (exits always faster than enters) |
| `--dur-slow` | 280 ms | dialog in, chart mount, sheet open |
| `--dur-tween` | 600 ms | number tween (max) |
| `--dur-draw` | 400 ms | chart line draw |
| `--dur-flash` | 1200 ms | new-row wash, skeleton shimmer loop |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | enters, reveals |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | exits |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | state changes |
| `--ease-linear` | `cubic-bezier(0, 0, 1, 1)` | reduced-motion fades (Framer) |
| `--reveal-dur` | 700 ms | text reveal, per piece (R10) |
| `--reveal-step` | 40 ms per word or letter, not capped | text reveal (R10) |
| `--reveal-ease` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | text reveal (R10) |
| spring `indicator` | `{ type: "spring", stiffness: 520, damping: 40, mass: 0.8 }` | segment thumb, tab underline, nav pill |
| spring `flip` | `{ type: "spring", stiffness: 420, damping: 42, mass: 0.9 }` (`SPRING_FLIP`) | card reorder glide |
| `--shift-enter` | 6 px | translateY distance for enters |
| `--stagger` | 35 ms per item, max 8 items staggered (cap 280 ms total), the rest appear with the 8th |

Exported once from `packages/ui/src/motion/tokens.ts` as JS constants (seconds) mirroring the CSS variables; `packages/ui/src/motion/tokens.test.ts` keeps them in sync. No literal duration, delay, easing or spring anywhere else in `apps/web/src` or `packages/ui/src` (CSS custom-property definitions excepted): `apps/web/src/test/architecture.test.ts` ("motion timings come from tokens").

### 7.2 Opening the app, page transitions, content reveal
- **App open**: sidebar fades in (opacity 0 → 1, 220 ms); sheet fades + rises 6 px (260 ms, `--ease-out`, one
  `--stagger` step, 35 ms, later). Happens once per hard load.
- **Page transitions**: `PageTransition` (the app group's `template.tsx`) wraps the page content keyed by route segment (not search
  params, so filter/tab URL changes never re-animate the page). Enter: opacity 0 → 1 + y 6 → 0 over `--dur-page`; the
  deferred Framer layer adds an exit (opacity 1 → 0 over `--dur-exit`, no movement). The shell (sidebar, top
  bar) never animates on navigation.
- **Skeleton shimmer**: skeleton blocks use `--inset` with a 1.2 s linear-infinite gradient sweep
  (`linear-gradient(90deg, transparent, rgb(255 255 255 / 0.6) 50%, transparent)`; dark `rgb(255 255 255 / 0.04)`),
  animated via `background-position` on a pseudo-element translated with `transform` (GPU only).
- **Crossfade to content**: skeleton and content share the same box (CSS grid stack: both in `grid-area: 1/1`);
  skeleton fades out 150 ms while content fades in 220 ms — **no layout shift**, the region's height is fixed by the
  skeleton's final shape.
- **Stagger**: card grids, KPI trays and legend cards reveal with opacity + 6 px rise, 35 ms per
  item, capped at 8 staggered items. Tables are **not** staggered: the whole table body fades in once.

### 7.3 Shared layout indicators
Segmented thumb, tab underline and the active sidebar pill are a single `m.span` with `layoutId` per control
instance (`layoutId={\`seg-${id}\`}`) moved with the `indicator` spring. These are the only `layout` animations
allowed. Reduced motion: the indicator jumps (no spring) and crossfades 100 ms.

### 7.4 Numbers and charts
- **Number tween** for KPI values: `animate(from, to, { duration: min(0.6, 0.3 + |Δ|/total·0.3), ease: easeOut })`
  writing to a ref'd text node through `format.ts` (so separators/units stay correct). First render counts from 0
  only on app open; later refreshes tween from the previous value. `aria-live` regions announce the final value only.
- **Chart mount**: bars grow from the baseline (`scaleY` 0 → 1 with `transform-origin: bottom`, 280 ms, stagger
  12 ms per bar, cap 200 ms: `CHART_STAGGER`, `barDelay(i)`); lines draw via `strokeDashoffset` 100 % → 0 (400 ms); areas fade 0 → 1 (280 ms).
  Recharts' own animation is disabled (`isAnimationActive={false}`) in favour of these CSS-transform equivalents so
  the timing is uniform. Data refresh never re-runs the mount animation: values transition 220 ms.
- Charts below the fold mount when `LazyMount` reveals them — the mount animation runs then.

### 7.5 Micro-interactions
- Buttons: hover fill change 150 ms (the primary's gradient swaps at once: a background image does not transition);
  press `scale(0.97)` (`--press-scale`) 100 ms; primary hover lifts nothing.
- Cards that open a detail: hover → `--shadow-sm` + border `--line-strong`,
  translateY −1 px, 150 ms; press scale 0.995.
- Table rows: hover background 100 ms only (no movement).
- Toggle thumb: 100 ms; checkbox check-path draw 150 ms.
- Menus/popovers: opacity + scale 0.98 → 1 from the trigger origin, `--dur-pop` (180 ms) in / `--dur-instant` (100 ms) out.
- Tooltip: opacity only, `--dur-instant` (100 ms) in and out, 300 ms open delay (0 when moving between chart points).
- Dialog: scrim fade `--dur-enter` in / `--dur-exit` out; panel opacity + scale 0.98 → 1, `--dur-slow` (280 ms) in / `--dur-exit` (160 ms) out. Below 768 px (bottom sheet) the panel rises from the bottom edge instead of scaling, same tokens.
- Navigation drawer (phone): scrim as the dialog; panel slides in from the left with a fade, `--dur-slow` in / `--dur-exit` out (`OVERLAY_MOTION.drawer`).

### 7.6 Reduced motion
`useReducedMotion()` + `@media (prefers-reduced-motion: reduce)`: **no translate, no scale, no spring, no
stroke-draw, no number tween** (value swaps instantly), no shimmer sweep (static `--inset` block). Opacity fades are
kept but shortened to 100 ms. `MotionConfig reducedMotion="user"` is set at the root.

### 7.7 Performance budget
- Animate `transform` and `opacity` only; never `width`, `height`, `top/left`, `margin`, `box-shadow` on lists
  (shadow on hover uses a pre-rendered pseudo-element whose opacity animates).
- No `layout`/`layoutId` on table rows, list items or anything with > 20 siblings; no stagger on tables.
- At most 12 simultaneously animating elements per region; stagger cap enforces it.
- `will-change` only during an animation (motion sets it), never in static CSS.
- Long tasks: page transition must not block input; INP target < 200 ms on a page with 50 cards.
- Bundle: `motion` stays out of every route's first-load JS (R1 in §7.8); `bun run budget` (≤ 250 kB gz per route) is the gate.

### 7.8 Micro-interactions (2026-10-19)
The `/ds/motion` page is the source of truth for these patterns; this is its inventory.
Layer: **CSS** = utility classes in `globals.css` (zero JS); **Motion** = the deferred motion layer. Durations are
tokens from `packages/ui/src/motion/tokens.ts` (`DUR.*`, `STAGGER`, `EASE`), never literals.

| Pattern | Layer | Tokens | Reduced motion |
|---|---|---|---|
| Page enter | CSS | `DUR.page`; route change only, the shell never animates | Fade only, `DUR.instant` |
| Stagger | CSS | `DUR.enter`, `STAGGER.step` steps, cap `STAGGER.max` items (KPI trays, card grids) | Fade only, no delay |
| Reveal | CSS | `DUR.enter` in, `DUR.fast` out; skeleton to content in the same box | Fade only, `DUR.instant` |
| Text reveal | CSS | `--reveal-dur` per piece, `--reveal-step` between pieces, `--reveal-ease`; opacity, blur and a 0.35em rise; see R10 | Fade only, `DUR.instant`, no delay |
| Dialog | CSS | `OVERLAY_MOTION.dialog`: `DUR.slow` in, `DUR.exit` out; scrim `DUR.enter` in, `DUR.exit` out; below 768 px it rises from the bottom (sheet) | Fade only, no scale or slide |
| Drawer | CSS | `OVERLAY_MOTION.drawer`: `DUR.slow` in, `DUR.exit` out, slide from the left; scrim as the dialog | Fade only, no slide |
| Menu | CSS | `OVERLAY_MOTION.menu`: `DUR.pop` in, `DUR.instant` out (popovers too) | Fade only, no slide |
| Tooltip | CSS | `OVERLAY_MOTION.tooltip`: `DUR.instant` in and out | Fade only |
| Toast | CSS | sonner's own 400 ms (not a token) | None: sonner keeps its own reduced rule (no transform override, so stacked toasts keep their transform) |
| Badge pop | CSS | `DUR.pop`; only when a count or tone changed (count badges in tables and tiles pop on change only) | Fade only, `DUR.instant` |
| Chip change | CSS | `DUR.fast`; `background-color` | Instant swap |
| New row | CSS | `DUR.flash`; `background-color`; rows arriving after first load, never on load, paging, filter or query change | None |
| Number tween | Motion | `tweenDuration(...)` to `DUR.tween`; duration-based; `SPRING_SOFT` is exported for new uses only | Instant swap |
| Indicator | Motion | `DUR.slow` (`SPRING_INDICATOR`); segmented thumb, tab underline | Jumps, fades only |
| Sidebar width | CSS | `DUR.slow`, `EASE` standard; see R3 | Instant |
| Copy check | CSS | `DUR.fast` | Fade only, `DUR.instant` |
| Disclosure | CSS | `DUR.enter`; native `<details>`; see R9 | Opacity only, `DUR.instant` |
| Tab and sign-in step reveal | CSS | `DUR.enter`; a reveal, not a slide | Fade only, `DUR.instant` |
| Card lift | CSS | `DUR.fast`; clickable cards | No lift |
| Skeleton shimmer | CSS | 1200 ms loop; hands over with Reveal | No sweep |
| Chart grow and line draw | CSS | `DUR.slow` grow, `barDelay` stagger, `DUR.draw` draw | Fade only, `DUR.instant` |

Charts play their mount animation **once**: `useSettled` sets `[data-settled]` after the first paint and
`charts.css` turns the animation off under it, so a data refresh re-renders without replaying.

Rulings recorded here:
- **R1, Motion stays in the deferred layer.** `MotionLayer` loads `import("./framer")` after idle (`motion@14.0.0`).
  `LazyMotion` + `m` is not put in first-load JS: measured 0 kB first-load cost this way versus about 5 kB
  with a static import.
- **R3, sidebar width is the only width animation.** One `<aside>` animates `width` (`DUR.slow`, `motion-safe`
  only; labels fade in after an expand, hide at once on collapse). It is the exception to "never animate width" in
  §7.7, and `/ds/motion` names it. Everything else animates transform, opacity, or (new row, chip) `background-color`.
- **R9, native disclosures.** Only native `<details>` animate, via `interpolate-size: allow-keywords` and
  `::details-content` (block-size + opacity, `DUR.enter`); browsers without support stay instant. Disclosures built
  from buttons stay instant. This is the one height animation.
- **R10, text reveal.** `TextReveal` (`motion/text-reveal.tsx`, `reveal-text` in `base.css`) is ported from affectUI's
  Text Reveal (MIT, https://github.com/flohoeller/affectui) with its values kept: 700 ms per piece, 40 ms between
  pieces, `cubic-bezier(0.2, 0.7, 0.2, 1)`, blur 8 px (6 px in dark), rise 0.35em. It is the one `filter` animation
  and the one stagger outside the 8-item cap and the 12-element budget of §7.7, so it is for one heading or
  empty-state line at a time, never for data, tables or lists: the text stays invisible until JavaScript sees it on
  screen. Left out of the port: the source's per-instance `duration`, `stagger` and `delay` props (timings are
  tokens) and its static `will-change` (§7.7). Its three values are CSS tokens only (`--reveal-*` in
  `tokens.css`, no key in `DUR`/`EASE`), and the component is imported by path
  (`@starterkit/ui/motion/text-reveal`): `motion/tokens.ts` and the motion barrel ship in every route's first load,
  and `/audit/activity` had 3 bytes of the 250 kB budget left.
- **Per-card status legend.** The status legend is the `Panel` `legend` prop: an info button ("Status legend") at
  the end of the card header; page-level and inline legends were removed (see §5.8 status chips, which carry the tooltip text from
  `packages/ui/src/lib/status.ts`).
- **R11, a check draws its stroke.** The Tick02 path of `Checkbox` (so filter options too) and of a menu checkbox
  item animates `stroke-dashoffset` over `DUR.enter` (`tick-draw` in `base.css`, after affectUI's Checkbox and Filter
  Menu, MIT). It is the second stroke animation beside the chart line draw, limited to that one 20-unit path, keyed
  to the state change (`useChangeKey`) on a checkbox; a menu item's check also draws when its menu opens. Reduced
  motion: no draw. Requested by the owner (DEC-029). A `SetupChecklist` task's check draws the same way when the
  task becomes done (§5.17; its own `base.css` rule scoped to `[data-slot="setup-checklist"]`).

### 7.9 Component micro-interactions

The behavior lives in `packages/ui/src/styles/base.css` and the shared components, so app screens and the design system pages use
one implementation. `/ds/motion` → **Explore micro-interactions** opens an interactive preview using those same
components. The existing motion tokens set every duration/easing; `--press-scale` (0.97) and `--choice-press-scale`
(0.92) set press geometry. Static information stays still; feedback indicates an action or an actual state change.

| Family | Feedback | Keyboard, touch and reduced motion |
|---|---|---|
| Buttons, icon buttons, copy, pagination, calendar days, revisitable steps | Hover color; press at `--press-scale`, `DUR.instant`; release `DUR.fast`. Copy confirms with an icon and live text. | Native activation stays immediate. Disabled, read-only and busy controls do not press. Reduced motion keeps color and focus with no scale. |
| Input, password, select, textarea, affix, number input | Border/fill/focus transitions use `DUR.fast`; grouped fields highlight their outer border. Invalid fields keep the error color in the border and in a faint fill (`--invalid-wash` of Down over the card: 4% light, 6% dark). | Focus remains visible, values and caret stay intact. Hover enhancement requires a fine pointer. Read-only/disabled fields do not suggest editing. |
| Checkbox, radio, choice cards, switch | Checkbox/check confirmation; radio dot opacity/scale; switch thumb slides over `DUR.enter` and gives under the press (`--choice-press-scale`, `DUR.instant`); choice card selection uses its fill and border. | Space/arrows keep their native semantics. State motion is immediate under reduced motion. Read-only selection cannot be toggled. |
| Search, command palette, combobox, menu | Shared highlight transitions; search focus marks its container; disclosure chevrons follow expanded state. Existing overlays keep their open/close tokens. | Roving focus, typeahead, Escape and focus return are preserved. No moving menu rows. |
| Calendar and date/time controls | Day press/selection feedback, trigger fill and chevron state. The whole date input opens the calendar; the range summary opens quick select. Shared custom menus choose month/year directly, bounded by min/max. | Typing remains available on keyboard focus; Alt+Down opens the calendar. Selection/Escape returns focus to the opening input or icon. Changing month/year only navigates, clamps leap days and bounds, and never commits a date until a day is chosen. The grid and live region keep their identity. |
| Tabs, segmented controls, sidebar, breadcrumb, route tabs | Shared selection indicator where already supported; navigation color transitions and stable targets. | Keyboard focus stays on the control; reduced indicators jump to the actual state. Navigation never lifts. |
| Upload | `FileUpload` has a dashed card, centered upload icon and whole-area browse trigger. Border/fill and a small icon shift follow drag-over; validation remains visible. Files render below as `FileItem` rows: selected, uploading (inline progress + cancel), confirmed success (size / row count + check), or error (retained message + remove). Busy uploads reject further selection and drag highlighting. | Native file picker remains the keyboard/touch path. No drag-only action. Disabled keeps the reason visible; cancel is available during transfer. Removal targets one file and returns focus to browse. Progress uses shared meter motion; reduced motion omits icon shift. Selection is never presented as confirmed upload. |
| OTP and password checks | Current OTP cell gets the focus mark; changed digits and newly met checks settle once. The actual OTP input stays mounted. | Paste, autofill, caret and selection stay native. Reduced motion fades; no validation shake. |
| Stepper, wizard, onboarding | Marker colors transition; completing a step confirms its check. Revisiting a completed step has button feedback. | Completion animation is keyed to a state change, not refetch/re-render. Current-step content can use `animate-reveal-in` without remounting form inputs. |
| Progress and meters | Fill interpolates `scaleX`, `DUR.enter`, anchored left. No width animation or layout shift. | Accessible value is the final value. Reduced motion switches immediately. Sliders follow the pointer directly. |
| Cards, tables and charts | Whole-card links/actions use shared `InteractiveCard` (grey `CardSurface` + `card-lift`, native button or `asChild` link). Disabled/busy cards suppress hover/press and activation. Table rows use color only. All loading blocks use shared `Skeleton`, with its token-driven CSS shimmer. `/ds/motion` → Explore micro-interactions previews both foundations. | Reading surfaces do not imply clickability. Card hover lift requires a fine pointer; keyboard gets its border/elevation without moving. Secondary interactive controls stay outside a whole-card action. Reduced motion stops card movement and the shimmer sweep. |
| Feedback, badges, loading and overlays | Existing swap/pop/reveal and delayed loading patterns; state swaps only at meaningful changes. | Live regions announce outcomes, not every animation frame. Reduced preview and system preference follow the same rules. |

Carried over from affectUI's twins (DEC-029), on existing tokens, `transform` and `opacity` only:
- **Menus and popovers enter from the side they opened on.** `base.css` sets tw-animate's enter translate to
  `--shift-enter` per Radix `data-side` for `dropdown-menu-content`, `dropdown-menu-sub-content` and
  `popover-content`; duration and scale stay `OVERLAY_MOTION.menu`. Tooltips stay opacity only (§5.14). Reduced
  motion and the preview zero the translate. (`micro-interactions.spec.ts` "a menu and a popover enter from the side")
- **An invalid field is tinted, not only outlined.** `base.css` fills `input`, `select`, `textarea`, `input-affix`
  and `number-input` with `--invalid-wash` of `--down-mark` over `--card` while `aria-invalid` / `data-invalid` is
  set; text and placeholder stay at 4.5:1 on it (`tokens.test.ts` "invalid field fill"). OTP cells and the upload
  dropzone keep their border-only error.
- **Checks draw** (R11): `Checkbox`, filter options, menu checkbox items; the checkbox box also gives under the
  press (`--choice-press-scale`).
- **Switch knobs slide over `DUR.enter`** with `EASE.out`, in both switches (`ui/switch`, the form `Switch`).
- **Calendar.** The weeks enter `--shift-enter` from the side the month came from, and the day just chosen settles
  once (`pop`). **Number input.** A step rolls the value in from the side it moved to; typing does not. Both use
  `data-nudge` (two identical keyframes alternated, so nothing remounts and focus stays).
  (`calendar.test.ts`, `form-controls-gallery.test.ts`)
- **A typed OTP digit rises into its cell** (`digit-in`, `DUR.enter`).
- **A field's error message rises in when it appears** (`Field`: `animate-enter`, `DUR.enter`; fade only under
  reduced motion). The control keeps its identity and never shakes. (`packages/ui/src/ds/field.test.ts`)

No new animation runtime or per-control pointer listeners are needed. Data refresh never replays page/list enters.
No permanent `will-change`, cursor follower, parallax, validation shake, or layout animation on tables is introduced.
Motion preferences follow [WCAG 2.2, Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions).

### 7.10 Vendored affectUI items (2026-11-14)
`packages/ui/src/affect/` holds 73 free affectUI items (MIT, https://github.com/flohoeller/affectui; components,
illustrations, motion effects and blocks) as upstream wrote them, at the owner's request for a 1:1 copy of their
motion and micro-interactions. `packages/ui/src/affect/README.md` lists the source, the three changed comments and
how to update a file. They are shown in five groups, each after the starterkit sections of one design system page
under an "affectUI" heading: actions on `/ds/components`, inputs on `/ds/forms`, feedback on `/ds/feedback`, content
on `/ds/data`, visuals on `/ds/visuals`, which holds nothing else (`AFFECT_PAGE` in `apps/web/src/features/ds/pages.ts`,
`pages.test.ts`; demo files in `apps/web/src/features/ds/affect/`). There is no `/ds/affect` page (DEC-030).

This folder is a second visual language beside §3-§7, not part of it:
- **Outside the token rules.** Each file carries its own colours, durations and easings in a CSS string that React
  hoists into `<head>`. `architecture.test.ts` skips this folder, and only this folder, in "no literal colour" and
  "motion timings come from tokens" (`VENDORED`, with a fixture); ESLint ignores it; each file starts with
  `// @ts-nocheck`. Code that uses an item (features, the demo files in `features/ds/affect/`) stays under every rule.
- **Themed through aliases only.** `tokens.css` maps 31 of upstream's `--aui-*` variables onto the app tokens (ink,
  surfaces, lines, focus, status colours, radius, font, shadows; `--aui-blue`/`--aui-info` = primary), checked by
  `tokens.test.ts` "affectUI names map onto app tokens". Decorative hues and hard-coded colours stay upstream's. The
  items do not use `DUR`/`EASE`, the stagger cap or the 12-element budget of §7.7. `--aui-radius-sm`, `--aui-radius`
  and `--aui-radius-lg` are `--radius-sm`, `-md` and `-lg`, so since the re-skin (§3.7) the items draw 6, 10 and 16 px;
  upstream's own fallbacks are 12 px for Button, 10 px for Text Field and 16 px for Card inside a 20 px tray.
- **Reduced motion and accessibility are upstream's.** Each item has its own `prefers-reduced-motion` branch; the
  `/ds/motion` "Preview reduced motion" scope does not reach them. After the mapping axe still reports `color-contrast` on
  31 nodes in light and 14 in dark, all on colours an item hard-codes (the per-item list is in the folder's README),
  so axe on the design system pages skips `[data-affect-group]` (`axeSerious` in `apps/web/tests/e2e/helpers.ts`),
  `/ds/visuals` is in neither `a11y.spec.ts` nor the baselines of `ds.spec.ts`, and a listed item needs its contrast
  fixed before it goes on a screen. The 44 px touch check does cover the groups, with one exemption: Cover Flow's
  14 px position ticks (`.ui-cf__tick`; its Previous and Next buttons reach the same covers), left out by
  `smallTouchTargets` in the same helpers file and listed under "Touch targets" in the folder's README.
- **One pattern per need still holds.** Where `ui/` or `ds/` already has the component (button, dialog, menus,
  inputs, tooltip, pagination, skeleton and others), screens keep using it; a vendored twin is a reference for its
  motion and look, carried over one component at a time on the tokens (motion: §7.9; look: §3.7). Items without a twin (illustrations, Tool
  Call Card, Code Block, Tree View and others) may be used as they are.
- **Content.** Logo Cluster, Lead Sourcing, Agent Team and Model Wheel draw real product marks by default; pass
  fictional ones (as the demo files do where the item allows it) before showing them to users.
- Text Reveal is the one item ported onto the tokens instead (R10 in §7.8).


---

## 9. Copy and accessibility (binding)

- Copy follows `docs/standards/copy-guide.md` exactly: English, sentence case, numerals, house date/time format with WIB,
  the glossary terms, and the five health states **Healthy / Degraded / Down / Stopped / Unknown**. Delta pills and
  "vs previous 7 days" captions follow the number-first rule. Eyebrow text is sentence case in source and uppercased
  by CSS.
- `docs/standards/ui-standard.md` stays binding: page anatomy, URL state, `LazyMount` for below-the-fold charts, the
  five-state matrix, `StatusChip` + `StatusLegend` (never colour alone), numbers via `format.ts`, ≤ 250 kB gz first load.
- Contrast: all text ≥ 4.5:1 (values verified in §3.1/§3.2), large text and UI glyphs ≥ 3:1, focus ring 2 px primary
  with 2 px offset visible on every surface. `--fg-4` never carries information.
- Keyboard: ⌘K reaches every page; one tab stop per card; roving focus in segmented controls and tabs; chart
  tooltips open on focus; every chart offers "View as table".
