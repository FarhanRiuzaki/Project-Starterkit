# UI Standard (page consistency)

Binding for every page in `apps/web`. Companion to `docs/standards/design-system.md`, the `/ds` gallery, and
`docs/standards/copy-guide.md`. When a page needs something this standard does not cover, extend the standard
(and the gallery) first, then use it — never invent a one-off.

## 0. Widths: phone, tablet, desktop

Every page works fully on a phone, a tablet and a desktop (design-system §0). Phone 360–767 px (reference 390,
`max-md:`), tablet 768–1279 px (reference 834, the 64 px rail), desktop ≥ 1280 px (reference 1440, `xl:`).

- No horizontal page scroll from 360 px; a wide component (matrix, wide table, tablist) scrolls inside its card
  (`tests/e2e/responsive.spec.ts`, `expectNoHorizontalScroll`).
- Phone shell: top bar with menu button, logo mark, page title, search and account; the sidebar is a drawer
  (design-system §4). A dialog is a bottom sheet below 768 px (§5.14).
- Targets: drawn 28 px minimum, 32 px default; under a coarse pointer every control's hit area is at least 44 × 44 px
  without changing the drawn size (`base.css`); anything shown on hover is always shown on touch.
- Inputs: 16 px text or more under a coarse pointer (no iOS zoom), from the `--text-input-touch` token.
- Inner scroll areas (sidebar, phone menu, palette, matrix, wide tables, dialogs, menus, tab rows) use `scroll-quiet`
  (`packages/ui/src/styles/base.css`): a 6 px rounded thumb, no arrow buttons, shown only while the area is hovered
  or holds keyboard focus; the page keeps the native scrollbar. Where the box must stay exactly as wide as its
  neighbours (the sidebar menu), `ScrollArea` hides the native bar (`scroll-none`) and draws a 4 px thumb that takes no
  room, shown on hover, focus or while scrolling. `architecture.test.ts` fails an `overflow-*-auto` without one of them.
- Decide per width in CSS (`max-md:` / `md:` / `xl:`), never with `matchMedia` in render: the server HTML is the
  first paint, so a JS width switch would flicker or shift.

## 0a. Surfaces (bg → sheet → tray → card)

Every region has exactly one job, and its surface says it (design-system §0, §2, §3):

| Surface | Token | Holds |
|---|---|---|
| App background | `bg-bg` | The sidebar sits directly on it |
| Sheet | `bg-sheet` (radius 16, 1 px `line`, 8 px inset from the viewport) | The top bar and the page content — one per page |
| Tray | `bg-tray` (radius 16, 1 px `line`, padding `tray` = 4 px) | Grouping: panel title, KPI group, table header row, segmented track |
| Card | `bg-card` (radius 12 = tray radius − tray padding, 1 px `line`, `shadow-xs` light only) | The data itself: chart, table rows, KPI value |
| Inset | `bg-inset` | A well inside a card (sparkline wells, code) |
| Raised | `bg-raised` + `shadow-overlay` | Floating layers only: menus, popovers, dialogs, tooltips |

Each step is a quiet 2–4 % lightness change plus a hairline; shadows are only for things that float. Ink is neutral
(`fg`, `fg-2`, `fg-3`; `fg-4` never carries information); blue (`primary`) means selection/primary and series 1;
status colours (`{healthy,degraded,down,stopped,unknown}-{mark,ink,soft}`) are reserved for the five health states;
`chart-1…6` for series only. Fonts: Inter Variable (sans) and Geist Mono (IDs, IPs, hashes, `eyebrow`), self-hosted
through `next/font`.

## 1. Page anatomy (top to bottom, always in this order)

