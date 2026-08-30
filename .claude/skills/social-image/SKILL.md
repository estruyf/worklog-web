---
name: social-image
description: Create a Worklog promo / social / OG share image announcing a feature — the branded 1200x630 card with the product mock on the right, rendered to PNG. Use when asked for a social image, promo image, share card, OG image, launch graphic or "something to post" about a Worklog feature.
---

# Worklog social cards

One HTML file, rendered by headless Chrome. No build step, no image library, no
design tool — the card is written in the same tokens the app is, so a promo image
can never drift from the product it is promoting.

`template.html` renders as-is and is the Lists card that shipped in
`public/social/lists.png`. Together with `render.sh` it reproduces that PNG
**byte for byte**. That is the contract of this skill: if a change here stops
that being true, the cards have stopped matching each other.

## Making one

1. **Copy the template** to the scratchpad — `cp .claude/skills/social-image/template.html <scratch>/<feature>.html`.
   Never edit `template.html` itself; it is the reference card.
2. **Fill the four SLOTs** marked in the file: eyebrow name, headline, lede +
   chips, and the panel on the right. Everything else stays exactly as it is.
3. **Draw the panel from the real component.** Open the view you are announcing
   and copy its structure, sizes and colours — the Lists panel's rings are the
   same 34px `conic-gradient` the tiles use in `src/ui/views/ListsView.tsx`. A
   panel invented for the card is the difference between a screenshot and an ad.
4. **Render**: `.claude/skills/social-image/render.sh <scratch>/<feature>.html <scratch>/<feature>.png`
5. **Look at it.** Read the PNG back and actually judge it. Two failures are
   invisible in the markup and obvious in the image: dead space at the bottom of
   the panel (add a row until it fills), and a headline whose second line is
   longer than its first.
6. **Save it** to `public/social/<feature>.png`. It deploys with the site, so it
   doubles as an `og:image` — `Layout.astro` takes an `image` prop.
7. **Changelog**: a shipped promo asset does not need a line. The feature it
   announces does.

## What makes the card look like Worklog

| | |
| --- | --- |
| Ground | the landing page's wash — two brand radials over `#fff → #fbfcfd → #f6f8fa`. Never a flat white, never a dark card. |
| Palette | `--brand #f4cf4d`, `--brand-strong #e2be2e`, `--brand-tint #fbefc0`, ink `#1f2328`, muted `#57606a`, success `#16a34a`. All from `src/pages/index.astro` and `src/ui/styles.css`. |
| Type | Inter — 62px/800 headline at `-0.033em`, 20px lede, 15px chips. The headline is the only thing above 24px. |
| Brand mark | the `worklog-icon.svg` glyph inline, wordmark beside it, top-left. It is the only logo on the card. |
| Highlight | one `<u>` behind one phrase of the headline. One. |
| Panel | white, `18px` radius, one hairline border, one soft shadow. It holds the feature and nothing else — no browser chrome, no cursor, no annotations. |
| Footer | `worklog.struyfconsulting.be`, muted, bottom-left. No URLs anywhere else. |

Left column reads top to bottom: mark → `NEW · <feature>` → headline → lede →
chips → domain. Right column is the product. Nothing crosses the gutter.

## Copy

Write the promise, not the release note. "Checklists you run again" beats "Lists
are here". The lede is one sentence a stranger understands without knowing what
Worklog is. Chips are checkable facts — *Plain Markdown in your repo*, *Drag to
reorder*, *Works offline* — never adjectives, and never more than three.

## Sizes

`1200x630` rendered at 2x (`2400x1260`) is the default and covers X, LinkedIn,
Mastodon and OG. For a square (Instagram, LinkedIn portrait), set `html, body` to
`1080x1080`, stack the columns — copy on top, panel below — and pass
`--window-size=1080,1080` to Chrome. Keep every other value identical.

## Fonts

Inter comes from Google Fonts over the network at render time, matching the app's
`astro:assets` font config. Offline it falls back to the system stack and the
card is *close but not identical* — check the render before shipping one made on
a plane.
