# HANDOFF: jg-QA

Lane: tests/, scripts/perf/, playwright.config.ts, vitest.config.ts, .github/workflows/. Branch `claude/determined-pike-a25369`. Prompts for every lane: `docs/threads.md`.

## Done
- `npm run perf` works on Windows (4d7b88f): npx through a shell, `next start` stopped with `taskkill /T`. `PERF_CHROME=1` runs the chromium project on the installed Chrome.
- Playwright Chromium 1217 and Firefox 1511 reinstalled on this PC (2026-10-10). They failed headed with a side-by-side error tied to their install paths; the VC++ runtime was fine.

## Baseline (2026-10-10, this PC, local build, Chromium + Firefox, no WebKit)
- Motion: 87 passed, 5 failed. Layout and images: 287 passed, 1 failed.
- Chromium notch at desktop-2560 failed once, passed 6/6 on rerun: flaky, not reported.
- Firefox only: splash timeout at laptop-1440 and desktop-1920, swipe worst frame about 450-470 ms (budget 250) at the same sizes, `/model-digitals` layout wait timeout at desktop-1920. Not reported yet: CI never ran Firefox on Windows, so no baseline to compare against.

## Firefox rerun (2026-10-10)
- Motion 42/46, layout and images 144/144. Splash and `/model-digitals` passed: the first run's failures there were flakes.
- Swipe on `/` failed again at laptop-1440, desktop-1920 and desktop-2560 (worst frame 500-617 ms, budget 250, median 16.7). Reported to jg-UI. Chromium worst is 67-100 ms.
- jg-UI traced it: a cold Firefox profile compiling WebRender shaders on the first swipe (page main thread idle). On a warmed persistent profile the worst frame is 117-183 ms, under budget. Not a site bug. Fixed in the test: swipe.spec.ts gives Firefox one untimed pass first. Firefox swipe now 16/16, worst frame 17-67 ms.

## WebKit on Windows (2026-10-10)
- Installed (WebKit 26.4, playwright v2272). Run: motion 17 passed, 15 failed, 14 skipped; layout and images 143/144.
- Not usable for timing or landings here: Playwright's Windows WebKit draws this site at 2-10 frames a second (splash medians 93-618 ms), the timed wheel and touch gestures miss because of it, and 14 tests skip as throttled. Measure WebKit on a Mac or in CI, not on this PC.
- One possibly real number: images `/portfolio/editorial` at ipad-landscape, 853 KB first screen against 840. Unchecked whether that is the Windows WebKit image formats or the page.

## Notes
- Worktrees need their own `npm ci`. A junction to the main checkout's node_modules breaks the Turbopack build.
- WebKit is not installed here (`npx playwright install webkit`).

## Waiting on
- Nothing. Next: a check request from jg-RELEASE.
