# SunnyGo Figma page versioning

Owner decision: 2026-11-08. Applies to the [SunnyGo design file](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA).
The current design becomes the `v1.0.0` baseline; later change requests get new pages.

**Migration status:** completed and verified in Figma on 2026-11-08. The previously approved migration renamed
areas 00–14 to `v1.0.0`, added the first-page release index, placed area 14 before the archive, organized the
affected canvas groups and locked the baseline's 86 top-level sections/frames. The index remains editable for
future releases. Owner approval was already recorded; do not ask for the same authorization again.

[Open Releases & versioning](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=146-2).
This is page versioning; no native Figma version-history checkpoint was created.

## Naming and page order

Use `<existing number> · <existing area name> · v<major>.<minor>.<patch>`. Keep the area's name and section
structure stable across revisions. For example:

| Purpose | Page name |
| --- | --- |
| Current baseline | `02 · Components / Actions & inputs · v1.0.0` |
| Next requested revision | `02 · Components / Actions & inputs · v1.0.1` |
| Next revision after that | `02 · Components / Actions & inputs · v1.0.2` |

Put an unversioned `Releases & versioning` index first, followed by the existing numbered areas. Within an area,
show the newest revision first, with earlier revisions immediately below it. Keep `99 · Archive / Superseded screens`
last; legacy explorations are not promoted to the approved baseline. Place area `14` before the archive.

The index contains the release, date, status, affected page links, preceding version, change summary and review notes.
Statuses are `Draft`, `In review`, `Approved`, and `Superseded`; track them in the index rather than changing area names.
One change request uses one new patch version across all affected areas. Unchanged areas retain their existing pages;
the release index links to them, so a release may intentionally reference several page versions.

## Change workflow

1. Read this policy and the release index. Find the latest approved version of each affected area.
2. Duplicate each affected page **before** editing it. Preserve frame names, section order and shared composition.
3. Name the duplicate with the next patch version, for example `v1.0.1`, and register it as Draft. Do not create
   an empty future version just to reserve a number.
4. Edit only the new page and any newly versioned dependencies. Reuse unchanged component instances and existing
   token bindings; never redraw equivalent inputs, cards, buttons or controls.
5. Compare old/new views, check text, spacing, auto-layout, variants, light/dark and relevant responsive states.
   Record what changed and what was actually verified in the index.
6. Mark the revision In review. Mark Approved only after the owner's approval; keep its predecessor available.

Patch increments are the default for requested changes. Use `v1.1.0` for an agreed feature-level release, or `v2.0.0`
for an agreed breaking redesign. A label such as the existing historical "audit v3" is an old iteration title,
not a release number in this new scheme; keep it clearly labelled as history.

## Preserve earlier designs

- Approved pages are reference-only. Lock their top-level sections/frames against accidental edits; locking is a
  convenience, not an immutable snapshot or permission boundary.
- Unchanged components can be referenced from an older approved library. Do not change their masters in place.
- When a master changes, duplicate the affected component family into the new version, then swap only the new
  page's instances to it. Trace nested dependencies so a changed nested master cannot alter an earlier page.
- Preserve old variable values/modes and text/effect styles. For a token or style change, create a versioned
  collection/style and rebind the new revision. Renaming or cloning a page alone does not freeze shared references.
- Do not detach every instance or flatten screens to images for versioning. Keep editable layers and component reuse.
- Page versioning is separate from Figma's built-in version history. Claim a native history checkpoint only if one
  was actually created and verified through a supported interface.

## Baseline organization checklist

- [x] Add the index and rename the 15 current design pages with the `v1.0.0` suffix, retaining their existing area names.
- [x] Move `14 · Proposal / Floating filters` ahead of `99 · Archive / Superseded screens`.
- [x] On Start here, keep one current overview; label the older audit, SaaS pack and navbar announcements as History.
  Renumber its section headings continuously: `01, 02, 03, 04`.
- [x] Preserve the existing specification, example and master groups; group the remaining loose Coverage and Floating
  filters masters separately with token-bound auto-layout spacing, outside review-screen frames. Preserve component
  IDs, prototype targets and instance references; inspect actual geometry before moving any canvas content.
