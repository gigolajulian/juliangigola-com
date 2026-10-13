# HANDOFF: jg-QA

Start with "read THREADS.md and HANDOFF-qa.md". Reference (ratios, suites, scripts, known artifacts): [qa-reference.md](qa-reference.md).

## Where the work lives
- Lane: tests/, scripts/perf/, scripts/test/, playwright configs, vitest.config.ts, .github/workflows/.
- Worktree `.claude/worktrees/determined-pike-a25369`, branch `ci-perf-manual` (#127 merged; branch off main for the next lane change).
- Frozen copy for PR tests: `C:/Users/Julian/AppData/Local/Temp/qa-1752e00`. `git fetch origin pull/N/head`, checkout the head detached. Prod: `JG_LOCAL=1 npx next build` + launch config `qa-prod` (:3240). Hydration warnings need `next dev`: launch config `qa-frozen` (:3230).
- `/qa-pr N` skill (`~/.claude/skills/qa-pr`): light-check loop, `shots.cjs` (7 sizes, --path/--click/--theme) + `sheet.py`. Commit guard `~/.claude/hooks/jg-commit-guard.py`.

## State
- #134 (phone-landscape) 92976ac: QA PASS 10-13, sent to RELEASE. The 0b25f4b overlap is fixed. Safari unverified.
- Merged 10-13: #131 (site bugs), #132 (markup 8–15), #133 (grid switch lag, bug 7), all QA PASS. Julian OK'd the tap-to-open booking card on iPad.
- Markup bug 6 (iPad scroll lag on /portfolio) is with UI, waiting on Julian's iPad recording.
- Markup tool: `node scripts/test/markup.cjs` (uncommitted): one size per window, shot + draw, writes `qa-marks/` (ignore the 2 "selftest" rows). QA routes each mark to its thread.
- #129 needs admin.juliangigola.com set up on Cloudflare (BACKEND). Hook on: `core.hooksPath=.githooks`.

## Decided
- Normal PR: design screenshots at the 6 ratios, a numbered contact sheet to Julian, then pass. Nothing more. Full suite only for a big new feature or when Julian asks (THREADS.md "Testing and merging").
- No testing while a design is in flux; wait for Julian's lock.
- Visible changes need jg-MAC's Safari result, or report "Safari unverified".
- Backend-only changes: request-level check, no screenshots.
- budgets.json changes need Julian's OK.
- Julian 10-13: each markup fix applies at every size where it happens, not only the size he marked.
- QA never relays "ship": Julian says it in the RELEASE chat himself.

## Open
- Tablet 44px rows in the booking menu: Julian's call (phones only now; tablets 29-33px).
- Julian: the iPad recording (docs/device-check.md), and `sudo xcodebuild -runFirstLaunch` on the Mac.
- `HANDOFF-qa.md` is committed in #127 and was in #122, against THREADS.md's no-commit rule. Untracking it is Julian's call.

## Rules that bit this thread
- Test a frozen copy, never a live worktree another thread edits.
- `TaskStop` on `next start` can leave the server running. Check `netstat` and `taskkill /T` by PID.
- Measure inside `[inert]`/`aria-hidden` exclusions, or closed rows count as overflow.
- Never `--no-verify`. package.json stays out of commits.
- Grid view is a click: `--click 'button[aria-label="Grid view"]'` (fails below 768, expected). A shot 1.8 s after the switch can catch the view-transition snapshot (wordmark missing); wait 3.5 s.
- "Up next" is on /portfolio/<slug> only. All-grid hashes are short ("events"); the scroller is the widest div.
- The browser pane renders 177px wide when hidden; measure layout in Playwright instead.
- Never submit the contact form or a real booking: mock api.cal.com/v2/bookings, use the `company` honeypot.
