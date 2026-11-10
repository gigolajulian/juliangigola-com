# Audit checklist

The fixed list every `/impeccable audit` re-checks first, on live main, before it looks for anything new. Each line is pass or fail by a check anyone can repeat. A score change then means one of these moved, or a new finding was added below. New findings join the list with the date found.

Baseline: 2026-11-08, main 3383db6e (v3.0.117), 15/20. Report: https://claude.ai/artifact/SfG5EutjAVSNXpmsPKJiZE

Latest: 2026-11-09, main bf36598c (v3.0.137), 18/20. Report: https://claude.ai/artifact/769VqyXrNTzLC9qBbHSNPe

How to run: a scratch worktree at `origin/main` (never the shared main folder, it can be weeks behind), then the detector (`impeccable detect app components`) and each check below.

## Known detector false positives

Skip these, they are on purpose:
- `components/v3/canvas.tsx` `<img>` without src: filled at runtime / by `getImageProps`.
- `overused-font` Inter Tight: the brand face (DESIGN.md).
- `bounce-easing` in `app/styles/tokens.css` (`--ease-spring`, `--ease-bounce`, `--ease-rubber`) and `components/credit-card.tsx`: fallbacks for the `linear()` springs.
- `buried-raster` and `kicker-above-heading` on the homepage: the hero crossfade slides load once the cover rests, and the mono label over a display heading is the two-register system (DESIGN.md).

Probe false positives (scratch a11y probe, not the detector):
- "Unnamed links" on the homepage: the client logos, named by `role="img"` + `aria-label` inside the link.
- Contrast about 1.03:1 in light on the header and session titles: text over a photograph, read as a flat background.
- Desktop nav links 13px tall: WCAG 2.5.8 spacing exception (24px apart).
- No h1 on the homepage at 375: measured during the splash; there is one h1 after it.

## By design

Measured or traced and kept on purpose. Skip these unless the reason below stops being true:
- **Wall blur** (`app/styles/drift-wall.css` `.questions-wall { filter: blur(5px) }`): Julian's rack focus. Measured 2026-11-09 on live /book?classic at 1440, dark and light, GPU on: 16.7ms median, 16.9ms worst, zero frames over 20ms, the same with the blur off. The wall only shows on /book?classic.
- **Cover `decoding="sync"`** (`components/v3/work.tsx` grid tiles and strip covers): added in 5bc4f2bd (2026-10-24) so covers no longer fly in empty or flash blank on iPhone and iPad when switching Grid and Strip. Change it only after an iPad recording.

## Checks

| # | Sev | Check | How to verify | Status |
|---|---|---|---|---|
| 1 | P1 | No render block on normal pages | `curl -s https://juliangigola.com/ \| grep -c 'rel="expect"'` is 0 | fixed in #675 |
| 2 | P1 | Hero first slide loads at high priority | homepage HTML: hero preload links and first-slide `.v3d`/`.v3l` imgs carry `fetchpriority="high"` (they stay `loading="lazy"` so the hidden theme is never fetched) | fixed in #675 |
| 3 | P1 | Proof cell has no button inside a button | `components/proof-gallery.tsx`: `.proof-zoom` is not a child of the `role="button"` cell | fixed in #677 |
| 4 | P1 | Strip view lets browser zoom through | `components/v3/work.tsx` strip `wheel` returns on `e.ctrlKey` | fixed in #675 |
| 5 | P2 | Proof lightbox and menu drawer hold focus | focus moves in on open, back to the trigger on close, page behind is `inert` (`proof-gallery.tsx`, `v3/chrome.tsx`) | fixed in #677 (proof), #704 (drawer) |
| 6 | P2 | Proof page targets 44px | `app/styles/proof.css` close, tabs, zoom at least 44px tall on touch | fixed in #677 |
| 7 | P2 | Lightbox cancel only resets | `components/lightbox.tsx`: `onPointerCancel` does not run the step/dismiss logic (needs a device recording first) | open |
| 8 | P2 | Calendar bars do not animate height | `components/time-picker.tsx`: no `transition-[height]` | fixed in #678 |
| 9 | P2 | No full-screen blur over the moving wall | see By design | by design |
| 10 | P2 | Strip progress bar uses no width | `components/v3/work.tsx` `stripBar` sets a transform or clip, not `style.width` | fixed in #678 |
| 11 | P2 | v3.css colors come from tokens.css | `app/styles/v3.css` and `strip-motion.css` hold no copied oklch token values | fixed in #711 |
| 12 | P3 | Color scope wedge visible in light | `components/v3/work.tsx` wedge fill reads a theme variable | fixed in #711 |
| 13 | P3 | Lazy grid covers decode async | see By design | by design |
| 14 | P3 | Prototypes not shipped to every visitor | `V3Canvas` loaded with `dynamic()`; `WorkShell` not built in `portfolio/(index)/layout.tsx` (confirm chunk sizes first) | fixed in #705 |
| 15 | P2 | Grid titles readable over light photos | `app/styles/v3.css` `.wt-n` scrim runs .8 at the foot to 0 by 88%, titles at least 3:1 on AZURE BLOOM and I WANNA BE A HUMAN (found 2026-11-09) | fixed in #707 |
| 16 | P3 | No side stripe on the admin proofs list | `app/styles/proof.css` has no `.proof-desk-on` inset bar; the row uses a tint (found 2026-11-09) | fixed in #704 |
| 17 | P2 | /admin Work view fits a phone | `/admin?view=projects` scrollWidth equals the viewport at 390, 393, 430 (found 2026-11-09 by QA and MAC) | fixed in #717 |
| 18 | P3 | Credit avatar grows with a transform | `app/styles/v3.css` `.cr-av` transitions width and margin-right on hover; small cost, likely by design (eb6d67ce), ask Julian before changing (found 2026-11-09) | closed: kept by design, Julian 2026-11-09 |
