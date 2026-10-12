# HANDOFF: jg-QA

Lane: tests/, scripts/perf/, playwright.config.ts, vitest.config.ts, .github/workflows/. Branch `claude/determined-pike-a25369`. Prompts for every lane: `docs/threads.md`.

## Standing rule (Julian, relayed by jg-BACKEND 2026-10-10)
Every branch handed to jg-RELEASE gets checked by jg-QA before it merges:
- UI changes: screenshot the changed feature at phone portrait and landscape, iPad portrait and landscape, laptop 16:10 and wide 21:9 (the /screens skill), in Chromium, Firefox and WebKit, GPU on. Send what breaks to the owning thread and jg-RELEASE, and send Julian a numbered contact sheet.
- Backend-only changes (API routes, KV): a request-level check, no screenshots.
- WebKit on this PC renders layout fine but its motion and frame numbers are unusable. Layout and screenshots only.

## Test suites and the commit gate (Julian, 2026-10-11)
No code is committed until its suite passes. `node scripts/test/gate.mjs` routes the staged files. The pre-commit hook `.githooks/pre-commit` runs it once git points at it (`git config core.hooksPath .githooks`). That switch is Julian's call: package.json stays out of commits, so there is no `prepare` script.
- back-end files only: the backend suite (`--backend`), a few seconds. That is `tests/backend` (Vitest, request-level: /api/cal, /api/inbox, /api/traffic, /api/tune, /picks.json, the contact action, book/worker.js, with fake KV and email, no real mail) plus `scripts/check-*.mjs`.
- front-end files only: the frontend suite (`--frontend`), about 20-30 minutes. Types, lint, the `lib` unit tests, a production build, then `tests/ui` (pages load clean, the /book picker, the booking menu, the booking pages, at the 6 ratios plus 1280x720) and the perf suite's layout and images, all in Chromium and Firefox. Flakes get one retry and are listed as flaky; all seen so far were Firefox.
- both kinds of file: both suites. Notes, docs, contact sheets and CI files run nothing.
- `--dry` prints the route, `--base main` checks a whole branch, `--all` runs both. CI runs both suites on every pull request.
- Never commit with `--no-verify`. A failing suite goes to the owning thread.
- `api-other.test.ts` "offers only frames the contact form will keep" passes since #119 (picks fix); `.fails` is off.

## Split with jg-MAC (Julian, relayed by jg-BACKEND 2026-10-11)
- jg-QA keeps Chromium and Firefox, layout at the 6 ratios, and the final pass/fail to jg-RELEASE. Windows WebKit stays a layout smoke test only.
- jg-MAC owns real macOS Safari, iOS and iPad Simulators (current, previous, oldest supported), Web Inspector on real devices, and Safari motion, touch and scroll feel. Its notes are in HANDOFF-mac.md in its clone.
- Gate: anything visible needs both results. Collect jg-MAC's before reporting to jg-RELEASE. If jg-MAC can't be reached (ListAgents, or Julian relays; the Mac is often off), report the branch as "Safari unverified" and Julian decides. Backend-only changes skip the Mac.

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

## Live site, Windows (2026-10-10)
- Notch and layout against https://juliangigola.com, installed Chrome (PERF_CHROME=1) and Firefox: 155/156.
- The one miss: Firefox notch pixels at 2560, a notch that did not turn. Rerun 4x in both browsers: 16/16. Chromium missed once at 2560 locally too. Rare 2560 notch miss, about 1 in 20 runs. Watching, not reported.
- Julian's part is now only the iPad recording (docs/device-check.md).

## Notes
- Worktrees need their own `npm ci`. A junction to the main checkout's node_modules breaks the Turbopack build.
- WebKit is not installed here (`npx playwright install webkit`).

## Waiting on
- PR #120 (sessions-title, f300770, ?bookhere card): on hold, not tested. Julian said "stop testing until we lock in the design" (2026-10-11), and jg-UI still has an uncommitted design tweak in progress. Test when Julian locks the design. Mock api.cal.com/v2/bookings and use the `company` honeypot.
- PR #114 (calendar-lower, jg-UI): a10b09f PASS, sent to RELEASE 2026-10-11. /book 144/144, service pages 36/36 (service-check.cjs), Cal.com hang and 500 fall back to the embed. Julian approved the 80% zoom look ("go with A"); the floor under the zoom is 19 screen px. The merge waits on Julian's ship it.
- ios-16-4 (a978b78, browserslist to Safari/iOS >= 16.4): FAIL sent to RELEASE 2026-10-11. Firefox motion timeouts were 12/138 across 3 runs on the branch against 0/138 on main aaa1256, both production builds in the same worktree. No JS errors anywhere. I offered to bisect.
- PR #117 (book-here, 1748e8c): PASS sent to RELEASE 2026-10-11 (/book 144/144, menu 28/28, /portraits deck end 16/16, unflagged homepage identical to live). WebKit dev hydration mismatch (data-strip-tab) reported to UI as an FYI. Scratchpad scripts are bookhere-check.cjs (/?bookhere#sessions), deck-end-check.cjs (/portraits stays on Book) and home-same.cjs (unflagged / matches live; Chrome 3/3 same).
- PR #118 (book-here-audit, jg-UI): c99c07a PASS sent to RELEASE 2026-10-11, with Windows and jg-MAC results. 2006875 had failed on Week/Month sliding under "Close ×" on phones (close-overlap.cjs). Real iOS is untested: the Mac needs CoreSimulator (sudo xcodebuild -runFirstLaunch from Julian).
- Windows WebKit: the "element is not stable" click timeouts on picker days are the hover lift never settling at its frame rate. Not a site bug.
- Test from a frozen copy: `git worktree add` on the head commit, `npm ci`, run there on its own port. UI edits CAL live, and :3220 hot-reloads mid-run. The scratchpad picker-check.cjs now checks the card and Confirm against the footer top, and counts label lines from text rects, which is zoom-safe.
