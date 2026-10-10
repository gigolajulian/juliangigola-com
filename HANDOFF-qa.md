# HANDOFF: jg-QA

Lane: tests/, scripts/perf/, playwright.config.ts, vitest.config.ts, .github/workflows/. Branch `claude/determined-pike-a25369`. Prompts for every lane: `docs/threads.md`.

## Done
- `npm run perf` works on Windows (4d7b88f): npx through a shell, `next start` stopped with `taskkill /T`. `PERF_CHROME=1` runs the chromium project on the installed Chrome.
- Playwright Chromium 1217 and Firefox 1511 reinstalled on this PC (2026-10-10). They failed headed with a side-by-side error tied to their install paths; the VC++ runtime was fine.

## Baseline (2026-10-10, this PC, local build, Chromium + Firefox, no WebKit)
- Motion: 87 passed, 5 failed. Layout and images: 287 passed, 1 failed.
- Chromium notch at desktop-2560 failed once, passed 6/6 on rerun: flaky, not reported.
- Firefox only: splash timeout at laptop-1440 and desktop-1920, swipe worst frame about 450-470 ms (budget 250) at the same sizes, `/model-digitals` layout wait timeout at desktop-1920. Not reported yet: CI never ran Firefox on Windows, so no baseline to compare against.

## Notes
- Worktrees need their own `npm ci`. A junction to the main checkout's node_modules breaks the Turbopack build.
- WebKit is not installed here (`npx playwright install webkit`).

## Waiting on
- Nothing. Next: a check request from jg-RELEASE.
