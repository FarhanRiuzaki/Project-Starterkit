# Design System v3 ("Tray")

Visual and motion rules for `@starterkit/ui` and `apps/web`. Companion to `docs/standards/ui-standard.md` (page rules) and
`docs/standards/copy-guide.md` (text). Section numbers are kept stable; §1, §8 and §10-§12 of the source spec are not part of the
starterkit.

---

## 0. Principles

1. **Desktop only.** The app runs in a desktop browser and is never opened on a phone. Design for 1280–1920 px
   wide; **1440 px is the reference width, 1280 px the minimum**. 768–1279 px only has to avoid horizontal page
   scroll (the content column narrows, grids drop to fewer columns); there is no separate tablet layout and no
   mobile layout, bottom nav or 375 px rule. Targets are sized for a mouse and keyboard: **28 px minimum, 32 px
   default** for buttons, icon buttons, segments and pagination. 44 px coarse-pointer targets are not a design
   driver.
2. **Tray and sheet.** Every region has exactly one job, and its surface says it. App background → content
   sheet → tray (grouping, header, label) → card (the data itself). Each step is a visible but quiet value change
   of 2–4 % lightness, plus a 1 px hairline. Shadows are only for things that float.
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
│┌ sidebar 248 ──────┐ 8 ┌ sheet (radius 16, line) ─────────────────────────────────────────┐ 8│
││ logo · collapse   │   │ top bar 56: breadcrumb ............ search ⌘K · bell · account   │  │
││ MAIN              │   ├──────────────────────────────────────────────────────────────────┤  │
││  Dashboard        │   │ content: padding 32 / 24 top, max-width 1376, 12 col, gap 16     │  │
││  Users        24  │   │                                                                  │  │
││ ...               │   │                                                                  │  │
││ SETTINGS (bottom) │   │                                                                  │  │
│└───────────────────┘   └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Sidebar 248 px expanded, 64 px collapsed (icon rail, tooltips); collapse state persists per viewer.
- Sheet inset 8 px top/right/bottom; content padding 32 px horizontal, 24 px top, 40 px bottom.
- At 1440: content width 1440 − 248 − 8 − 8 − 64 = 1112 px; 12 columns, 16 px gutters → column 78.0 px.
- At 1920: content capped at 1376 px and centred in the sheet. At 1280: 952 px content, same 12 columns.
- 768–1279: sidebar auto-collapses to the 64 px rail; 12-col spans of 3 become 6, 4 become 6; no horizontal scroll.

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
| Card grid | 3 col each (4 per row) ≥ 1440; 4 col (3 per row) 1280–1439 |
| Tables | 12 col |

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
| `--line` | `#ececee` | Hairlines: sheet, tray, card, row dividers | non-text |
| `--line-strong` | `#dcdce0` | Inputs, buttons (secondary), focus-adjacent | non-text |
| `--grid` | `#ececee` | Chart gridlines (dashed) | non-text |
| `--fg` | `#151518` | Primary text, KPI values | 18.2:1 on card |
| `--fg-2` | `#55555c` | Secondary text, labels, panel titles' icons | 7.4:1 |
| `--fg-3` | `#6e6e77` | Muted text, captions, axis ticks, denominators | 5.05:1 card, 4.6:1 tray |
| `--fg-4` | `#a1a1aa` | Disabled, placeholder glyphs only — never information | decorative |
| `--primary` | `#0d1530` | Brand navy: selection, links, focus ring, checkbox, active tab underline. Links are always underlined: navy is 1.01:1 against `--fg` | 17.99:1 card, 16.23:1 bg |
| `--primary-hover` | `#1b2547` | | white on it 14.98:1 |
| `--primary-soft` | `#eff2fa` | Mist (`#eef2fa`, one step lighter so fg-3 on it is 4.51:1): selected nav item tint, info chip bg | primary on it 16.07:1 |
| `--action` | `#18181b` | Primary button fill (near-black CTA) | white on it 17.7:1 |
| `--action-hover` | `#2c2c31` | | |
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

