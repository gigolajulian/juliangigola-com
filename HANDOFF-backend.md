# HANDOFF: backend (jg-BACKEND)

Worktree: `C:\Users\Julian\Documents\Claude\Projects\JG WEBSITE BACKEND`, branch `backend`, reset to origin/main 941593a on 2026-10-10 (jg-RELEASE asked).
Never commit to main, never merge, never deploy. jg-RELEASE ("jg - RELEASE") merges. Dependency changes go to jg-RELEASE as a note; never commit package.json or package-lock.json.

## Owned files
app/api/ (inbox, traffic, tune, cal), app/admin/, app/book/, lib/booking.ts, lib/booking-slugs.ts, lib/inbox.ts, lib/admin-*.ts, lib/vouch.ts, next.config.ts, open-next.config.ts, wrangler.jsonc, cloudflare-env.d.ts, image-loader.ts, types/cloudflare-secrets.d.ts (Worker secret types).

## Current state (origin/main 941593a, 2026-10-10)
- Enquiries: stored in KV `INBOX`, mailed to hello@ through the `EMAIL` send_email binding from notifications.juliangigola.com. Cooldown and daily cap in `lib/inbox.ts`.
- Admin Traffic tab reads Cloudflare GraphQL via `CF_ANALYTICS_TOKEN`; GSC (`GSC_OAUTH`) and Bing (`BING_API_KEY`) are read in `app/api/traffic/route.ts`, already on main; `traffic` has nothing unmerged.
- Booking: every session books on Cal.com (f70953a); Google Calendar frames removed. Site-styled time picker behind `?picker` (719af15, component owned by jg-UI). Redirects are dashboard rules.
- Plan: Workers Free hit the 100k/day cap once (2026-09-13). OpenNext cache interception stays off.

## Open
- Bookings into the Inbox (2026-10-10, on `backend`): `POST /api/cal` takes Cal.com's signed BOOKING_CREATED webhook and stores it in KV `INBOX` with type "booking" (detail: event · time PT). Not mailed, Cal.com already mails Julian. Needs, before it does anything: (1) `wrangler secret put CAL_WEBHOOK_SECRET` with a long random string, (2) Cal.com > Settings > Developer > Webhooks: subscriber URL https://juliangigola.com/api/cal, trigger Booking Created, same secret. Until then the route answers 503. Not yet tested end to end against Cal.com.
- Inbox/email check (2026-10-10): code path intact, self-check 52/52, prod KV reachable, /api/inbox 401 without auth. Mail delivery to hello@ NOT verified from here (no hello@ mail access). Live test submission waits on Julian's OK.
- KV holds an unread editorial enquiry from 2026-09-28 (looks real) and three 2026-10-08 tests.

## Log
- 2026-10-10: worktree and branch created, reset to origin/main 941593a. No code changes. node_modules not installed yet.
- 2026-10-10: inbox/email path checked read-only, no changes.
- 2026-10-10: Cal.com webhook to Inbox. Checked: mapping + HMAC verify (scratch cal-check.mjs), check-inbox 52/52, tsc clean for touched files. node_modules here is a junction to the main folder's.
