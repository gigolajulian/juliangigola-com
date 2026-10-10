# HANDOFF: content thread (jg-CONTENT)

Worktree: `JG WEBSITE CONTENT`, branch `content`, cut from main at fc3ce9b (2026-10-10).
Never commit to main, merge or deploy. jg-RELEASE merges.
`node_modules` here is a junction to the main folder's, for tsx checks. Not a full install.

## Alt text (in progress)
Rules from jg-SEO (2026-10-10): describe only what the frame shows. Credits are appended by
`withAlt` in lib/work.ts. One sentence, 8 to 18 words, at most 125 chars, no trailing period.
Order: subject, styling, light, setting. Frames in one project must differ. Covers and session
galleries live in lib/alt-text.ts (jg-SEO owns it), so skip any src listed there.
Never re-run scripts/harvest.mjs: it wipes the alt fields in work-data.ts.

Method: build a numbered sheet of the frames that still need alt, view it, write a src to
sentence JSON, then apply it with a rule check. Tools live in the session scratchpad
(`sheet.py`, `apply.mjs`). Rebuild them if they're gone, about 30 lines each.
Check: `npx tsx` a script that calls `getProject(slug)` and prints `images[i].alt`.

Rules added since: neutral wording (figure, person, two people), no pronouns or possessives, no
"same", "second", "tighter" or "closer" openers, each string stands alone, no landmark or street names.
Run a regex for woman|women|man|men|girl|boy|she|her|hers|his|him|he|lady|male|female over every alt; expect 0.
Every frame now has alt text. 2026-10-10: rouge to ukiyosunknown (about 570 frames) written this session.
Landed: 58160d7 (#107). Cleared or in review by jg-SEO: 2c7bcaf and 6a380b4 (see jg-SEO notes).
The 85 empty `alt` fields left in lib/work-data.ts are every project's `cover.jpg` object. lib/work.ts
(withLeadFrame, around line 461) fills those from the lead frame, so they stay empty on purpose.
Do not re-run scripts/harvest.mjs: it wipes the hand-written alt.
`content` is pushed to origin. Nothing merged or deployed by this thread. jg-RELEASE lands only hashes jg-SEO has cleared.
Picks: Julian has the 86 cover sheets and has not named any numbers to swap yet.
Baseline was 1229 empty of 1278.

## Picks
No changes until Julian approves a numbered contact sheet.
Note: lost-relic (daylight beach) and abril (clean grey studio) are off the stated taste.
Flag them when we review picks.