- [x] Verify the page inventory, links, changed section geometry, preserved master/instance relationships and screenshots
  of the changed compositions before recording the migration as complete.

## Migration verification — 2026-11-08

- File has 17 pages: the index, 15 versioned baseline areas (00–14), then the unversioned archive. All 15 index links
  resolve to a top-level section on the intended baseline page. No empty `v1.0.1` pages were created.
- All 86 baseline top-level sections/frames are locked. The archive remains outside the baseline; area 14 retains
  its Proposal designation. Baseline approval does not change the meaning of historical explorations or proposals.
- Preserved all 526 existing component/component-set IDs, variant ownership, and all 13,490 initially observed
  instance-to-master relationships. Compared per-page sorted signatures for references, master IDs/variant parents,
  original node token bindings and prototype reactions; all original signatures match after organization.
- Area 03's Toolbar instance `20:323` exposed 14 additional nested nodes during later reads, including five instances.
  No initial instance was removed or rebound. Excluding only the newly exposed `I20:323;…` descendants reproduces
  the initial counts and all four signatures exactly. These descendants were preserved, not deleted to force a match.
- Coverage wrappers `145:17321` and `145:17323` fit inside their existing sections. Floating filters now has separate
  review (`145:18779`) and master (`145:18780`) sections. Its review board `135:3568` retains absolute position
  `(120, 120)` and size `2928 × 2890`; both new sections contain their children.
- Visually checked the four changed Start here boards, the two Coverage master groups, the Floating filters master
  group and its contextual review/master sections, and the final release index. The editable index uses the existing
  Inter typography/styles and token bindings, has 14 text nodes, no image fills, and wrapping text without overlap.
- Shared variable values/modes, styles and component content were not edited. This was Figma organization and
  repository documentation work; application tests, runtime validation and library publishing were not performed.

Figma session: `1725a334-0053-417d-9f38-356541d9f5ed`. Index page: `144:68194`; index composition: `146:2`.

## Projects form patch — 2026-11-08

Sesi 2 / DES-002 duplicated area 06 before editing it. The new page
[`06 · Coverage & enterprise UX · v1.0.1`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=152-17283)
precedes `v1.0.0`; the file now has **18 pages**. Other areas retain `v1.0.0`, the index stays first and the archive last.
The index records this patch as **In review**, with its predecessor and review links. Owner approval is pending.

- [Flow and Developer handoff](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=164-21067),
  [13 review frames](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=159-20338) and
  [seven form states](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=155-20457) cover Projects safe forms.
  Desktop/tablet frames show the content region; phone frames are 360/390 × 844.
- Reused existing instances; copied only dependencies requiring responsive/error/overlay changes. A new versioned
  overlay collection mirrors the existing CSS scrim token. Baseline masters, styles and original variable values/modes
  were not edited. Original area 06 retains seven locked sections, 22 components and two component sets.
- Screenshot review covered composition, phone reflow, duplicate light/dark, exit bottom sheet and tablet stale.
  Final audit found 167 review instances with resolved masters, no image fills, no text outside the artboards and seven
  valid prototype links. This is editable design/prototype evidence, not proof of application behavior.
- Runtime review found an unguarded Cancel path and misplaced duplicate-name feedback. Corrections, state behavior,
  responsive rules, evidence limits and acceptance criteria are in [design.md](../design.md). Implementation remains
  **not approved**; review and retest are required after Developer changes.

Figma session: `12639e23-e343-4a32-bc5f-185d0f823da5`. Final local audit:
`.superpowers/scratch/designer/figma-final-audit.json` (gitignored). No library publishing or native version-history
checkpoint was performed. The 17-page inventory above remains the historical baseline migration record.

## Independent filter patch — 2026-11-08

FIL-DES-001 duplicated area 14 before editing it. The new
[`14 · Proposal / Floating filters · v1.0.1`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=174-1974)
precedes area 14 v1.0.0. The file now has **19 pages**; index first, archive last. Area 06's Projects patch remains
separate. The index entry `184:6476` records **In review**, the previous version and links to
[seven viewport examples plus state specimens](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=177-2804)
and [UX handoff](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=182-5141).

