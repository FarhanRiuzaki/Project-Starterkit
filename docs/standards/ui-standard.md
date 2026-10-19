# UI Standard (page consistency)

Binding for every page in `apps/web`. Companion to `docs/standards/design-system.md`, the `/ds` gallery, and
`docs/standards/copy-guide.md`. When a page needs something this standard does not cover, extend the standard
(and the gallery) first, then use it — never invent a one-off.

## 0. Desktop only

The app runs in a desktop browser and is never opened on a phone (design-system §0). Design for 1280–1920 px,
**1440 px is the reference width, 1280 px the minimum**. 768–1279 px only has to avoid horizontal page scroll
(the sidebar becomes the icon rail, grids drop to fewer columns); there is no tablet or mobile layout, no bottom bar,
no stacked-list tables and no 375 px rule. Targets are sized for mouse and keyboard: **28 px minimum, 32 px default**
for buttons, icon buttons, segments and pagination; no `pointer-coarse:` variants.

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

1. **PageHeader** — breadcrumb (detail pages only: `Users / <name>`), title (noun), aggregate `StatusChip` if the
   page has a health concept, `actions` slot right-aligned in this order: `TimeRangePicker` (if the page is
   time-scoped) → one primary action or `ActionMenu`. Description = one sentence: scope + freshness. No status
   legend here: legends belong to the card that shows the statuses (item 5).
2. **Page-level banners** — stale/partial-source `Notice` (one per page, aggregated), never inside panels.
3. **StatTiles** — one KPI tray of 4 (or 3) tiles, the page's headline numbers; same order and units everywhere the
   same metric appears (e.g. "Active users" is always first). **Label = the metric only** ("Users",
   "Sign-ins", "Failed sign-ins"), never the period, so labels fit at 1280. The period goes in the `caption`:
   "Last 7 days", "Last 7 days · vs previous 7 days" (with a delta pill), or "Today, since 00:00 WIB"
   for today-counters. One icon per metric on every page, by meaning from `packages/ui/src/ui/icons.ts` (Hugeicons Stroke Rounded). A new
   meaning gets a new export there first; never import `@hugeicons/core-free-icons` elsewhere (architecture test).
4. **Toolbar** — `QueryInput` (left, grows) · saved views / filters as chips · view `Segmented` (right) ·
   export (right-most). One row; wraps only when the content column is too narrow (below 1280).
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

- Content max 1376px inside the sheet (padding 32 px horizontal, 24 top, 40 bottom). Rhythm tokens (spec §2.2):
  page sections `gap-section` (24), sibling panels/tiles `gap-gutter` (16; `--gap-grid` in tokens.css), tray padding `p-tray` (4), inside a card
  `gap-panel` (16), dense rows `gap-dense` (8).
- 12-column grid at every desktop width; siblings in a row share width and height. Spans: KPI strip = one tray of
  4 (or 3) equal tiles; primary chart 8 + 4 companion; paired charts 6 + 6; card grids 3 col (4 per row) ≥ 1440,
  4 col (3 per row) 1280–1439; tables 12. Never 5 or 7 equal items in a row. 768–1279: spans of 3 and 4 become 6.
- Chart heights only from `CHART_HEIGHT` (sm 160 / md 240 / lg 320). Sparklines 28px. Never ad-hoc heights.
- Tokens only: colors, radii, shadows, type scale (`text-title-1`, `text-body-sm`, `text-label`, `text-caption`),
  no arbitrary px except those defined in the tokens.
- Targets: ≥ 28 px (`h-7` / `size-7`), 32 px default (`h-8` / `size-8`); nav items 36 px.

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
  - Server: the GET route parses `ListQuery` (extended with its `sortParam(KEYS)` and filters) before the guard
    and answers `paginate(rows, q, SORTERS, defaultSort)` → `Page<T>`; `page` 1–1000 (deeper is 400: narrow the
    filters), `pageSize` 15 | 25 | 50 | 100 (default 15), `totalCapped` when the backend stops counting
    (shown "100,000+"). The architecture test fails a list GET without `paginate(`; the non-list allowlist is exact.
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
  `RelativeTime` (absolute in tooltip). Long values `Truncate` with title. Desktop only: no stacked-list fallback.
- Row actions (`DataTable` `rowActions`) are secondary shortcuts: they show on row hover, on keyboard focus anywhere in
  the row and while one of their menus is open, and always stay in the DOM and the tab order (opacity only, never
  `hidden`). Their names say the target ("Revoke the session started …"), so a screen reader hears them in place.
- Metric formats (same metric → same format): counts `formatNumber` exact in tables and facts, compact
  (`formatCompact` / `compactParts`) in tiles and charts; bytes "16.4 GB / 20 GB" in table cells, "19 GB of 20 GB ·
  95%" in detail tiles and prose, "95% of 20 GB" on cards (percent first where space is short); latency
  "600 ms" in rows, "4.2 s" for p95; shares whole percent.
- Status: always `StatusChip`/`StatusIcon` (shape + label + description tooltip) from the status glossary.
  Never colored text alone. Every card that shows status passes its `legend` (§1 item 5).
- Charts: from `@/components/charts` only; fixed categorical order per entity (never by rank); legend for ≥ 2
  series; tooltips on hover and focus; one y-axis; time axes on round ticks in WIB.
- Numbers: through `lib/shared/format.ts` only.

## 5. Interaction

- State that a user would share or bookmark (filters, tab, range, view, page) lives in the URL; tables through
  `useTableQuery` + `TableSpec` (one parser per key, each with its own fallback; `apps/web/src/lib/shared/table-state.ts`).
  zod schemas live in `apps/web/src/lib/shared/contracts/*` and are imported by route handlers; client code never imports zod
  into a route's first load (≤ 250 kB gz, `bun run budget`).
- Disabled actions always explain why (tooltip / menu label).
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

## 6. Consistency checklist (run per page before merge)

1. Header anatomy and actions order as §1?
2. Same metric → same label, unit, format, icon and position as on other pages (§1 item 3, §4 metric formats)?
   Period in the tile caption and the panel description, never in a label?
3. All five states implemented per data region (§3)?
4. Status chips from the glossary + the card's `legend`?
5. Lazy-load rule (§1 item 5, §5a bundle) followed?
6. URL state for filters/tab/range/page?
7. Copy passes the copy guide checklist?
8. 1280 / 1440 / 1920 light + dark (and no horizontal page scroll at 768–1279): no clipped labels, axe 0 serious or critical?
9. Surfaces follow §0a (sheet → tray → card), siblings symmetric (§2), motion per §5a?
