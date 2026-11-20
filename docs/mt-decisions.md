# v4 home motion: decisions

The dated notes that used to sit in `components/v3/mt` code comments. The
comments now state the current rule; who asked, when, and what it replaced is
here. Grouped by file, newest first. Site-wide decisions are in
`docs/decisions.md`.

Not moved yet: `data.ts`, `home.tsx` and `rows.tsx` still carry their dated
notes (another branch was editing them).

## foot.tsx

- 2026-11-15: a new footer still every 5s, was 2s. Julian: "photo switches too fast".
- 2026-11-14: one still behind the links, dimmed by the scrim. Julian picked it over the wall of frames.

## hero.tsx

- 2026-11-17: rows five and six are off the wall (Julian: one less row, twice). Their photos turn up in the idle swaps.
- 2026-11-15: the idle wall became the V4 default. `?idle=0` turns it off.

## inquiry-card.tsx

- 2026-11-19: the typed fields last the visit, through a full close and reopen. Julian: "keep the draft".

## intro/index.tsx

- 2026-11-19: the preload hold went on after Julian's OK. `?preload=0` is the old 6 + 18 start.
- 2026-11-19: arrived thumbs are used first. On a slow laptop (Windows Chrome) the 1500ms start came with only a few in, and cycling those filled whole edge columns with one photo.
- 2026-11-15: the push lands and stays. It used to carry a touch past (.007) and settle back; Julian said the settle read as extra.
- 2026-11-14: S0 is 0.56, was 0.46: closer, so fewer and larger frames (Julian picked option a).
- 2026-11-14: return visits within 30 days get the 3.2s intro (Julian).

## motion/about.css

- 2026-11-14: desktop About has no stop (option a1). The beats follow the timed `--tp` instead of the hold's `--p`.

## motion/bars.ts

- 2026-11-14: Book online and By quote rows change only on a tap. The scroll walk through the rows was removed (Julian).

## motion/commissions.css

- 2026-11-14: no scrim behind the Commissions head; the heading sits on the photos (Julian).

## motion/commissions.ts

- 2026-11-14: the Commissions head is on or off on a timer, not a scroll-tied fade (Julian).

## motion/depth.css

- 2026-11-17: the tilted wall takes no hits, only its links do. Under preserve-3d the wall's plane cut in front of the middle column, so clicks did nothing and `:hover` never matched (QA and MAC).
- 2026-11-14: the Commissions photo shift is half of the first pass, which pushed in too deep (Julian).

## motion/depth.ts

- 2026-11-17: when the pointer leaves the window the wall settles flat slowly. It snapped back before (Julian).

## motion/flow.css

- 2026-11-17: Sessions follows About and slides over it, since About's sinking name showed through the Sessions heading (Julian).
- 2026-11-16: About comes in with one straight edge from the bottom up, the way the Book online photo arrives (Julian). It was a window opening from 22% / 26% insets.

## motion/foot.css, motion/foot.ts

- 2026-11-15: idle and hover traded places (Julian). The phrase rests lit and the spot takes it back to grey; before, it rested grey and the spot lit it.
- 2026-11-15: the phrase drifts at 68 design px a second, 54 under the pointer (Julian). 30 was too slow and nearly stopped on hover, 90 a bit fast; the hover speed stayed.

## motion/hero.css

- 2026-11-19: the band under the name fades as the tagline and buttons leave. Julian: "so it looks integrated".
- 2026-11-19: no hover lift on the wall (Julian).

## motion/hero.ts

