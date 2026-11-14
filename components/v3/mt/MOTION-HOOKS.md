# v4 home: motion hooks

The static build (`?mtscroll=1`) renders every screen at rest. These are the
elements and properties the motion pass drives. Spec: SPEC-home-scroll.md.
Styles: `app/styles/mtscroll.css` (design unit `--u`, structures D / T / P / L).

## Every held section
- `section[data-mt="<name>"][data-hold="<viewports>"] > .mt-stage`: wrap the stage
  in the held wrapper and write `--p` (0 to 1) on the section. Holds: hero 2.1,
  covers 1.5, motion 2.5, about 1.7, foot 1. Book online, By quote and
  Commissions have none.
- Ancestors use `overflow-x: clip`, never `hidden`, so sticky stages work.

## Hero wall (`hero.tsx`)
- `.mt-wall > .mt-col[data-col][data-a]`: one element per column, `data-a` is the
  lag A (.12 / 0 / .2). Locked columns 0 to 2, side columns `-2 -1 3 4` (class
  `side`, `aria-hidden`). No transform or filter on `.mt-wall` or `.mt-col` in
  CSS; `will-change: transform` is set on `.mt-col`.
- On phones (P) `.mt-col` is `display: contents` and each `figure` is placed by
  `--c2` / `--r2` (two columns). Phone drift needs a per-figure transform there.
- `[data-mt-name]` (`.mt-name`): name block, scrim, h1, `.mt-cap`, `.mt-ctas`.
  The exit at p .76 to .96 goes on this element.

## Commissions (`commissions.tsx`)
- `.mt-comm-head` is sticky (CSS). `section[data-cur]`, `[data-mt-count]`,
  `[data-mt-name]` inside `.ln` (overflow clip) for the name line rise.
- Figures carry `data-i`. Phone held label: not built.
- Logos: `.mt-logos-row` is a native sideways row; `.mt-logos-track` takes the
  drift transform. The second copy `.set[data-copy]` is `display: none` until the
  drift shows it (it is already `aria-hidden`).

## Cover art and Motion (`held-row.tsx`, `rows.tsx`)
- `.mt-row` is a native snap row; `.mt-track` takes the vertical-to-sideways
  transform on D. `section[data-cur]` and `.mt-item[data-on]` follow the row's own
  scroll (replace the source with p when the row is held).
- Sleeves: `.mt-sleeve` with `--o` (rest .5), `.disc` reads it, `.face .back` is the
  flip side (`data-flip` on sleeves that have one).
- Title lines: `.mt-ttl > .ln > span`.
- Films: `.mt-film[data-film]` holds the poster; the preview iframe goes inside.

## Book online and By quote
- `section[data-on]` (row key); By quote `section[data-client]` and `data-opt`.
  The client rotation advances `ci` in `by-quote.tsx` (marked hook) and pauses
  while a card is open (`.mt[data-cards="open"]`).
- `.mt-bar`: the held bottom bar (sticky inside its section).

## About (`about.tsx`)
- Wordmark letters: `.mt-wordmark > span[style="--j:i"]`.
- Sentence words: `.mt-say > span[style="--w:i"]`, `--n` on `.mt-say`.
- Rows `li[style="--j"]`, facts `div[style="--j"]`, hairline `hr`, button `.mt-more-me`.

## Footer (`foot.tsx`)
- Wall: `.mt-fwall > .mt-fcol[data-col][style="--c"] > figure[data-slug][data-name]`.
  Phone row `.mt-frow > figure`.
- Phrase: `.mt-ph-row` takes the drift transform; three `.mt-ph`, copies 2 and 3
  `[data-copy]` (hidden with `visibility` so the width stays); letters
  `span[style="--j"]`.
- Hover spot, dot pointer, wall lift and open: not built.

## Cards
- `.mt-dim`, `.mt-card` (`data-state` from Radix). Open and close keyframes are
  in mtscroll.css, off under reduced motion.
