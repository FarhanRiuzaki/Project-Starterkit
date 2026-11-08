# SunnyGo Figma implementation

Source: https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA

The current screen masters and shared components are authoritative. Archived explorations are excluded.

Implementation sequence:

1. Map semantic tokens and five palettes; preserve independent light/dark and density preferences.
2. Reuse Panel, Field, Input, Button, table and chart components; every content card gets an outer tray.
3. Implement the approved login artwork, sidebar tree, top-navbar range and refresh controls.
4. Connect time controls to URL state and actual server data; retain authorization, paging, exports, and stale/error states.
5. Add reusable form controls and wizard composition to the live design-system gallery.
6. Verify typecheck, lint, unit/integration checks, responsive interaction, accessibility and bundle budget.

Project behavior takes precedence over illustrative fixture data. Keep the starterkit's neutral vocabulary, permission-aware navigation, and existing authentication flows.

## Component map

| Figma family | Shared implementation |
| --- | --- |
| Foundations, Current + four palettes, light/dark | `tokens.css`, `palettes.css`, SSR palette cookie, account menu |
| Cards, table wrappers, KPI strip | Shared `CardSurface` geometry, `Panel`, `StatTiles`, `DataTable`; mandatory tray on standalone cards |
| Navbar range, quick/custom selection, refresh | `DateRangeControl`, `RefreshControl`, shell `TimeControls`; URL state and module query scope |
| Input, affixes, number, textarea, date/time, OTP | Existing `Input` plus `InputAffix`, `NumberInput`, `Textarea`, `DatePicker`, `TimeInput`, `OtpInput` |
| Radio, choice cards, checkbox group, switch, slider | `form-options.tsx`, `CheckboxGroup`; native keyboard semantics |
| Searchable single/multiple select | `Combobox`, composing the existing deferred Popover and Command |
| Upload and processing progress | `FileUpload` (dashed dropzone + selected rows), `FileItem` (selected / uploading / confirmed success / error), `ProgressBar`; caller owns transport, cancellation and progress. `/ds#ds-forms` shows selection, disabled, cancel, remove and validation. |
| Fieldset, sections, layouts, actions, error summary | `Fieldset`, `FormSection`, `FormLayout`, `FormActions`, `FormErrorSummary` |
| Repeatable fields and filter rules | `RepeatableField`, `FilterRule`; controlled values, stable IDs and focus restoration |
| Stepper, floating wizard, review, completion | Existing `StepIndicator`, `StepMarker`; `Wizard`, `WizardReview`, `WizardCompletion` |
| Settings and disclosures | `SettingsRow`, controlled `Accordion`; closed content retains drafts |
| Notification, activity, onboarding | `NotificationItem`, `ActivityItem`, `OnboardingChecklist` |
| Plan, integration, key, billing patterns | `PlanCard`, `IntegrationCard`, `ApiKeyRow`, `BillingSummary`; data and action slots |

The live `/ds` gallery demonstrates these components. Billing, integrations, uploads and invitations are examples, not new backend modules. DatePicker uses the shared custom Calendar with ISO typing, bounds, roving day focus and month/year keyboard navigation. DateRangeControl reuses Calendar and opens independent Absolute / Relative / Now endpoint editors; RefreshControl uses the shared custom radio menu on live modules without a time range. TimeInput retains the platform time keyboard. The original login vector is served locally in light/dark versions and covers the entire login page, without an outer frame.

## Behavior and motion contract

