# Vendored affectUI items

73 of the 74 free items of affectUI (https://www.affectui.com, source https://github.com/flohoeller/affectui), MIT,
copyright Florian Höller (adfects); the licence text is in `./LICENSE`. Taken on 2026-11-14 from the public registry
(`https://www.affectui.com/r/<slug>.json`) and compared file by file with the repository at commit
`46721aa59276d97927a8cb89ee898027b637834d`: 71 are identical after line 1, the other two differ only by the comments
listed below. The repository also holds a second skin of 53 items (`*-clean.tsx`); those are not here.
The 74th, Text Reveal, is ported onto the motion tokens instead: `../motion/text-reveal.tsx`.

The 141 Pro items are a paid product and are not here.

## What these files are

One `.tsx` per item, as upstream wrote it: the styles are a CSS string in the file, hoisted into `<head>` by React
(`<style href precedence>`), with upstream's own colours, durations and easings. They import only `react`. That is why
this folder is outside the token rules (`apps/web/src/test/architecture.test.ts`, `VENDORED`), ESLint
(`eslint.config.mjs`) and type checking (`// @ts-nocheck` on line 1; the exported prop types still apply to callers).
Rules and reasons: `docs/standards/design-system.md` §7.10.

Import one item at a time: `import { ToolCallCard } from "@starterkit/ui/affect/tool-call-card"`. Every item is shown
with sample data on `/ds/affect` (`apps/web/src/features/ds/affect/`).

## Changes from upstream

- Line 1 of every file: the `// @ts-nocheck` comment.
- `avatar.tsx` (two comments) and `text-field.tsx` (one comment): a word the domain guard bans
  (`apps/web/src/test/no-domain.test.ts`) replaced by "teams".

Nothing else differs. Keep it that way: change behaviour in the caller or in a wrapper, not here.

## Updating an item

Download `https://www.affectui.com/r/<slug>.json`, write `files[0].content` over `<slug>.tsx`, put the first line back,
then run `bun run check` and look at the item on `/ds/affect`.

## Theming

Upstream reads optional `--aui-*` variables and falls back to its own values. `../styles/tokens.css` sets 31 of them
on `:root` as aliases of the app tokens (`--aui-ink: var(--fg)`, `--aui-surface: var(--card)`, `--aui-radius:
var(--radius-md)`, `--aui-font`, `--aui-focus`, status colours, shadows; `tokens.test.ts` fails on an alias no item
reads), so surfaces, ink, lines, radius and font follow the app in light and dark without touching these files.
`--aui-blue` and `--aui-info` are the app's primary: upstream's light blue is 2:1 as text on a light surface.

Not reached by the aliases: the decorative hues (`--aui-purple`, `--aui-teal`, `--aui-pink`, `--aui-amber`), every
duration and easing but `--aui-ease`, and colours an item hard-codes. axe (`color-contrast`, WCAG AA) on `/ds/affect`
on 2026-11-14, after the mapping:

| Theme | Nodes | Items |
|---|---|---|
| Light | 31 | Model Wheel 6, Layer Stack 6, Logo Marquee 6, Avatar 3 (tinted initials), Code Block 2, Ghosted Chat 2, Card (footer), Profile Menu (badge), Decision Inbox, Email Draft, Cover Flow, Shimmer Loader 1 each |
| Dark | 14 | Model Wheel 6, Logo Marquee 6, Code Block 1, Shimmer Loader 1 |

Before one of these goes on a screen, fix its contrast in a wrapper or take the corrected file from upstream.