Rules: hue follows the entity, not its rank (role → slot is a fixed map in `packages/ui/src/charts/chart-theme.ts`); a 7th series folds
into "Other" (`--fg-3`); scatter/heatmap-like all-pairs forms use at most slots 1–3. Sequential (magnitude,
heatmap) = slot-1 blue ramp: light `#ebf4ff #cfe3fd #a6cbfa #74adf5 #3f8cef #1a7cf0 #0f5fc2 #0a4590`, dark
`#162236 #1b3254 #214577 #2a5c9e #3a78cc #5aa6ff #8cc1ff #bfdcff`. Texture: 45° stripes, 2 px line / 4 px gap at
35 % white (light) or 25 % black (dark) on top of the fill — the "partial" and "projected" encoding.

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
| `--radius-sm` | 6 px | category chips, kbd, small buttons |
| `--radius-md` | 8 px | buttons, inputs, nav items, segments, pagination |
| `--radius-lg` | 12 px | inner cards, tooltips (10 px), menus |
| `--radius-xl` | 16 px | trays, sheet |
| `--radius-full` | 9999 px | status pills, count badges, progress bars, avatars |

Nesting rule: inner radius = outer radius − tray padding (16 − 4 = 12).

| Level | Surface | Light | Dark |
|---|---|---|---|
| 0 | bg | — | — |
| 1 | sheet, tray | 1 px `--line` | 1 px `--line` |
| 2 | card | 1 px `--line` + `--shadow-xs` `0 1px 2px rgb(21 21 24 / 0.04)` | 1 px `--line`, no shadow; inner top highlight `inset 0 1px 0 rgb(255 255 255 / 0.03)` |
| 3 | active segment, active nav, hovered card | `--shadow-sm` `0 1px 2px rgb(21 21 24 / 0.06), 0 1px 1px rgb(21 21 24 / 0.04)` | fill `#2c2c31` |
| 4 | popover, menu, tooltip, dialog | `--shadow-overlay` `0 1px 2px rgb(21 21 24 / 0.06), 0 12px 32px rgb(21 21 24 / 0.12)` | `0 0 0 1px #2c2c31, 0 16px 40px rgb(0 0 0 / 0.5)` |

### 3.5 Typography

- **Sans: Inter Variable** (`@fontsource-variable/inter`, OFL). `font-feature-settings: "cv11", "ss01"` off; `"tnum"` on for every number.
- **Mono: Geist Mono Variable** (already installed) for IDs, IPs, hashes and the `eyebrow` style.

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 32 / 40 | 500 | −0.02em | Dashboard hero number |
| `title-1` | 22 / 28 | 600 | −0.015em | Page title |
| `title-2` | 15 / 22 | 500 | −0.01em | Panel title |
| `title-3` | 14 / 20 | 600 | −0.006em | Card title, dialog section |
| `stat` | 28 / 32 | 500 | −0.02em | KPI value (unit/denominator at `body`, `--fg-3`) |
| `stat-sm` | 20 / 28 | 500 | −0.01em | Card metric (CPU 52 %) |
| `body` | 14 / 20 | 400 | −0.006em | Default, table cells |
| `body-sm` | 13 / 18 | 400 | 0 | Secondary line, descriptions |
| `label` | 12 / 16 | 500 | 0 | Table headers, chips, field labels |
| `caption` | 11 / 16 | 400 | 0.01em | Axis ticks, footnotes |
| `eyebrow` | 11 / 16 mono | 500 | 0.06em uppercase | Sidebar section labels, tooltip period |

Numerals: tabular everywhere numbers stack; minor parts (decimals, units, "/ 100 %") in `--fg-3` at one step
smaller; negative values use the true minus sign `−`.

### 3.6 Spacing scale