- 2026-11-20: `?mtflip=0` (the hard cut back) removed; the card turn is the only path (Julian, owner decisions round 8).
- 2026-11-18: one tone per word on the tagline, so a word never splits black and white (Julian).
- 2026-11-18: phones and tablets pin the name and sink it out the desktop's way. Julian: it scrolled away with the first screen.
- 2026-11-17: the idle card turn is 1300ms, Julian's pick of 600 / 900 / 1300.
- 2026-11-17: the tagline colour follows what is under it, black or white, grey over the white page (Julian).
- 2026-11-17: the tagline tone pass cost 51 hit tests, 5 to 8ms at 1440 and 52ms on a phone-speed CPU, every frame (measured on live). Now ten passes a second at most, a word tested at its two ends.
- 2026-11-17: the column follow is 0.64, was 0.4; Julian halved the delay twice ("half the delay"). The live Recent()'s 0.2 felt laggy here.
- 2026-11-17: the name sinks from its top to the window's lower edge plus 24px. It rode 0.6 of the window and was gone well before the ride ended. Julian: "even longer, almost right before" the button.
- 2026-11-17: the name's way out, third pass. Julian: "too fast, needs to be longer and finish later". The ride is read off See the work, over as its top edge enters the window, taking the last three quarters of the scroll up to that point, with a soft start and an even pace (t*t*(2-t)) instead of the s-curve.
- 2026-11-17: second pass. Julian: "too quick, it needs to go out a bit slower with parallax". The ride took 0.8 of a row and the tagline and buttons sink ahead of the name.
- 2026-11-17: phones and tablets hide captions near the name and tagline too (MAC).
- 2026-11-17: a gone name block stays in the accessibility tree. With visibility:hidden, VoiceOver in Safari read the name, then the wall, skipping the tagline and buttons (MAC).
- 2026-11-16: the name holds until the fourth row is whole in the window, then rides out. Julian: "it needs to stay in place until 3 rows are scrolled and move down and out".
- 2026-11-16: an unseen margin round the name, tagline and buttons hides nearby captions. A photo's caption ran through the tagline (Julian).
- 2026-11-15: the right column's end drop is 70, was 40. Julian: "a bit lower".
- 2026-11-15: with three columns the wall ends in a stair down to the left, so See the work has the open corner (Julian).

## motion/quote.css, motion/quote.ts

- 2026-11-20: the `?mtask=1` trial (the full-photo screen, the clients as marks, the options' wide frames, the trial section order) removed; the compact strip is the only form (Julian, owner decisions round 8).
- 2026-11-17: the `?mtask=1` trial screen is two thirds of a screen tall, was a full screen, so Sessions stays in view above it (Julian).
- 2026-11-17: no wipe or zoom on the way in (Julian).

## motion/rows.css

- 2026-11-20: the row head stays at full opacity. Faded mid-screen its labels fell to 3.2:1 (audit).
- 2026-11-18: the film focus mark is white, 2px, well inside the edges. The 1px accent at 3px was too faint (audit).
- 2026-11-17: the cover in focus is larger (Julian).
- 2026-11-17: the film's title block sits bottom left. Julian: "on the left". It was bottom right from 2026-11-15.
- 2026-11-17: the covers' row clip got 70 more units of top padding. A hovered cover's top was cut (Jahannam's side B looked zoomed in, Julian).
- 2026-11-17: tall windows put the cover's middle on the stage's. Julian: "more centered vertically"; it had centred the row in what was left.
- 2026-11-17: the pile the covers were dealt from is gone (Julian).
- 2026-11-16: wide windows of ordinary height scale the covers 15% and raise them to the stage's middle. Julian: "scale the cover arts a bit more on default and bring them up higher so they're in the middle of the section".
- 2026-11-15: tall windows scale the covers into the empty height. Julian: "scale cover, dont add under".
- 2026-11-15: "See all covers" sits bottom right and the counter bottom left (Julian).
- 2026-11-15: the Motion heading is 56 design px. 88 was too large; before that 40 (Julian).
- 2026-11-15: the film pager sits on the right, small and close to the edge. 20px at 36 in was too large (Julian).
- 2026-11-14: the new film develops over the old one, never dimming or passing through black (Julian).

## motion/rows.ts

- 2026-11-18: holds snap to the nearest item (Julian). `?mtsnap=0` turns it off.
- 2026-11-17: the Commissions lid is kept. Julian: "keep the lid". `?mtlid=0` turned it off until 2026-11-20 (flag removed, owner decisions round 8).
- 2026-11-17: the first film starts a screen early. Julian: play as soon as possible.
- 2026-11-15: the covers parallax became the V4 default. Julian: "turn on the parallax by default". `?mtpar=0` turned it off until 2026-11-20 (flag removed, owner decisions round 8).
- 2026-11-15: the first record comes out of its sleeve over the first 5% of the hold (Julian).
- 2026-11-14: the record's slide is eased at both ends (Julian).
- 2026-11-14: previews load in the films before and after the current one (Julian).

## motion/touch-parity.ts

- 2026-11-18: phones and tablets get the desktop's motion. Julian: "integrate", then "push" after MAC passed all eight.
