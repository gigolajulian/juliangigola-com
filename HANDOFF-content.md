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

Done, one commit each: lost-relic, hua, abril + iris (37 frames).
Next, in homepage order: novocaine, paradox, relay, diesel, undisputed, decoy, nyx, serif...
Baseline was 1229 empty of 1278.

## Picks
No changes until Julian approves a numbered contact sheet.
Note: lost-relic (daylight beach) and abril (clean grey studio) are off the stated taste.
Flag them when we review picks.