4 px base: `0 · 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`. Control heights: 28 (sm), 32 (default),
36 (nav item, lg), 40 (table header, login input 40). Icons: Hugeicons Stroke Rounded (`@hugeicons/core-free-icons`, rendered by the local `Icon` in `packages/ui/src/ui/icon.tsx`;
one icon per meaning, taken only from `packages/ui/src/ui/icons.ts`), `currentColor` with text tokens, 16 px (stroke 1.5)
in nav, toolbars, panel headers and KPI tiles, 14 px in chips and table headers, 20 px in empty states.

---

## 4. Shell

```
┌──────────────────────┐ ┌───────────────────────────────────────────────────────────────────┐
│ [■] App name      [⫞]│ │ ⌂ Dashboard / ▦ Users / Rina Wulandari         [⌕ Search… ⌘K] [ ◔ ]│
│                      │ │ ───────────────────────────────────────────────────────────────── │
│ MAIN                 │ │                                                                   │
│ [▦ Dashboard       ] │ │  Page title            [Last 24 h ▾] [Legend] [Action]  │
│  ▣ Users             │ │  One sentence scope + freshness.                                  │
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

Rules: the nav is exactly Dashboard, Users, Roles, Permissions, Activity log, Sign-in log, Design system and Profile
(own sessions live at /me/sessions and on a user's detail page; there is no global Sessions page). Nav items carry no
badges; count badges elsewhere are counts, never words ("New" pills are not used).

---

## 5. Components

### 5.1 Sidebar nav item
36 px tall, radius 8, padding 0 10, icon 16 + 10 gap + `body` label.
States: rest fg-2 · hover `--tray` fill · active **light** `--card` fill + 1 px `--line` + `--shadow-sm`, fg, icon
filled; **dark** `#26262b` fill · focus ring 2 px `--primary` offset 2. Section label `eyebrow` `--fg-3`, 24 px above,
8 px below.

### 5.2 Top bar
56 px, bottom 1 px `--line`. Breadcrumb: 16 px icon + `body` per crumb, separator `/` in `--fg-4`, current crumb fg,
ancestors fg-2 (links). Search: 32 × 280 px, radius 8, 1 px `--line-strong`, leading icon, `⌘K` kbd (20 px, radius 6,
`--tray`). Icon buttons 32 × 32 radius 8.

### 5.3 Buttons
| Variant | Fill | Text | Border | Height |
|---|---|---|---|---|
| Primary | `--action` | white (dark: `#151517`) | none | 32 (28 sm) |
| Secondary | `--card` | fg | 1 px `--line-strong` + `--shadow-xs` | 32 |
| Ghost | transparent → `--tray` on hover | fg-2 | none | 32 |
| Danger | `--card` | Down ink | 1 px Down mark @ 40 % | 32 |
Padding 0 12, icon 16 + 6 gap, radius 8, `label`→ `body` 14/500. Press: scale 0.98 (§7.5). One primary per page.

### 5.4 Panel (tray + card) — the v3 signature
```
┌ tray (radius 16, --tray, 1px line, padding 4) ───────────────────────────┐
│  ◫ Panel title · caption            [segmented] [Last 7 d ▾] [⋯]        │  ← header on tray: 44 px, padding 0 12
│ ┌ card (radius 12, --card, 1px line, shadow-xs, padding 16) ───────────┐ │
│ │ content (chart / table / list)                                       │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│  footnote / StaleNote (optional, caption, padding 8 12)                  │
└──────────────────────────────────────────────────────────────────────────┘
```
- Title `title-2` with a 16 px fg-3 icon; optional count pill; actions right. A tray may hold 2–4 cards side by side
  with a 4 px gap (KPI strip, legend cards).
- Tables: the table **is** the card (header row on the card top uses `--tray`, rows `--card`).
- Variant `flat` (no tray, card only) for dialogs and the login card.

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
One row: `QueryInput` (grows, 32 px, ⌘K-style kbd hint "/") · filter dropdowns rendered as **"Status: Any ▾"**
(prefix fg-3, value fg) · status filter as segmented with counts · view toggle (list/grid, 28 px icon segments) ·
Export (secondary) right-most. Active filters show as removable chips (24 px, radius 6, `--primary-soft`, primary
text, × 14 px).

