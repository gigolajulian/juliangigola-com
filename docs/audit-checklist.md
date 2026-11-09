# Audit checklist

The fixed list every `/impeccable audit` re-checks first, on live main, before it looks for anything new. Each line is pass or fail by a check anyone can repeat. A score change then means one of these moved, or a new finding was added below. New findings join the list with the date found.

Baseline: 2026-11-08, main 3383db6e (v3.0.117), 15/20. Report: https://claude.ai/artifact/SfG5EutjAVSNXpmsPKJiZE

How to run: a scratch worktree at `origin/main` (never the shared main folder, it can be weeks behind), then the detector (`impeccable detect app components`) and each check below.

## Known detector false positives

Skip these, they are on purpose:
- `components/v3/canvas.tsx` `<img>` without src: filled at runtime / by `getImageProps`.
- `overused-font` Inter Tight: the brand face (DESIGN.md).
- `bounce-easing` in `app/styles/tokens.css` (`--ease-spring`, `--ease-bounce`, `--ease-rubber`) and `components/credit-card.tsx`: fallbacks for the `linear()` springs.

## Checks

| # | Sev | Check | How to verify | Status |
|---|---|---|---|---|
| 1 | P1 | No render block on normal pages | `curl -s https://juliangigola.com/ \| grep -c 'rel="expect"'` is 0 | fixed in audit-checklist-lcp |
| 2 | P1 | Hero first slide loads at high priority | homepage HTML: hero preload links and first-slide `.v3d`/`.v3l` imgs carry `fetchpriority="high"` (they stay `loading="lazy"` so the hidden theme is never fetched) | fixed in audit-checklist-lcp |
| 3 | P1 | Proof cell has no button inside a button | `components/proof-gallery.tsx`: `.proof-zoom` is not a child of the `role="button"` cell | open |
| 4 | P1 | Strip view lets browser zoom through | `components/v3/work.tsx` strip `wheel` returns on `e.ctrlKey` | fixed in audit-checklist-lcp |
| 5 | P2 | Proof lightbox and menu drawer hold focus | focus moves in on open, back to the trigger on close, page behind is `inert` (`proof-gallery.tsx`, `v3/chrome.tsx`) | open |
| 6 | P2 | Proof page targets 44px | `app/styles/proof.css` close, tabs, zoom at least 44px tall on touch | open |
| 7 | P2 | Lightbox cancel only resets | `components/lightbox.tsx`: `onPointerCancel` does not run the step/dismiss logic (needs a device recording first) | open |
| 8 | P2 | Calendar bars do not animate height | `components/time-picker.tsx`: no `transition-[height]` | open |
| 9 | P2 | No full-screen blur over the moving wall | `app/styles/drift-wall.css` `.questions-wall` has no `filter: blur` while it drifts | open |
| 10 | P2 | Strip progress bar uses no width | `components/v3/work.tsx` `stripBar` sets a transform or clip, not `style.width` | open |
| 11 | P2 | v3.css colors come from tokens.css | `app/styles/v3.css` and `strip-motion.css` hold no copied oklch token values | open |
| 12 | P3 | Color scope wedge visible in light | `components/v3/work.tsx` wedge fill reads a theme variable | open |
| 13 | P3 | Lazy grid covers decode async | `components/v3/work.tsx` `decoding="sync"` only on the first 12 | open |
| 14 | P3 | Prototypes not shipped to every visitor | `V3Canvas` loaded with `dynamic()`; `WorkShell` not built in `portfolio/(index)/layout.tsx` (confirm chunk sizes first) | open |
