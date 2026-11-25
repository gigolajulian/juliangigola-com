# v4 home: motion hooks

The v4 home renders every screen at rest. These are the
elements and properties the motion pass (`motion/`) drives. Decisions: docs/mt-decisions.md.
Styles: `app/styles/mtscroll.css` (design unit `--u`, structures D / T / P / L).

## Every held section
- `section[data-mt="<name>"][data-hold="<viewports>"] > .mt-stage`: wrap the stage
  in the held wrapper and write `--p` (0 to 1) on the section. Hero, Cover art
  and Motion carry a hold; the markup holds the values. The other sections have none.
- Ancestors use `overflow-x: clip`, never `hidden`, so sticky stages work.

## Root attributes (html)
The motion layer and the intro talk to CSS and to the React screens through attributes on `<html>`.
Typed readers live in `motion/root-attrs.ts` (`flipMs`); everything else reads the literal name.

| name | writer | readers (TS) | readers (CSS) | set | removed |
|---|---|---|---|---|---|
| `data-mt-held` | engine.ts `measure()` | rows.tsx | every `motion/*.css`, mtscroll.css | engine start, resize, the held media change (on while held) | engine stop |
| `data-mt-motion` | engine.ts | tests/ui (booking-menu, mt-motion) | every `motion/*.css` | engine start | engine stop |
| `data-mt-scrolling` | engine.ts tick | | hero.css | while the page scrolls, until 180ms after the last scroll | then, and on engine stop |
| `data-tp` | touch-parity.ts | rows.tsx | touch-parity.css | engine start | engine stop |
| `data-mtdock="off"` | motion/hero.ts setup | | mtscroll.css | hero setup | hero cleanup |
| `data-mt-pasthero` | motion/hero.ts on scroll | nav-ink.ts | hero.css, mtscroll.css | the hero is above the header | hero cleanup |
| `data-mt-flip` and `--mt-flip` | motion/hero.ts setup | hero.tsx (`flipMs`) | hero.css | hero setup; missing means the driver is not running | hero cleanup |
| `data-mt-nameout` | motion/hero.ts `sink()` | | mtscroll.css | the name is out | the name is back, a mode change, hero cleanup |
| `data-mt-par`, `data-mt-lid` | motion/rows.ts setup | | rows.css | Cover art setup | rows cleanup |
| `data-mt-intro` (1/2/3), `data-mt-own`, `data-mt-late` | intro/index.tsx, the app/layout.tsx head script | intro/index.tsx, hero.tsx, nav-ink.ts | intro.css, mtscroll.css | the head script on a first v4 visit; the intro as it plays | when the intro ends, or the head script's 6s fallback |

## Hero wall (`hero.tsx`)
- `.mt-wall > .mt-col[data-col][data-lag]`: one element per column, `data-lag` is the
  lag A (.12 / 0 / .2). Locked columns 0 to 2, side columns `-2 -1 3 4` (class
  `side`, real links too). No transform or filter on `.mt-wall` or `.mt-col` in
  CSS; `will-change: transform` is set on `.mt-col`.
- On phones (P) `.mt-col` is `display: contents` and each `figure` is placed by
  `--c2` / `--r2` (two columns). Phone drift needs a per-figure transform there.
- `[data-mt-name]` (`.mt-name`): name block, scrim, h1, `.mt-cap`, `.mt-ctas`.
  The exit at p .76 to .96 goes on this element.

## Commissions (`commissions.tsx`)
- Four frames, no driver: the rise and fade are CSS from the section's `--in` (`flow.css`, `.mt-cm-grid figure` `--e`).

## Cover art and Motion (`rows.tsx`)
- `.mt-row` is a native snap row; `.mt-track` takes the vertical-to-sideways
  transform on D. `section[data-cur]` and `.mt-item[data-on]` follow the row's own
  scroll (replace the source with p when the row is held).
- Sleeves: `.mt-sleeve` with `--o` (rest .5), `.disc` reads it, `.face .back` is the
  flip side (`data-flip` on sleeves that have one).
- Title lines: `.mt-ttl > .ln > span`.
- Films: `.mt-film[data-film]` holds the poster; the preview iframe goes inside.

## Book online and By quote
- `section[data-on]` (row key); By quote `section[data-client]` and `data-opt`.
  The client rotation is `motion/quote.ts`: it tells by-quote.tsx (`tell`, `useTold`) the client to show,
  which React renders as `data-q`, `data-client`, the name and `data-sw`. It pauses while a card is open (`.mt[data-cards="open"]`).
- `.mt-bar`: the held bottom bar (sticky inside its section).

## About (`about.tsx`)
- No hooks: the statement is static (`.mt-st`, sentence `.mt-st-t`, facts `.mt-st-facts`, portrait `.mt-st-ph`, marks `.mt-st-logos`).

## Footer (`foot.tsx`)
- Wall: one still, `.mt-fwall > img` (the next one sits under it unseen).
- Phrase: `.mt-ph-row` takes the drift transform; three `.mt-ph`, copies 2 and 3
  `[data-copy]` (hidden with `visibility` so the width stays); letters
  `span[style="--j"]`.
- Hover spot and dot pointer: `motion/foot.ts`.

## Cards
- `.mt-dim`, `.mt-card` (`data-state` from Radix). Open and close keyframes are
  in mtscroll.css, off under reduced motion.