### 5.7 DataTable
| Part | Spec |
|---|---|
| Container | card radius 12, 1 px line, overflow hidden |
| Header | 40 px, `--tray`, `label` fg-3, optional 14 px icon before label, sort caret 12 px; 1 px bottom line; **no vertical rules** |
| Rows | 44 px single-line, 52 px identity (avatar 28 + name `body` fg + secondary `body-sm` fg-3 mono for IDs); padding 0 12; 1 px `--line` dividers; **no zebra** |
| States | hover `--tray` @ 60 %; selected `--row-selected` + 2 px primary inset left; focus-visible ring inside row |
| Cells | numbers right-aligned tabular; inline bar 64 × 6 px radius full (fill primary, track `--inset`) + value; status = `StatusChip`; time = `RelativeTime` |
| Checkbox | 16 px radius 4, 1.5 px `--line-strong`; checked primary fill + white check |
| Footer | 48 px: "1–25 of 312" fg-3 left · rows-per-page dropdown · pagination right (28 px square buttons radius 8, current = `--tray` fill + line) |
| Density | `data-density="compact"` → rows 36/44 |

### 5.8 Chips & badges
- **StatusChip** (glossary states only): 22 px, radius full, padding 0 8 0 6, 1 px `--line`, `--card` bg, 12 px state
  icon/shape in the mark colour + label in the ink colour (`label`). Strong variant (tables with many rows): soft bg,
  no border. Always with tooltip description from `packages/ui/src/lib/status.ts`.
- **Category chip** (role, team, event type): 22 px, radius 6, padding 0 8, soft tint of its categorical slot
  (10 % on card) with text in `--fg` (never the series colour, per text-token rule) and a 6 px slot-colour dot.
- **Count badge**: 18 px pill, `--tray` (in tray: `--card`), `label` fg-2, tabular.
- **Result chip** (sign-in Success / Failed, or any pass / block outcome): use slot 1 / slot 2 dots, not status
  colours (a failed sign-in is an event, not a system failure).

### 5.9 Segmented control, tabs
- Segmented: track `--tray`, 1 px `--line`, radius 10, padding 2; segments 28 px, radius 8, padding 0 10, `label`;
  active = `--card` + `--shadow-sm` (dark `#2c2c31`), fg; inactive fg-2. Optional count pill after label. The active
  "thumb" is a shared-layout element that slides between segments (§7.3). Roving focus.
- Tabs (detail pages): line variant, 40 px, `body` 500, inactive fg-2, active fg + 2 px fg underline (radius 1);
  count pill after label; shared-layout underline.

### 5.10 Progress, meters, rings
- **Bar**: 8 px (6 px in tiles), radius full, track `--inset` (light) / `#2a2a2f` (dark); fill = primary or status
  mark; striped texture on the fill (45°, 2/4 px) for "in progress / partial"; label row above: name left, value right
  tabular.
- **Tick meter** (scores, quotas): 24–40 ticks, 3 px wide, 3 px gap, 16 px tall, radius 2; filled =
  colour, empty = `--line`; threshold tick taller (20 px) in fg-2. Use for quotas and budgets.
- **Ring**: 40 px, 4 px stroke, round cap, track `--line`; value text outside the ring (never inside at this size).
- **Threshold meter** (`Meter`): bar with a 2 × 14 px thumb at the warning threshold.

### 5.11 Avatars
28 px tables, 24 px chips, 32 px account. Initials only (no photos): `label` 600 on a tint derived
from the name hash over the 6 categorical softs; 1 px `--line` ring. Stacks overlap −6 px with a 2 px surface ring.

### 5.12 Inputs
32 px (login 40 px), radius 8, 1 px `--line-strong`, `--card` bg, padding 0 10, leading icon 16 fg-3, placeholder
fg-3 (format only). Focus: 1 px primary border + 3 px `--primary-soft` ring. Error: Down mark border + message
under the field in Down ink `body-sm`.

