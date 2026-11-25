# Baseline: juliangigola-com

App: juliangigola-com
Stage: 3
Parts: api, web
Features: accounts, email, payments, uploads, url-fetch, user-content, webhooks
Checklist version: 2026.11.20.5
Level: full
Gate answer: build
Gate asked: 2026-11-24
Next ask after: 
Manual expiry days: 180
Stage override:
Parts override:
Features override:

Detected: a Cloudflare Worker (book\wrangler.jsonc); public terms or privacy pages (components\site\legal.tsx); a web app (next.config.ts); a project with dependencies (package.json); has web pages (public\client\prdx-preview\index.html); a web server or API (app\admin\leads\sw.js\route.ts); takes payments (lib\stripe.ts)


| ID | Part | Status | Proof | Evidence | Break | Checked | Notes |
|---|---|---|---|---|---|---|---|
| DEV-1 | any | open |  |  |  |  | gap: no hook stops servers started in worktrees; THREADS.md asks for it in words only |
| SEC-1 | any | open |  |  |  |  | gap: no scanner in CI or on this PC (gitleaks absent). A regex sweep for sk_live/rk_live/whsec_/ghp_/github_pat_/AIza/private keys over the tree and all history found 0 (2026-11-24). Repo is public; GitHub secret scanning and push protection are on; measure: gitleaks git --no-banner --redact |
| SEC-2 | any | open |  |  |  |  | gap: .env.example names 15 variables; nothing says what each unlocks or how to rotate it (INBOX_KEY, LEADS_KEY, BOOKING_SECRET, WORKER_KEY, STRIPE_*, GCAL_OAUTH) |
| SEC-3 | any | pass | script | `node scripts/bedrock/lockfile-check.mjs` | .bedrock/breaks/SEC-3.patch | 2026-11-24 | package-lock v3 committed; every CI install is npm ci |
| SEC-4 | any | open |  | `npm audit --omit=dev` |  |  | covered, not proven: .github/dependabot.yml weekly npm, monthly actions; security updates off on purpose. npm audit --omit=dev: 0 critical, 0 high, 3 moderate (2026-11-24) |
| SEC-5 | any | pass | test | `npx vitest run --project backend tests/backend/leads/api-inbox.test.ts` | .bedrock/breaks/SEC-5.patch | 2026-11-24 | admin key, Worker key, manage links and gallery cookies all refuse when their secret is unset (vouch.ts:150, manage-link.ts:25, proof-store.ts:37); Stripe routes 503. Known hole on the money path ranked in the report: a lock error after Google made the event refunds anyway (deposit.ts:233) |
| INP-1 | any | open |  |  |  |  | gap: contact strips control characters (actions.test 'keeps a header out of the name'); booking cap() only trims, so a newline in a booking name reaches the mail's to-name and alert subject (engine.ts:70, book/route.ts:48). Effect on the email binding not measured |
| INP-2 | any | open |  |  |  |  | gap: lead writes are read-change-write on KV (lead-store.ts:159, activity-log.ts:46); a deposit writes the same lead twice in a row (deposit.ts:169-170) and recordLead swallows a failed write (lead-store.ts:185). No lost line seen in production; the test KV is a Map, so untested |
| MEM-1 | any | open |  |  |  |  | person: write the budget (Worker isolate 128 MB; page heap target) |
| MEM-2 | api | open |  |  |  |  | slow, not run: the 10 min idle and in-use measure needs wrangler dev or staging |
| MEM-3 | any | open |  |  |  |  | gap: the proof viewers map has no key cap (proof-model.ts:182), so one gallery token can add unbounded viewers and leads. The Google token cache is one entry; measure: git grep -n viewers -- lib/proofs/proof-model.ts |
| MEM-4 | any | open |  |  |  |  | gap: request bodies are read whole (lib/http.ts bodyOf, beacon text()); delivery downloads are streamed (lib/proofs/delivery-serve.ts) |
| MEM-6 | web | open |  |  |  |  | gap: no memory-ceiling test |
| DATA-1 | any | open |  |  |  |  | person: leads copy one way to the Google Sheet every 10 min (sheet-sync.ts) and to Notion; booking records live in the Durable Object and the calendar only. No restore has ever been done |
| OPS-8 | api | open |  | `npx vitest run --project backend tests/backend/booking/own-booking.test.ts` |  |  | covered, not proven: only a Google token cache and the lock queue are in memory; everything else is KV, DO storage, Stripe metadata or Calendar |
| DATA-2 | any | open |  |  |  |  | gap: Workers observability logs only; nothing sends errors to Julian |
| REL-1 | any | pass | ci | `node scripts/test/gate.mjs --backend` | .bedrock/breaks/REL-1.patch | 2026-11-24 | ci.yml runs backend, components and frontend on every PR and push to main; the pre-commit hook runs gate.mjs on staged files |
| PLAT-2 | web | open |  |  |  |  | person: look at 125-200% scaling and 4K |
| LIC-1 | any | open |  |  |  |  | gap: public repo with no LICENSE; self-hosted fonts in app/fonts (Univers 57, OPTIUnivers 67, Endless) have no licence files on record |
| SEC-8 | any | open |  |  |  |  | person: confirm 2FA on GitHub, Cloudflare, Google Workspace, Stripe and the registrar; the admin GitHub token should be fine-grained with an expiry |
| SEC-9 | any | open |  | `git ls-files .dev.vars .env .env.local` |  |  | covered, not proven: wrangler.jsonc holds bindings only; .dev.vars and .env* ignored; the committed .env.production holds one public flag |
| SEC-10 | any | open |  | `git grep -n Math.random -- lib app worker` |  |  | covered, not proven: tokens, ids, salts and IVs from crypto.getRandomValues (lib/token.ts:12, proof-model.ts:223,249, seal.ts:91); one Math.random makes a CRM row id, not a secret (lead-crm.ts:122) |
| NET-1 | any | open |  |  |  |  | gap: no timeout on Stripe (lib/stripe.ts:14), Sheets (sheet-sync.ts:49,60) or the lock call (engine.ts:355); Google 8 s, Notion 4 s; no backoff anywhere; measure: git grep -n AbortSignal.timeout -- lib |
| DATA-3 | api | open |  |  |  |  | gap: booking records default missing fields (engine.ts:39-56, deposit-per-session.test); leads carry no version, and one unreadable lead stops everyLead, the export and the Sheet copy (lead-store.ts:24) |
| TIME-1 | any | open |  | `npx vitest run --project backend tests/backend/booking/slots.test.ts -t "daylight"` |  |  | covered, not proven: stored as UTC ISO, Pacific fixed; slots.test 'follows the clocks across daylight time' covers spring forward only, no fall-back test |
| DOC-1 | any | open |  |  |  |  | person: the README covers run, hosting and release; README.md:29 wrongly says CI runs typecheck, lint, build and perf on every PR (that job is manual) |
| ABU-1 | api | open |  |  |  |  | gap: 5/min per IP per colo on book, deposit, refs and gallery unlock; nothing per target. GET /api/slots has no limit, and &fresh or a new timeZone skips its cache (slots/route.ts:43). GET /api/deposit/[id] calls Stripe on every hit with no limit. Proof PATCH and track are unlimited; measure: git grep -n "limited(" -- app/api |
| ABU-2 | api | open |  |  |  |  | gap: the rate-limit binding is the only burst limit, and nothing durable caps a day except contact's KV counter |
| ABU-3 | api | pass | test | `npx vitest run --project backend tests/lib/http-limited.test.ts` | .bedrock/breaks/ABU-3.patch | 2026-11-24 | the shared 429 sends Retry-After: 60 (lib/http.ts limited, added on this branch); clients back off: the deposit poll stops after 20 tries, and retries are clicks |
| ABU-4 | api | open |  |  |  |  | gap: no block list; blocking means a deploy or a Cloudflare WAF rule |
| ABU-5 | api, web | open |  |  |  |  | gap: no Turnstile; contact has a honeypot only (enquiry-action.ts:94); free calls on /api/book have none; measure: git grep -n -i turnstile |
| ABU-6 | api | open |  |  |  |  | gap: contact refuses everyone at 200 a day instead of alerting; the counter is racy (see JOB-1) |
| ABU-7 | api | open |  |  |  |  | gap: uploads are capped per enquiry (6/20 MB, 8 files) but there is no per-day byte budget |
| ABU-8 | api | open |  |  |  |  | gap: the gallery password limit is per IP only (5/min), with no per-gallery cap or lock-out; x-admin-key has no rate limit |
| ABU-9 | api | open |  |  |  |  | gap (measured in code): a free call on /api/book takes any email and mails it from book@ with the caller's own name and Where text (engine.ts:88-98, confirm.ts:105), plus a calendar invite; nothing limits per address; measure: npx vitest run --project backend tests/backend/booking/own-booking.test.ts |
| ABU-10 | web | open |  |  |  |  | gap: prerendered pages come from ASSETS, but every HTML GET still runs the Worker (Workers Caching off since #186) |
| ABU-11 | api | open |  |  |  |  | gap: bodyOf reads request.json() whole before any check (lib/http.ts), ahead of the token gate on /api/booking/[id] and /api/proof/[token]; server actions allow 24 MB (next.config.ts:340); measure: git grep -n "request.json()" -- lib/http.ts |
| ABU-12 | api | open |  |  |  |  | person: no runbook for blocking, raising limits and rotating secrets |
| ABU-13 | any | pass | test | `npx vitest run --project backend tests/lib/leads/actions.test.ts` | .bedrock/breaks/ABU-13.patch | 2026-11-24 | every limit is server-side (rate-limit binding, KV cooldown and daily cap) |
| AUTH-1 | api | n/a |  |  |  |  | no passwords: one operator signs in with a GitHub token; clients use signed links. Gallery passwords use PBKDF2 100k |
| AUTH-2 | api | open |  |  |  |  | gap: a revoked GitHub token still works up to 5 min (vouch cache, vouch.ts:56); INBOX_KEY is a static master key with no rotation path |
| AUTH-3 | any | n/a |  |  |  |  | no user accounts; deletion is by request (privacy page) |
| AUTHZ-1 | api | open | test | `npx vitest run --project backend tests/backend/booking/api-booking-id.test.ts` | .bedrock/breaks/AUTHZ-1.patch | 2026-11-24 | booking links: one booking's token never opens another (HMAC over id.exp, constant-time verify). gap: no test that gallery A's cookie or token fails on gallery B; old gallery ids MMDDYYYY-NN-xxxx have 4 random chars and no read limit (proof-model.ts:238, app/proof/[token]/page.tsx:45) |
| WEB-1 | api, web | pass | test | `npx vitest run --project backend tests/backend/site/security-headers.test.ts` | .bedrock/breaks/WEB-1.patch | 2026-11-24 | next.config.ts and public/_headers kept identical; default-src, object-src, base-uri, form-action and frame-ancestors locked, no unsafe-eval, HSTS 1 year. Known limit: script-src keeps 'unsafe-inline' (no nonces on a prerendered build). payment=() blocked the Stripe wallet frame: fixed in PR #1500 |
| WEB-2 | api | n/a |  |  |  |  | no SQL or D1: KV and Durable Object storage only (grep prepare/exec: none) |
| PRIV-1 | any | open |  |  |  |  | person: live / has no gtag, GTM, Plausible, PostHog or Cloudflare beacon (2026-11-24); /api/beacon keeps path, click label, device class and scroll, no IP or UA, and the privacy page says so; measure: curl -s https://juliangigola.com/ |
| PRIV-2 | any | open |  |  |  |  | gap: upstream error text is logged and can echo an address (lib/stripe.ts:28, notion-lead.ts:113,146, deposit.ts:235) |
| PRIV-3 | any | open |  |  |  |  | gap: the policy promises 7 years and export on request; nothing purges old rows and there is no export beyond the desk CSV |
| PRIV-4 | any | pass | test | `npx vitest run --project backend tests/backend/leads/api-leads.test.ts` | .bedrock/breaks/PRIV-4.patch | 2026-11-24 | lead, proof, contract and log rows AES-GCM sealed under LEADS_KEY, keys are HMACs (lib/seal.ts) |
| OBS-1 | api, web | open |  |  |  |  | gap: no error alerts and no uptime check; a broken deposit flow stays silent until someone looks; measure: git grep -n -i sentry |
| COST-1 | any | open |  |  |  |  | person: set Cloudflare billing and usage alerts (the 2026-09-13 error 1027 cap), plus Stripe and Google quota alerts |
| REL-3 | any | open |  |  |  |  | gap: main requires backend and frontend but not components, admins can bypass, and next has no protection at all; measure: gh api repos/gigolajulian/juliangigola-com/branches/next/protection |
| UX-1 | web | open |  | `npx vitest run --project components` |  |  | covered, not proven: DESIGN.md is the design system (locked 2026-10-23) |
| UX-2 | web | open |  | `node scripts/perf/run.mjs --ui --rebuild` |  |  | covered, not proven: Lighthouse mobile accessibility 100 on / (contrast passed, 2026-11-24); the dim cover captions are intentional |
| UX-3 | web | open |  | `npx vitest run --project components tests/components/booking` |  |  | covered, not proven: booking and contact show waits and errors in place (tests/components/booking/*) |
| A11Y-1 | web | open |  | `node scripts/perf/run.mjs --ui --rebuild` |  |  | covered, not proven: Lighthouse a11y 100 on /; keyboard paths in tests/ui; no full keyboard walk of booking and the desk |
| A11Y-2 | web | open |  | `node scripts/perf/run.mjs --ui --rebuild` |  |  | covered, not proven: prefers-reduced-motion handled across components (122 uses) |
| RANGE-1 | web | open |  | `node scripts/perf/run.mjs --ui --rebuild` |  |  | covered, not proven: tests/ui runs six ratios in Chromium and Firefox in CI on every PR into next |
| RANGE-2 | web | open |  |  |  |  | person: a mid-range Android and an older iPhone |
| RANGE-3 | web | open |  | `node scripts/perf/run.mjs --ui --rebuild` |  |  | covered, not proven: the theme follows the system; the booking picker offline state is not checked |
| WEBMEM-1 | web | open |  |  |  |  | slow, not run |
| API-1 | api | open |  |  |  |  | gap: no CPU-per-request numbers; slots asks Google free/busy on every uncached request |
| I18N-1 | web | n/a |  |  |  |  | English-only site for Bay Area clients; dates use Intl in the visitor's time zone |
| WEB-3 | api, web | open |  |  |  |  | covered in part: the gallery cookie is HttpOnly; Secure; SameSite=Lax (proof/[token]/route.ts:46), but only HttpOnly is asserted; admin uses headers, not cookies, so no CSRF; no CORS headers anywhere; measure: npx vitest run --project backend tests/backend/proofs/gallery-online.test.ts |
| WEB-4 | api | pass | test | `npx vitest run --project backend tests/lib/leads/inbox.test.ts -t "picks of the site"` | .bedrock/breaks/WEB-4.patch | 2026-11-24 | the only user-named fetch is the contact form's picks: paths of the site's own shape only (enquiry.ts:153); ICS feeds are admin-only |
| WEB-5 | api | pass | test | `npx vitest run --project backend tests/lib/leads/inbox.test.ts -t "first bytes"` | .bedrock/breaks/WEB-5.patch | 2026-11-24 | contact uploads: JPEG/PNG/HEIC by magic bytes, 6 MB each, 20 MB, 8 files (enquiry.ts:118-147); never decoded on the server |
| WEB-6 | api, web | n/a |  |  |  |  | no user-supplied return URLs: redirects go to fixed paths or a validated token (proof/[token]/page.tsx:48) |
| WEB-10 | api | pass | test | `npx vitest run --project backend tests/backend/deposit/api-stripe.test.ts` | .bedrock/breaks/WEB-10.patch | 2026-11-24 | HMAC over raw body, constant-time compare, 300 s window (deposit.ts:102); processed once per payment intent (engine.ts:148, deposit.ts:184), refunds deduped (leads.ts:248); event ids are not stored, the intent key does that job |
| JOB-1 | api | open | test | `npx vitest run --project backend tests/backend/deposit/api-deposit.test.ts` | .bedrock/breaks/JOB-1.patch | 2026-11-24 | webhook books once per intent however often Stripe delivers; one Durable Object queues every booking. gap: contact daily counter is read-then-write on KV (enquiry-action.ts:214,291), so concurrent posts pass the cap |
| MAIL-1 | api | open |  |  |  |  | gap: apex SPF, Google DKIM and DMARC p=quarantine; notifications. DMARC p=reject; the apex DMARC rua points at an old GoDaddy host (onsecureserver.net); no bounce or complaint handling; measure: nslookup -type=TXT _dmarc.juliangigola.com |
| PERF-1 | web | open |  |  |  |  | gap (measured): home on Slow 4G with 4x CPU at 390 px: LCP 4.48 s (TTFB 564 ms, image load 2.65 s), CLS 0.00 (chrome-devtools trace, 2026-11-24); budget 2.5 s. The splash timing is Julian's pick; measure: node scripts/perf/run.mjs |
| AUTH-4 | api | open |  |  |  |  | gap: 2FA rides on the GitHub account behind the token; the static INBOX_KEY bypasses it |
| AUTH-5 | api | n/a |  |  |  |  | no sign-up, sign-in or reset |
| AUTH-6 | api | open |  |  |  |  | gap: the operator token sits in localStorage with no idle timeout; its lifetime is the GitHub token's own expiry |
| AUTHZ-2 | api | pass | test | `npx vitest run --project backend tests/lib/admin/vouch.test.ts` | .bedrock/breaks/AUTHZ-2.patch | 2026-11-24 | one operator; a GitHub token passes only with push on the repo AND a repo scope (classic) or Contents write (fine-grained), vouch.ts:66-80 |
| WEB-7 | web | pass | test | `npx vitest run --project backend tests/lib/leads/inbox.test.ts -t "escaped HTML body"` | .bedrock/breaks/WEB-7.patch | 2026-11-24 | enquiry and booking mails escape what was typed (enquiry.ts:455, confirm.ts:68); no dangerouslySetInnerHTML with user text |
| LOG-1 | api | open |  |  |  |  | gap: no log of auth failures or admin writes (refuseAdmin answers 401 silently, vouch.ts:178); measure: git grep -n "console" -- lib/admin/vouch.ts |
| A11Y-3 | web | open |  | `npx vitest run --project components tests/components/booking` |  |  | covered, not proven: labels with htmlFor, aria-invalid and aria-describedby on contact; booking picker label tests |
| A11Y-4 | web | open |  |  |  |  | person: a VoiceOver pass on booking and contact |
| A11Y-5 | web | open |  | `node scripts/perf/run.mjs --ui --rebuild` |  |  | covered, not proven: Lighthouse target-size passed on / |
| OPS-6 | api | n/a |  |  |  |  | serverless Workers: no long-running process to shut down; /api/build reports the live commit |
| DATA-4 | any | open |  |  |  |  | gap: a failed Sheet or Notion copy only logs; nothing alerts |
| REL-10 | any | open |  | `node scripts/perf/run.mjs --ui --rebuild` |  |  | covered, not proven: Chromium and Firefox in CI, WebKit by hand on the Mac (JG - MAC) |
| REL-9 | any | open |  |  |  |  | gap: tags run to v3.0.397, package.json says 0.1.0, /api/build reports only the sha |
| REL-7 | any | pass | script | `node scripts/bedrock/ci-check.mjs` | .bedrock/breaks/REL-7.patch | 2026-11-24 | ci.yml runs with permissions: contents: read and every action pinned to a commit SHA (this branch); Dependabot bumps them monthly |
| AUTHZ-3 | api | pass | test | `npx vitest run --project backend tests/backend/site/route-walk.test.ts` | .bedrock/breaks/AUTHZ-3.patch | 2026-11-24 | walks every app/api route on disk; 26 gated routes answer 401 to every verb with no key; public and link-opened routes are an explicit list in the test |
| WEB-8 | api | n/a |  |  |  |  | no eval, new Function, shell or unsafe loader in server code (grep, 2026-11-24) |
| WEB-9 | api, web | open |  | `npx vitest run --project backend tests/backend/site/security-headers.test.ts -t "HTTPS"` |  |  | covered, not proven: HSTS 1 year with includeSubDomains (asserted by the WEB-1 test); http and www 301 to the https apex; no preload by choice |
| A11Y-6 | web | open |  | `npx vitest run --project components` |  |  | covered, not proven: contact errors are text next to the field (aria-describedby) |
| A11Y-7 | web | open |  | `node scripts/perf/run.mjs --ui --rebuild` |  |  | covered, not proven: <html lang=en> live; 320 px reflow not measured |
| OPS-9 | any | open |  |  |  |  | person: Julian owns alerts; no written inventory of services (Cloudflare, Google, Stripe, Notion, GitHub) |
| SEC-11 | any | open |  |  |  |  | gap: no written threat model. Valuable: the leads (sealed), the admin token (publishes the site), deposits, the calendar |
| LEGAL-1 | any | open |  |  |  |  | person: the privacy page names Cloudflare, Google, Stripe, Notion and GitHub, matching the code; not disclosed: Google Fonts loaded by mails and the Stripe card fields, and the proof galleries and deliveries |
| LEGAL-2 | any | n/a |  |  |  |  | the policy says not for under-16s; no accounts |
| LEGAL-3 | api | n/a |  |  |  |  | every mail is transactional (confirmations, reminders, galleries); the weekly mail goes to hello@ only |
| LEGAL-4 | any | open |  |  |  |  | person: claims on the site (clients, publications) have proof on file |
| LEGAL-5 | any | n/a |  |  |  |  | hosts only Julian's own work; client uploads are private references, never published |
| MONEY-1 | api | open |  |  |  |  | deposits covered: a second payer for one slot is refunded automatically (deposit.ts:256, api-deposit.test 'refunds when the time went while they paid'). gap: a lock or Google error after the booking landed refunds the client while the calendar event or record stays (deposit.ts:233). gap, galleries: paidFor counts a refunded checkout as paid (lib/proofs/submit.ts:114); measure: npx vitest run --project backend tests/backend/deposit/api-deposit.test.ts -t "refunds when the time went" |
| MONEY-2 | any | open |  |  |  |  | person: Stripe sends receipts (receipt_email, deposit.ts:80); no Stripe Tax; invoice tax is typed by hand |
| SEC-6 | any | open |  |  |  |  | person: security audit run-1 on 2026-10-25 (6 leads); its token-scope finding is fixed, two leads are still true (free-call mail, refunded gallery checkout). Not independent |
| SEC-7 | api | open |  |  |  |  | person: needs a staging copy and Julian's OK |
| REL-4 | any | open |  |  |  |  | person: no rollback runbook (wrangler rollback, versions list); scripts/live-check.mjs runs after deploys |
| REL-5 | any | open |  | `npx vitest run --project frontend` |  |  | covered, not proven: lib/flags and ?flags gate risky features |
| OPS-1 | any | open |  |  |  |  | person: no incident plan or status channel |
| OPS-2 | any | open |  |  |  |  | person: no breach notification plan (leads hold names, emails and messages) |
| OPS-3 | any | open |  |  |  |  | covered in part: every booking, deposit and enquiry mails hello@; no error or spike alerts; measure: npx vitest run --project backend tests/backend/booking/own-booking.test.ts |
| REL-6 | any | n/a |  |  |  |  | nothing installable ships; Cloudflare Workers Builds deploys from main |
| DNS-1 | api, web | open |  |  |  |  | gap (measured with dig, 2026-11-24): no CAA records, DNSSEC off (no DS or DNSKEY); measure: nslookup -type=CAA juliangigola.com |
| SLO-1 | api, web | open |  |  |  |  | person: no written availability or latency target |
| OPS-4 | any | open |  |  |  |  | person: leads export as CSV from the desk and copy to the Sheet; booking records have no export |
| SEC-12 | api, web | open |  |  |  |  | gap: /.well-known/security.txt is 404; measure: curl -s -o /dev/null -w %{http_code} https://juliangigola.com/.well-known/security.txt |
| OPS-7 | api | open |  |  |  |  | slow, not run: needs staging and Julian's OK |
| LEGAL-7 | any | open |  |  |  |  | person: no cookies set on / (2026-11-24); YouTube via nocookie; Stripe loads only at the payment step |
| REL-8 | api, web | open |  |  |  |  | gap: every deploy goes to 100% at once |
| SEO-1 | web | open |  | `npx vitest run --project backend tests/backend/site/robots.test.ts` |  |  | covered, not proven: robots.test 'keeps /admin out of the index'; the site-private-pages component test covers noindex on admin, booking, proof, contract and delivery; Lighthouse SEO 100 on / |
| OPS-5 | any | open |  |  |  |  | person: no runbook someone else could follow |