1. **PageHeader** — title (noun; on a sub-page also the top bar breadcrumb's last crumb, design-system §4), aggregate
   `StatusChip` if the page has a health concept, `actions` slot right-aligned in this order: `TimeRangePicker` (if the
   page is time-scoped) → one primary action or `ActionMenu`. Secondary actions go in `more` (`HeaderAction[]`: label,
   `href` or `onSelect`, `reason` when blocked, `destructive`, `busy`): buttons after the primary from 768 px, one
   "More actions" menu below. Title and description wrap. Description = one sentence: scope + freshness. No status
   legend here: legends belong to the card that shows the statuses (item 5). A list's panel names its view ("All users
   50"), not the page again. Search is in the sidebar (⌘K), the theme in the account menu.
2. **Page-level banners** — stale/partial-source `Notice` (one per page, aggregated), never inside panels.
3. **StatTiles** — one KPI tray of 4 (or 3) tiles, the page's headline numbers; same order and units everywhere the
   same metric appears (e.g. "Active users" is always first). **Label = the metric only** ("Users",
   "Sign-ins", "Failed sign-ins"), never the period, so labels fit at 1280. The period goes in the `caption`:
   "Last 7 days", "Last 7 days · vs previous 7 days" (with a delta pill), or "Today, since 00:00 WIB"
   for today-counters. One icon per metric on every page, by meaning from `packages/ui/src/ui/icons.ts` (Hugeicons Stroke Rounded). A new
   meaning gets a new export there first; never import `@hugeicons/core-free-icons` elsewhere (architecture test).
4. **Toolbar** — on the list panel's title row (`Panel toolbar={<Toolbar>…</Toolbar>}`): "Users 51" left, then
   `QueryInput` · filters (`ToolbarFilters`) · view `Segmented` · export right-most; the panel description moves to
   its own line under them. Wraps under the title when the row is too narrow; on a phone the search takes the row and
   the filters sit in the "Filters" sheet. Never a separate row above the panel.
5. **Panels** — `Panel` with title (noun phrase), optional description (sentence case), optional actions slot.
   Charts above tables. Below-the-fold charts in `LazyMount`. The **description is the scope** (period and
   granularity, one shape everywhere: "Last 24 hours · per hour, WIB" or "Last 7 days"); the **footnote is provenance** (`StaleNote`, source notes).
   A card that shows statuses passes them as `legend` (`Panel legend={[{ health, label, description }]}`): an info
   button labelled "Status legend" at the end of the card header opens the legend popover (keyboard: Tab to it,
   Enter opens, Escape closes and returns focus). Never a page-level, toolbar or inline legend; `StatusLegend` is
   rendered only by `Panel` (`apps/web/src/test/architecture.test.ts`).
   Chart legends sit in the Panel `actions` (`<ChartLegend items={legendItems(series)} />`, chart `hideLegend`).
   A ranking (HBarChart) in a stretched panel ends with a `Facts` summary ("Top 5 total", "Share of all …")
   pinned to the bottom (`bodyClassName="flex flex-col"`), never an empty band.
6. **Footer** is the shell's — pages add none.

Detail pages add `Tabs` (line variant) directly under the header; the tab value lives in the URL `tab`.

## 2. Grid, spacing, sizing

- Content fills the sheet's width, no max (padding 32 px horizontal, 24 top, 40 bottom): a collapsed sidebar or a wide
  screen widens the grid instead of leaving empty margins. Rhythm tokens (spec §2.2):
  page sections `gap-section` (24), sibling panels/tiles `gap-gutter` (16; `--gap-grid` in tokens.css), tray padding `p-tray` (4), inside a card
  `gap-panel` (16), dense rows `gap-dense` (8).
- Content padding: 32 px sides from 768 px, 16 px on a phone (the sheet is edge to edge there).
- 12-column grid at every desktop width; siblings in a row share width and height. Spans: KPI strip = one tray of
  4 (or 3) equal tiles; primary chart 8 + 4 companion; paired charts 6 + 6; card grids 3 col (4 per row) ≥ 1440,
  4 col (3 per row) 1280–1439; tables 12. Never 5 or 7 equal items in a row. 768–1279: spans of 3 and 4 become 6.
  Below 768: one column (spans become 12), a KPI tray 2 tiles per row.
- Chart heights only from `CHART_HEIGHT` (sm 160 / md 240 / lg 320). Sparklines 28px. Never ad-hoc heights.
- Tokens only: colors, radii, shadows, type scale (`text-title-1`, `text-body-sm`, `text-label`, `text-caption`),
  no arbitrary px except those defined in the tokens.
- Targets: ≥ 28 px (`h-7` / `size-7`), 32 px default (`h-8` / `size-8`); nav items 36 px (44 px in the phone drawer);
  44 × 44 px hit area under a coarse pointer (§0).

## 3. State matrix (every data region implements all five)

| State | Component | Rule |
|---|---|---|
| Loading | `Skeleton` in the final layout shape, revealed with `Reveal` | A page's first data is server-prefetched (`Prefetch` in `page.tsx`), so a page load shows no loading state. Any loading state shows only after 150 ms and then stays at least 300 ms (`useDelayedFlag`, `LOADING`): no flash. No spinners for regions; no layout shift (skeleton and content share one grid cell). Route-level: a route's `loading.tsx` renders `RouteSkeleton` in the page's shape, so the footer doesn't jump |
| Empty | `EmptyState` | Explains when data appears; filtered-empty offers "Clear filters" |
| Error (no data) | `ErrorState` with retry | What + why + next step (copy guide) |
| Error (has data) | keep data + page `Notice` | Never replace loaded rows with an error |
| Stale / partial | `StaleNote` in panel header or page `Notice` | States age + source |

## 4. Data display

- Tables (spec "Standar tabel & skalabilitas"): every list a user pages through is server-driven, for any number of
  rows. One pattern, no table builds its own paging:
  - Server: the API's GET route parses its `…ListQuery` (`ListQuery` extended with `sortParam(KEYS)` and filters)
    before the guard and answers `pageQuery(…)` (`apps/api/src/kernel/pagination.ts`) → `Page<T>`; `page` 1–1000
    (deeper is 400: narrow the filters), `pageSize` 15 | 25 | 50 | 100 (default 15), `totalCapped` when the count
    stops at 100,000 (shown "100,000+"). `apps/api/test/architecture/conformance.test.ts` (d) fails a list GET without
    `pageQuery`; the non-list allowlist is exact.
  - Client: `useTableQuery({ key, path, spec })` (spec = sort whitelist, default sort, filter parsers, `search`
    keys) → `DataTable` with `paging={t.paging}`, `sort`/`onSortChange` and `sortable` columns (header buttons with
    `aria-sort`); footer "Showing 1–15 of 312" + rows-per-page select + first / previous / numbers / next / last.
  - URL state: `page`, `pageSize`, `sort`, `q` and filters live in the query string (defaults omitted). Any change
    but the page goes back to page 1; committed changes push a history entry (Back undoes them), search keystrokes
    (debounced) replace it. While the next page or sort loads, the previous rows stay with a busy dim, never a
    skeleton. A page past the end moves to the last page.
  - Short fixed lists inside a record (a user's last 20 actions, the dashboard's 5 newest) stay plain `DataTable`
    rows from the record's own endpoint. Numeric columns right-aligned,
  tabular figures. First column = identity (28 px `Avatar` + name + secondary id), with a `min-w-*` on the column so
  auto layout never squeezes it. `Avatar seed={id}`: the tint follows the stable id, the initials the display name, so one user looks
  the same on every page. Status column uses `StatusChip`. Timestamps use
  `RelativeTime` (absolute in tooltip; on touch a second line). Long values `Truncate` with title. On a phone the rows
  are stacked cards: give every column a `mobile` role (`title` exactly once, `meta`, `hidden`, `lead` for the row
  checkbox); sorting becomes the "Sort by" select and the pagination compact (design-system §0 "Data surfaces"). Put
  every toolbar filter but the search in `ToolbarFilters` with its active count (the phone's "Filters" sheet).
  A row button that a card drops (`max-md:hidden`, `className` + `wrapClassName` on a `BlockedButton`) gets a
  phone/touch item in the row's `ActionMenu` with its reason as the hint.
- Saved views (Polaris IndexFilters, SAP Fiori variant management): every list page's toolbar ends with
  `SavedViewsMenu` then `ColumnsMenu`. "Views" names the open view when it is a saved one ("View: Inactive admins");
  its menu opens a saved view, saves the current search, filters, sort and rows per page under a name ("Save view
  as…", at most 20 per page, names unique per page) and deletes the open one with Undo. Views are the user's own, on the
  server (`/api/me/views`), so they follow the user to any device; the list loads when the menu first opens.
- Column chooser (Carbon "Customize columns", Ant ProTable column settings, NN/g data tables): every list page's
  toolbar ends with `ColumnsMenu` (`end` of `Toolbar`), fed by `useTableQuery`'s `hidden` / `setHidden` and passed to
  `DataTable hidden`. The button says how many are hidden ("Columns · 2 hidden"); the menu lists every column but the
  row checkbox, stays open while ticking, and ends with "Reset to default". The identity column (mobile `title`) and a
  column marked `hideable: false` are listed ticked and disabled. The choice is per viewer and per page in the prefs
  cookie (`cols:/users`), so the table renders without those columns on first paint; a hidden column also leaves the
  phone card. Not on a record's short fixed lists.
- Sticky parts (NN/g data tables): from 768 px the header row sticks to the top of the window while a long page
  scrolls (the table box stops being a scroll container once the table fits); while a wide table scrolls sideways in its
  card, the row checkbox and the first column stick to its left edge and the row actions to its right, with a hairline.
- Select all (Polaris, Carbon batch actions): once every row of the page is ticked, the bulk bar offers "Select all N
  users" (every match of the search and filters, at most 1,000: above that it says to narrow them) and then "Select this
  page only"; a bulk action then sends the list's filters (`filter`) instead of ids, and its dialog names the count.
- Focus after a row goes away (deleted, revoked, moved out by a filter after a change): focus that was in that row moves
  to the row that took its place, else the one before, else the table region; focus the user moved elsewhere stays.
- Row actions (`DataTable` `rowActions`) are secondary shortcuts: they show on row hover, on keyboard focus anywhere in
  the row, while one of their menus is open and always on a touch screen (`pointer-coarse:`), and always stay in the DOM and the tab order (opacity only, never
  `hidden`). Their names say the target ("Revoke the session started …"), so a screen reader hears them in place.
- Metric formats (same metric → same format): counts `formatNumber` exact in tables and facts, compact
  (`formatCompact` / `compactParts`) in tiles and charts; bytes "16.4 GB / 20 GB" in table cells, "19 GB of 20 GB ·
  95%" in detail tiles and prose, "95% of 20 GB" on cards (percent first where space is short); latency
  "600 ms" in rows, "4.2 s" for p95; shares whole percent.
- Status: always `StatusChip`/`StatusIcon` (shape + label + description tooltip) from the status glossary.
  Never colored text alone. Every card that shows status passes its `legend` (§1 item 5).
- Charts: from `@/components/charts` only; fixed categorical order per entity (never by rank); legend for ≥ 2
  series; tooltips on hover and focus; one y-axis; time axes on round ticks in WIB.
- Numbers: through `packages/ui/src/lib/format.ts` only.

## 5. Interaction

- State that a user would share or bookmark (filters, tab, range, view, page) lives in the URL; tables through
  `useTableQuery` + `TableSpec` (one parser per key, each with its own fallback; `apps/web/src/lib/shared/table-state.ts`).
  zod schemas live in `packages/shared/src/contracts/*` and are imported by the API and the web's server code; client
  code imports them as types only, so zod never reaches a route's first load (≤ 250 kB gz, `bun run budget`).
- Disabled actions always explain why (tooltip / menu label; on touch the `BlockedButton` caption).
- Keyboard: every action reachable; one tab stop per card; roving focus in segmented controls; focus moves to
  the region after pagination; ⌘K palette reaches every page.
- Motion: see §5a.

## 5a. Motion (design-system §7)

- Motion explains change (where it came from, what is loading, what moved), never decorates. Durations and
  easings come from the tokens only (`--dur-*`, `--ease-*`; JS mirror `DUR`/`EASE` in `packages/ui/src/motion/tokens.ts`):
  instant 100, fast 150, enter 220, page 260, exit 160, slow 280, tween ≤ 600 ms. Exits are always faster than enters.
- Two layers. The **base layer** is CSS keyframes/transitions plus a rAF tween, so server HTML is visible without
  JS and nothing waits for a chunk. The **Framer layer** (`MotionLayer`, `framer.tsx`: `LazyMotion` + `domMax`,
  `MotionConfig reducedMotion="user"`) is imported after idle, outside every route's first-load JS, and upgrades:
  page crossfade with exit, `layoutId` indicators with `SPRING_INDICATOR`, spring number tweens, card reorder. A
  blocked or failed chunk leaves the CSS layer in place. Only `packages/ui/src/motion/` imports `motion` /
  `framer-motion`, and only `framer.tsx` does (`packages/ui/src/motion/layer.test.ts`).
- Primitives: `PageTransition` (page enter via the app group's `template.tsx`, keyed by route segment — search-param
  changes never re-animate; the shell never animates), `Reveal` (skeleton → content crossfade), `Stagger` /
  `StaggerItem` (35 ms per item, max 8 staggered — card grids, KPI trays, legend cards; `reorder` for sortable card grids),
  `NumberTween` (KPI values, final value announced only), `SharedIndicator` (segment thumb, tab underline).
- Animate `transform` and `opacity` only. No `layout`/`layoutId` and no stagger on table rows, list items or anything
  with > 20 siblings; tables fade in once. `will-change` never in static CSS.
- `prefers-reduced-motion`: opacity only (no translate, scale, spring, stroke-draw, number tween, shimmer sweep).
- Bundle: only the base layer is in a route's first load; each route stays ≤ 250 kB gz (`bun run budget`).
  Below-the-fold tables load lazily (`next/dynamic`) when a route would otherwise cross the budget.

## 5b. Interaction standards (from Laws of UX, NN/g, WCAG 2.2, Airform)

Each rule names its source and what enforces it. A new screen follows them without being asked; a new pattern of the
same kind extends this list (and its check) first.

| Rule | Source | Where / enforced by |
|---|---|---|
| A reversible action on one record (deactivate, and the like) runs at once and answers with `toast.undo(message, onUndo, { description })` (Undo for 8 s). Irreversible actions (delete) and bulk actions keep `ConfirmActionDialog` with their impact. | NN/g confirmation dialogs; Laws of UX: Peak-End | `packages/ui/src/ui/toast.ts`, `toast.test.ts`; `features/users/users-page.tsx`, `user-detail.tsx`; `tests/e2e/ux-patterns.spec.ts` |
| Such a toggle is optimistic: the record shows its new state at once in every cached list page and its detail, and goes back (with `toast.error`) when the server refuses; on success the lists refetch as usual. | TanStack Query optimistic updates; Laws of UX: Doherty threshold (under 400 ms) | `patchUserCache` in `features/users/use-users.ts` (+ test) |
| A press on a button while the page's JS is still on the way acts once React handles that button (the last press, at most 5 s old, once; never a form's submit button, which the browser submits itself). A screen needs nothing for it. | Measured: with every script 1 s late, a press on "Views" or "Columns" opened nothing, also after hydration (e2e probe, 2026-10-21) | `apps/web/src/lib/shared/early-press.ts` (+ test), inline in `app/layout.tsx`; `tests/e2e/ux-patterns.spec.ts` "a press before the JS arrives" |
| `?` outside a text field lists every keyboard shortcut (the "Go to" ones only for pages the viewer can open); so do the account menu's and the palette's "Keyboard shortcuts". Its switch turns single-key shortcuts (G then a letter, `?`) off, kept in the prefs cookie (`keys`); ⌘K has a modifier and stays. A shortcut shows its key caps (`Kbd`) wherever its action is named: palette rows, rail tooltips, the menu item. | GitHub and Linear (`?`); NN/g UI accelerators; WCAG 2.1.4 Character Key Shortcuts | `components/shell/{shortcuts-dialog,command-palette,palette-dialog,sidebar,account-menu}.tsx`; `lib/shared/shortcuts.test.ts`, `prefs.test.ts` |
| Every password field is `PasswordInput`: masked by default, a "Show password" toggle, a Caps Lock note, masked again on submit; paste and password managers work. No raw `type="password"`. | NN/g password creation; web.dev sign-in forms; WCAG 3.3.8 | `packages/ui/src/ui/password-input.tsx` (+ test); `architecture.test.ts` "password fields are PasswordInput" |
| A new-password field lists its requirements before the first keystroke and ticks them off while typing: `<PasswordChecks checks={passwordChecks(pw, again?)} />`, its id in the field's `aria-describedby`. Rules come from the contract (`lib/shared/password.ts` checks they agree). | NN/g password creation; Laws of UX: Goal-Gradient | `packages/ui/src/ds/password-checks.tsx`; `apps/web/src/lib/shared/password.ts` (+ test); `architecture.test.ts` |
| A value the user can't change is an `Input readOnly` (inset fill, fg-2), never an input that looks editable; say why in the field note. | Laws of UX: Mental Model | `packages/ui/src/ui/input.tsx` |
| A form with typed, unsaved changes asks before a link click drops them (`useLeaveGuard` + a "Leave without saving" `ConfirmActionDialog`). | NN/g heuristic 5 (error prevention) | `apps/web/src/lib/client/use-leave-guard.ts`; `user-form.tsx`, `profile-form.tsx`, `role-detail.tsx` |
| A list page reopens as it was left: its last filters, sort and rows per page (not the page or the search) live in the prefs cookie, and the sidebar, phone menu, breadcrumb, palette and `G` shortcuts open that view. A new list page joins `VIEW_PAGES`. | Airform "design for the tenth visit"; Laws of UX: Working Memory | `apps/web/src/lib/shared/prefs.ts` (+ test); `use-table-query.ts`; `tests/e2e/ux-patterns.spec.ts` |
| The breadcrumb names the parents and the open page (`Users / Rina Wulandari / Edit user`); every crumb but the last links back. A screen gets it by rendering `PageHeader` (and `trail` for a middle parent). | Laws of UX: Jakob's Law, Working Memory | `components/shell/top-bar.tsx`, `page-header.tsx`, `lib/client/crumb-trail.ts`, `lib/shared/nav.ts` (+ test); `ux-patterns.spec.ts` |
| A nav item may list views of its page as `children` (Users → All / Active / Inactive users), opened under it on a guide line while the page is open. | Airform sidebar; Laws of UX: Chunking | `lib/shared/nav.ts` `activeChild` (+ test); `sidebar.tsx`, `mobile-nav.tsx` |
| A list's search and filters sit on its panel's title row (`Panel toolbar`), as Airform's "All users 145" row. | Airform admin mockups; Laws of UX: Proximity | `packages/ui/src/ds/panel.tsx`; §1 item 4 |
| A headline number has context: a count over a period shows its change against the period before (`StatTile delta`, `formatSignedNumber`), with `good` set by meaning (more failed sign-ins is bad, never green). | Airform "numbers need context" | `features/dashboard/dashboard-page.tsx`; `GET /v1/dashboard` |
| A dashboard answers first, explains second, details last: KPI tray → charts → tables. | Airform "decide what goes at the top" | §1 page anatomy |
| Records show words, not codes: activity actions through `actionLabel`, glossary terms only (copy guide). | NN/g heuristic 2 (match the real world) | `packages/shared/src/audit.ts` |
| Siblings in a row share height; label/value rows look the same on one page. | Laws of UX: Common Region, Similarity | §2; `user-detail.tsx` |
| A form marks required fields with a red `*` (`Field required`, one `RequiredNote`), groups fields in `FormSection`s on a page (title and purpose left, fields right from 768 px) and keeps its buttons in a sticky `FormActions`; Submit is never disabled for invalid input. | Baymard, NN/g, W3C H90, Polaris, Carbon (design-system §5.16) | `packages/ui/src/ds/{field,form-layout}.tsx` (+ tests); /ds "Form layout"; `features/users/user-form.tsx`, `features/me/profile-form.tsx` |
| A form validates through `useForm` (`lib/validate.ts` rules): errors after leaving a field or on submit, cleared when fixed; a failed submit shows `ErrorSummary` and focuses the first field; messages are instructions. A multi-step form is `FormWizard` (+ `ReviewList`); a choice among many is `Combobox`, among 2–6 `RadioGroup`; a file is `FileUpload` with the page's `upload`; task progress is `Progress`; a sequence of steps over time is `Timeline`. | W3C WAI, NN/g, GOV.UK, WAI-ARIA APG, Apple HIG (design-system §5.15) | `packages/ui/src/ds/{use-form,error-summary,form-wizard,combobox,radio-group,file-upload,progress,timeline,disclosure}.tsx` (+ tests); /ds "Forms and flows" |
| Design with real data: long names, zero, a brand-new account, a bad day. Every data region keeps its five states (§3). | Airform "design with real data" | §3; `docs/standards/copy-guide.md` (empty states) |

## 6. Consistency checklist (run per page before merge)

1. Header anatomy and actions order as §1?
2. Same metric → same label, unit, format, icon and position as on other pages (§1 item 3, §4 metric formats)?
   Period in the tile caption and the panel description, never in a label?
3. All five states implemented per data region (§3)?
4. Status chips from the glossary + the card's `legend`?
5. Lazy-load rule (§1 item 5, §5a bundle) followed?
6. URL state for filters/tab/range/page?
7. Copy passes the copy guide checklist?
8. Phone 390 (and 360), tablet 834, desktop 1440 / 1920, light + dark: no horizontal page scroll, no clipped labels,
   axe 0 serious or critical, touch targets ≥ 44 px on the phone? (`bun run e2e`: `responsive.spec.ts` on the
   desktop, tablet and mobile projects; `a11y.spec.ts` on the same three.)
9. Surfaces follow §0a (sheet → tray → card), siblings symmetric (§2), motion per §5a?
10. Interaction standards of §5b (undo over confirm for one reversible action, PasswordInput and PasswordChecks,
    read-only look, leave guard, remembered list view, numbers with context)?