### 5.13 Empty, error, loading, stale (the five states)
- **Loading**: shimmer skeletons in the final shape (§7.2): text bars 10 px radius 4, chart = gridlines + 3 ghost
  bars, table = header + 8 rows.
- **Empty**: inside the card, centred, 20 px icon in a 40 px `--tray` circle, `title-3` + `body-sm` fg-3, one ghost
  or secondary button. Filtered-empty offers "Clear filters".
- **Error (no data)**: same layout, Down icon, what + why + next, "Try again" secondary.
- **Error (has data)** and **stale**: page `Notice` (40 px, radius 12, Degraded soft, ink text, icon) above the
  tiles; panel-level `StaleNote` in the tray footnote ("Data from 14:02 WIB · source name").

### 5.14 Menus, tooltips, dialogs
Menu: `--raised`, radius 12, padding 4, items 32 px radius 8, `--shadow-overlay`. Tooltip (UI): inverse `#18181b`
(dark: `#f2f2f3` text `#151517`), radius 8, `body-sm`, padding 6 10, max 280 px. Dialog: 480 / 640 px, radius 16,
padding 24, title `title-1`, footer buttons right; confirm copy per copy guide.

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
- Secondary/partial series: same hue at 35 % with the stripe texture (reference "Attended / Partial").
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
- Buttons: hover fill change 150 ms; press `scale(0.98)` 100 ms; primary hover lifts nothing.
- Cards that open a detail: hover → `--shadow-sm` + border `--line-strong`,
  translateY −1 px, 150 ms; press scale 0.995.
- Table rows: hover background 100 ms only (no movement).
- Toggle thumb: 100 ms; checkbox check-path draw 150 ms.
- Menus/popovers: opacity + scale 0.98 → 1 from the trigger origin, `--dur-pop` (180 ms) in / `--dur-instant` (100 ms) out.
- Tooltip: opacity only, `--dur-instant` (100 ms) in and out, 300 ms open delay (0 when moving between chart points).
- Dialog: scrim fade `--dur-enter` in / `--dur-exit` out; panel opacity + scale 0.98 → 1, `--dur-slow` (280 ms) in / `--dur-exit` (160 ms) out.

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
The `/ds` gallery's Motion section is the source of truth for these patterns; this is its inventory.
Layer: **CSS** = utility classes in `globals.css` (zero JS); **Motion** = the deferred motion layer. Durations are
tokens from `packages/ui/src/motion/tokens.ts` (`DUR.*`, `STAGGER`, `EASE`), never literals.

| Pattern | Layer | Tokens | Reduced motion |
|---|---|---|---|
| Page enter | CSS | `DUR.page`; route change only, the shell never animates | Fade only, `DUR.instant` |
| Stagger | CSS | `DUR.enter`, `STAGGER.step` steps, cap `STAGGER.max` items (KPI trays, card grids) | Fade only, no delay |
| Reveal | CSS | `DUR.enter` in, `DUR.fast` out; skeleton to content in the same box | Fade only, `DUR.instant` |
| Dialog | CSS | `OVERLAY_MOTION.dialog`: `DUR.slow` in, `DUR.exit` out; scrim `DUR.enter` in, `DUR.exit` out | Fade only, no scale |
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
  §7.7, and `/ds` names it. Everything else animates transform, opacity, or (new row, chip) `background-color`.
- **R9, native disclosures.** Only native `<details>` animate, via `interpolate-size: allow-keywords` and
  `::details-content` (block-size + opacity, `DUR.enter`); browsers without support stay instant. Disclosures built
  from buttons stay instant. This is the one height animation.
- **Per-card status legend.** The status legend is the `Panel` `legend` prop: an info button ("Status legend") at
  the end of the card header; page-level and inline legends were removed (see §5.8 status chips, which carry the tooltip text from
  `packages/ui/src/lib/status.ts`).

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
