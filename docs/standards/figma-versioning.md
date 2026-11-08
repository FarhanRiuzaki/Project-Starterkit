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