- Endpoint drafts commit together through the header Apply button; quick presets apply on selection. Timestamp ranges are half-open [start, end), support up to 366 days and resolve relative endpoints against one API clock on each refresh. Legacy from/to calendar ranges remain inclusive with their 92-day limit.
- Range changes reset paging and retain filters/sort. Refresh selection retains paging. Both are encoded in the URL.
- Account/profile stays in the sidebar footer and the phone navigation drawer. Submenus use connected curved tree lines; route tabs use grey active fill.
- Unused date and refresh controls are hidden. Only active queries of the current module refresh. Auto-refresh pauses on hidden tabs, offline, forms, open dialogs/menus and while a request is in flight. No overlapping timer requests.
- Existing list exports retain their permission checks and CSV protections. One export action per table; no duplicate page-header action.
- Existing motion tokens and reduced-motion rules remain authoritative. Login artwork is static; disclosure content preserves drafts; controls preserve keyboard behavior. Never animate entire dashboards on data refresh.
- Reuse the named global component. Do not reproduce an input, card, button, table toolbar or progress panel inside a feature.
- Every independent content card uses the shared gray tray and inner card. Input text remains vertically centered; value slots fill available width, affixes and action buttons keep their intrinsic width.

## Verification notes

- The production build uses the separate `.next-e2e` directory; the development build is not overwritten.
- `bun run check` passes: type checking, lint and 1,389 tests (657 UI, 8 shared, 245 web, 479 API).
- Browser checks cover real range/refresh requests, a single audit export, palette persistence, keyboard combobox selection, OTP input, wizard validation, authentication, accessibility, responsive tables and navigation without flashes or layout shifts.
- Dashboard previews cover 360, 390, 834 and 1440 px. Login previews cover 390 and 1440 px in light and dark. Gallery screenshots cover desktop and mobile in both modes.
- macOS and Linux Chromium gallery baselines are updated from their respective browsers and visually reviewed. The form-pack test separately verifies equal input positions when adjacent fields have different helper text. The implementation interaction suite and gallery accessibility checks pass on both platforms. Linux uses Chromium 153 in an isolated container; CI itself has not been triggered.
- All routes meet the 250 kB gzip first-load JavaScript budget (183.4–249.6 kB). `CardSurface` separates shared tray geometry from interactive panel dependencies so error pages do not pull those dependencies into every route.

## Component coverage update

The `/ds` catalog maps 155 live Figma component families and compositions to reusable APIs, source paths, example sections and source nodes. See [the full mapping](figma-component-coverage.md). Screen/table masters share composition APIs; the older CurrentScope placeholder follows the newer hide-when-unused rule. The catalog supports name/API search. Components and examples use the shared tokens and outer tray.

New examples cover CalendarDay, Calendar, custom DatePicker and date range/refresh, route tabs and curved navigation, breadcrumbs with reachable collapsed ancestors, stepper layouts/error/disabled/optional states, BulkActionBar, UserCard, five-state DataRegion, form layouts, sign-in states, dialogs, drawer, popover, command palette, toast recovery and the icon library.

Calendar keyboard behavior follows the [WAI APG date picker pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/), adapted to shared popover focus handling. Calendar is loaded on demand by DatePicker. Product mutations remain owned by features; gallery samples never call billing, invitation or credential APIs.

The time picker follows the supplied reference and the [Kibana time filter model](https://www.elastic.co/docs/explore-analyze/query-filter/filtering): the calendar segment opens Quick select (Last/Next + amount + unit), two-column Commonly used presets, actual recently applied ranges and Refresh every. Show dates reveals independent start/end segments. Each endpoint opens Absolute (shared calendar + half-hour time list + precise editable timestamp), Relative (amount/unit and rounding), or Now. Endpoint edits remain drafts until the header Apply button is used. Refresh intervals accept whole seconds from 5 seconds to 1 hour; invalid drafts pause scheduling. All controls retain a 32 px drawn height and 44 px touch targets. Editors load on demand and scroll within the phone viewport.

The URL stores start/end expressions such as `now-15m` and `now`. Query keys retain these expressions, so server prefetch and browser reads agree; each API refresh resolves both endpoints against one clock. Dashboard selected-period totals, chart values, audit lists and CSV exports use the same precise window. The dashboard chart continues to aggregate matching events per calendar day. The existing date-only query remains supported. See the generated API schemas and time-range tests for bounds and validation.