The patch adds a standalone launcher, right modal overlay, scalar disclosures, phone/short-viewport specimens,
loading and retry states using existing primitives/tokens. Desktop result width remains 1126 px in both open/closed
frames. Final review has 2,087 descendants, including 536 instances with resolved masters, no image fills and three
valid desktop prototype links. Inter UI and Geist Mono baseline values were checked. Screenshot review corrected
short-height footer, handoff wrapping, canvas overlap and an inherited add icon on the filter launcher.

Area14 v1.0.0 retains its two locked top-level sections, seven component and two component-set IDs and the same
own-page node counts as the initial read. Original masters/token values/styles were not edited. This scoped check
does not repeat the full historical baseline relationship audit. Developer/QA accepted the UX specification;
implementation approval and owner approval remain pending. No library publishing/native history checkpoint.

Figma session: `5ebf143f-564a-4ee4-9b61-d0771a43afdc`. Evidence:
`.superpowers/scratch/designer/filter/final-audit.json` and reviewed PNGs (gitignored). Complete interaction,
responsive and verification contract: [design.md / FIL-DES-001](../design.md#fil-des-001--filter-mandiri-dan-overlay-kanan).

## Bifrost superseding patch — 2026-11-08

Owner DEC-017 supersedes FIL-DES-001's modal/scalar/draft-Apply direction. Its area14 v1.0.1 index status is now
**Superseded**; the page/content remains available and was never marked Approved. FIL-DES-002 duplicated it before
editing into [`14 · Proposal / Floating filters · v1.0.2`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=188-5132).
It precedes v1.0.1/v1.0.0; the file now has **20 pages**, index first and archive last. Area06 Projects is unchanged.

Index entry `196:2` records **In review**, predecessor, affected area and review links:
[Bifrost review](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=190-5669),
[active UX handoff](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=193-8299).
The patch provides a default collapsed rail, nonmodal desktop checkbox sidebar, auto-apply/Clear all, phone launcher/
live-selection sheet and recovery states. It adds no invented domain fields/facet counts. API multi scope is separately
authorized by Product Lead DEC-017; this is no longer the scalar-only position request.

Final review: eight viewport examples plus state specimens; 2,486 descendants, including 604 resolved instances,
no image fills, Inter/Geist Mono and two valid desktop expand/collapse prototype links. Rail/open result rect is the
same1062×527 at x281/y170 with a constant64px rail clearance. One-line Clear all and header/group dividers were reviewed.
The v1.0.1 predecessor's review retains its exact2,087 nodes/536 instances and seven content states in own-page reads;
collection/mode counts remain unchanged. Original masters/tokens/styles were not edited. This scoped check does not
claim a new whole-file relationship audit or application approval.

Product Lead accepted the UX direction and safe rail clearance; Developer/QA received the complete handoff.
Implementation review and final owner approval remain pending. No library publish/native history checkpoint.
Session `df69f680-29ee-4c7e-bbbe-f1efa8d45b5f`; evidence `.superpowers/scratch/designer/filter-bifrost/final-audit.json`
and reviewed PNGs (gitignored). [Active spec](../design.md#fil-des-002--sidebar-bifrost-checkbox-multi-dan-auto-apply).

Runtime review clarification within the same In-review FIL-DES-002 request: anchor means the rendered shell-header
**bottom +16 px**, minimum16 if offscreen, including the sheet's top inset. Normal Projects example is y8+56+16=80;
the five desktop/tablet/short examples were corrected from y72 to80. This is an inset clarification during review,
not a new approved design. Node counts/instance links remain unchanged; `open-anchor-reviewed.png` records the fix.
Runtime top128 caused by the portal's root header-token scope is tracked as DES-FIL-002A; implementation not approved.

## First-content anchor patch — v1.0.3 / 2026-11-08

Owner DEC-018 replaces the shell-header+16/72/80 anchor with **first visible content surface after PageHeader,
no extra gap**. FIL-DES-003 duplicated v1.0.2 into
[`14 · Proposal / Floating filters · v1.0.3`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=203-8491)
before edits. Index entry `218:2` preserves it as **Superseded** by the later rail request; the DEC-018 anchor
remains part of the current v1.0.4 contract. Earlier anchor findings are superseded, not claimed fixed.

[Review](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=203-9242) and
[handoff](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=203-9335) cover13 anchor/responsive examples:
rail/open equality, Permissions actions uncovered, loading region, short compact/open scroll and retained scroll.
Final own-page audit: 3,872 descendants/936 resolved instances, no image fills, Inter/Geist Mono. New dependencies
were limited to compact/loading/Permissions geometry examples. Prior masters/tokens/styles were not edited.
Evidence `.superpowers/scratch/designer/filter-anchor/final-audit.json` and reviewed PNGs (gitignored), session
`9d0cc90f-6ae2-42d3-80c9-d61a48d7eee6`. No runtime approval/library publishing/native checkpoint.

## Hug rail and stable refresh — v1.0.4 / 2026-11-08

Owner DEC-019 requests a short collapsed rail, sidebar-family toggle icons and no false-toggle refresh entry.
FIL-DES-004 duplicated v1.0.3 into
[`14 · Proposal / Floating filters · v1.0.4`](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-10173)
before edits. The file now has **22 pages**, revisions newest-first, index first/archive last. Other areas remain
unchanged. Index entry `218:3` records **In review** with
[review](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-10924),
[active handoff](https://www.figma.com/design/yWRVvatRqyDZapm52tQHWA?node-id=211-11089) and predecessor links.

New rail family has regular shown/hidden badge variants (derived heights156/126) and compact44 variants, with
source-matched SidebarCollapse/SidebarExpand glyphs and code-aligned18px CountBadge. Expanded height/DEC-018 anchor
are retained. Review has15 viewport examples plus anatomy/state specimens: **4,518 descendants, 1,099 resolved
instances, no image fills, Inter/Geist Mono and seven valid prototype links**. Composition/anatomy/handoff/index
were visually checked. v1.0.3 own-page counts remain exactly3,872/936 and collection/mode counts unchanged.
No original masters/tokens/styles were edited; no publishing/native checkpoint.

The first-paint contract is documented, not claimed proved by static Figma screenshots. Developer refresh artifacts
initially mixed stale tail JPEGs; clean run manifests/phase/ancestor-motion evidence and candidate retest remain
required for implementation approval. [Current specification](../design.md#fil-des-004--rail-hug-content-ikon-sidebar-dan-refresh-stabil).
Evidence `.superpowers/scratch/designer/filter-hug/final-audit.json` and reviewed PNGs; session
`ded1af30-2c4e-41bf-8303-4578fcb773f3`. Earlier revisions stay available as history.

### Verified candidate review — 2026-11-08

The initial mixed artifact packet was replaced. Designer accepted the supplied Mac/Linux Permissions rail/refresh
matrices on runtime fingerprint `7baa40b391212ceb142afe667b7882705bdf98930561f420d27b5a5d0b66f117`, Mac build
`Cp4GjCl9aN94ZxtW5Fxq0` / Linux `pPqSrrRBoEB-UWyhRGPFX`. Independent QA FIL-QA-004 subsequently completed
its targeted retest and closed QA-FIL-001/QA-EVID-001 within the tested scope; see [QA](../qa.md) and
[Designer review](../design.md#konsolidasi-setelah-retest-qa-independen).

Index text `218:3` was updated in Figma with that verified status, evidence scope and remaining owner/release gate.
It remains **In review**: this is scoped visual/QA verification, not the owner's release approval. Entry geometry
remains1358×140 within the existing editable index; composition/pages/masters/tokens/styles are unchanged. A metadata
verification update does not create a new design patch. No native checkpoint or library publication was performed.
Product Lead DEC-020 subsequently accepted the filter revision for local use/review on that fingerprint, explicitly
retaining Figma In review; full template release remains a separate decision.
