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
| DEV-1 | any | open | | | | | Reuse a running dev server; stop every server you start before ending the turn; nothing left running in worktrees |
| SEC-1 | any | open | | | | | No secrets in the repo or its history (a secret scanner over all commits) |
| SEC-2 | any | open | | | | | Secrets inventory: what each unlocks, its scope, where it's stored, how to rotate it in minutes |
| SEC-3 | any | pass | script | `node scripts/bedrock/lockfile-check.mjs` | .bedrock/breaks/SEC-3.patch | 2026-11-24 | package-lock v3 committed; every CI install is npm ci |
| SEC-4 | any | open | | | | | Known-vulnerable dependencies are flagged automatically, and update proposals arrive on their own (OWASP A03 supply chain) |
| SEC-5 | any | pass | test | `npx vitest run --project backend tests/backend/leads/api-inbox.test.ts` | .bedrock/breaks/SEC-5.patch | 2026-11-24 | admin key, Worker key, manage links and gallery cookies all refuse when their secret is unset (vouch.ts:150, manage-link.ts:25, proof-store.ts:37); Stripe routes 503. Known hole on the money path ranked in the report: a lock error after Google made the event refunds anyway (deposit.ts:233) |
| INP-1 | any | open | | | | | Bad input handled: odd or huge names, broken files, full or missing drive, no network: a clear message, no crash |
| INP-2 | any | open | | | | | User data is written atomically (temp file, then rename), so a crash never corrupts it |
| MEM-1 | any | open | | | | | Memory budget written for a modest device (8-16 GB, integrated graphics): idle and working |
| MEM-2 | api | open | | | | | Measured against the budget: commit and working set, 10 min idle and 10 min in use |
| MEM-3 | any | open | | | | | No unbounded caches: every cache, map or queue has a size or age limit |
| MEM-4 | any | open | | | | | Big files and bodies are streamed, never loaded whole; byte budgets on anything that streams or stores |
| MEM-6 | web | open | | | | | A memory-ceiling regression test in the suite |
| DATA-1 | any | open | | | | | User data is backed up, and a restore has actually been done |
| OPS-8 | api | open | | | | | Data survives a restart: nothing users rely on lives only in memory; processes are stateless or persist state durably |
| DATA-2 | any | open | | | | | Crashes and errors reach the developer (a local log at least; any remote reporting opt-in) |
| REL-1 | any | pass | ci | `node scripts/test/gate.mjs --backend` | .bedrock/breaks/REL-1.patch | 2026-11-24 | ci.yml runs backend, components and frontend on every PR and push to main; the pre-commit hook runs gate.mjs on staged files |
| PLAT-2 | web | open | | | | | High-DPI: 125-200% scaling and 4K render sharp, nothing clipped |
| LIC-1 | any | open | | | | | Own licence chosen; third-party licences compatible and credited |
| SEC-8 | any | open | | | | | Operator accounts (code host, cloud, registrar, email, stores) use 2FA or passkeys; tokens are least-privilege and expire |
| SEC-9 | any | open | | | | | Config lives outside code; development, staging and production are separate; production secrets never on a dev machine's disk in plain text |
| SEC-10 | any | open | | | | | No homemade crypto; random values for tokens and codes come from a cryptographic source |
| NET-1 | any | open | | | | | Every outbound call has a timeout, retries with backoff and jitter, and stops after repeated failures |
| DATA-3 | api | open | | | | | Stored data and schemas are versioned with forward migrations; data from older versions still opens |
| TIME-1 | any | open | | | | | Times stored in UTC, or deliberately local with the reason written down (a camera's local day); time zones, daylight-saving changes and clock skew tested where dates matter |
| DOC-1 | any | open | | | | | A README says how to run, test and release it; big decisions recorded (short decision notes) |
| ABU-1 | api | open | | | | | Every endpoint is limited per address AND per target (account, code, link, email, token) |
| ABU-2 | api | open | | | | | Bursts use a fast limiter; daily caps use durable storage |
| ABU-3 | api | open | test | `npx vitest run --project backend tests/lib/http-limited.test.ts` | .bedrock/breaks/ABU-3.patch | 2026-11-24 | fixed on this branch: the shared 429 now sends Retry-After: 60 (lib/http.ts limited). Clients back off: deposit poll stops after 20 tries, retries are clicks. Pass once merged |
| ABU-4 | api | open | | | | | A block list the owner can edit without a deploy |
| ABU-5 | api, web | open | | | | | A human check on sign-up, reset and public forms, verified on the server |
| ABU-6 | api | open | | | | | Service-wide caps alert the owner instead of refusing every real user |
| ABU-7 | api | open | | | | | Byte budgets per account per day on uploads, exports and anything that streams |
| ABU-8 | api | open | | | | | Codes: wrong tries capped per account, short expiry, growing lock-out |
| ABU-9 | api | open | | | | | One trial per person, tied to a normalised identity (email normalisation, device or licence) |
| ABU-10 | web | open | | | | | Public pages are cached at the edge, so a flood of page loads costs nothing |
| ABU-11 | api | open | | | | | Request bodies are size-capped before they're read |
| ABU-12 | api | open | | | | | An "under attack" runbook: how to block, raise limits and rotate secrets in minutes |
| ABU-13 | any | pass | test | `npx vitest run --project backend tests/lib/leads/actions.test.ts` | .bedrock/breaks/ABU-13.patch | 2026-11-24 | every limit is server-side (rate-limit binding, KV cooldown and daily cap) |
| AUTH-1 | api | open | | | | | Passwords hashed with a slow KDF; passkeys offered |
| AUTH-2 | api | open | | | | | A recent re-check before sensitive actions; sessions revocable; sign out everywhere |
| AUTH-3 | any | open | | | | | Account deletion inside the app removes all personal data |
| AUTHZ-1 | api | open | test | `npx vitest run --project backend tests/backend/booking/api-booking-id.test.ts` | .bedrock/breaks/AUTHZ-1.patch | 2026-11-24 | booking links: one booking's token never opens another (HMAC over id.exp, constant-time verify). gap: no test that gallery A's cookie or token fails on gallery B; old gallery ids MMDDYYYY-NN-xxxx have 4 random chars and no read limit (proof-model.ts:238, app/proof/[token]/page.tsx:45) |
| WEB-1 | api, web | pass | test | `npx vitest run --project backend tests/backend/site/security-headers.test.ts` | .bedrock/breaks/WEB-1.patch | 2026-11-24 | next.config.ts and public/_headers kept identical; default-src/object-src/base-uri/form-action/frame-ancestors locked, no unsafe-eval, HSTS 1 year. Known limit: script-src keeps 'unsafe-inline' (no nonces on a prerendered build), and Permissions-Policy payment=() blocks the Stripe wallet frame (see report) |
| WEB-2 | api | open | | | | | SQL and NoSQL injection: every query parameterised; no string-built queries |
| PRIV-1 | any | open | | | | | No third-party trackers or pixels; any analytics opt-in, numbers only, and disclosed |
| PRIV-2 | any | open | | | | | Logs carry no personal data or secrets |
| PRIV-3 | any | open | | | | | A data retention schedule, and a user can export their data |
| PRIV-4 | any | pass | test | `npx vitest run --project backend tests/backend/leads/api-leads.test.ts` | .bedrock/breaks/PRIV-4.patch | 2026-11-24 | lead, proof, contract and log rows AES-GCM sealed under LEADS_KEY, keys are HMACs (lib/seal.ts) |
| OBS-1 | api, web | open | | | | | Errors alert the developer; an uptime check on public endpoints |
| COST-1 | any | open | | | | | Usage and billing alerts, and hard caps where the provider allows: cloud, AI APIs, email, and CI minutes (macOS runners cost several times more) |
| REL-3 | any | open | | | | | Tests must pass before a merge |
| UX-1 | web | open | | | | | A written design system (colour, type, spacing, components, states) that new UI is checked against |
| UX-2 | web | open | | | | | Contrast 4.5:1 body, 3:1 large text and control edges |
| UX-3 | web | open | | | | | Slow actions answer at once, show the wait, confirm in place; empty, error and offline states written |
| A11Y-1 | web | open | | | | | WCAG 2.2 AA keyboard: everything works by keyboard, focus is visible and never hidden behind sticky bars |
| A11Y-2 | web | open | | | | | Reduced motion respected; nothing flashes more than three times a second |
| RANGE-1 | web | open | | | | | Phones 360-430 px, tablets and desktop: no sideways scroll, inputs don't zoom, 44 px tap targets |
| RANGE-2 | web | open | | | | | Tried on a mid-range Android and an older iPhone (or throttled to match) |
| RANGE-3 | web | open | | | | | Light and dark, slow network and offline all work |
| WEBMEM-1 | web | open | | | | | Page memory budget (about 150 MB JS heap after 10 min); listeners and timers cleaned up; quiet when hidden |
| API-1 | api | open | | | | | Hot queries indexed, no N+1 loops, CPU per request measured |
| I18N-1 | web | open | | | | | Dates, numbers and plurals locale-aware; no text baked into images; long and right-to-left text don't break layout |
| WEB-3 | api, web | open | | | | | Session cookies HttpOnly, Secure and SameSite; CSRF protection on state changes; CORS is an allow-list |
| WEB-4 | api | pass | test | `npx vitest run --project backend tests/lib/leads/inbox.test.ts` | .bedrock/breaks/WEB-4.patch | 2026-11-24 | the only user-named fetch is the contact form's picks: paths of the site's own shape only (enquiry.ts:153); ICS feeds are admin-only |
| WEB-5 | api | pass | test | `npx vitest run --project backend tests/lib/leads/inbox.test.ts` | .bedrock/breaks/WEB-5.patch | 2026-11-24 | contact uploads: JPEG/PNG/HEIC by magic bytes, 6 MB each, 20 MB, 8 files (enquiry.ts:118-147); never decoded on the server |
| WEB-6 | api, web | open | | | | | No open redirects: return URLs are checked against an allow-list |
| WEB-10 | api | pass | test | `npx vitest run --project backend tests/backend/deposit/api-stripe.test.ts` | .bedrock/breaks/WEB-10.patch | 2026-11-24 | HMAC over raw body, constant-time compare, 300 s window (deposit.ts:102); processed once per payment intent (engine.ts:148, deposit.ts:184), refunds deduped (leads.ts:248); event ids are not stored, the intent key does that job |
| JOB-1 | api | open | test | `npx vitest run --project backend tests/backend/deposit/api-deposit.test.ts` | .bedrock/breaks/JOB-1.patch | 2026-11-24 | webhook books once per intent however often Stripe delivers; one Durable Object queues every booking. gap: contact daily counter is read-then-write on KV (enquiry-action.ts:214,291), so concurrent posts pass the cap |
| MAIL-1 | api | open | | | | | Sending domains have SPF, DKIM and DMARC; bounces and complaints stop further mail to that address |
| PERF-1 | web | open | | | | | Core Web Vitals on a throttled mid-range phone (LCP under 2.5 s, INP under 200 ms, CLS under 0.1) and a bundle-size budget |
| AUTH-4 | api | open | | | | | Users can turn on a second factor (passkey or authenticator app); admins must |
| AUTH-5 | api | open | | | | | Sign-up, sign-in and reset don't reveal which emails exist; reset links are single-use and expire; known-breached passwords are refused |
| AUTH-6 | api | open | | | | | Sessions have an idle timeout and an absolute lifetime; a password change ends other sessions |
| AUTHZ-2 | api | pass | test | `npx vitest run --project backend tests/lib/admin/vouch.test.ts` | .bedrock/breaks/AUTHZ-2.patch | 2026-11-24 | one operator; a GitHub token passes only with push on the repo AND a repo scope (classic) or Contents write (fine-grained), vouch.ts:66-80 |
| WEB-7 | web | pass | test | `npx vitest run --project backend tests/lib/leads/inbox.test.ts` | .bedrock/breaks/WEB-7.patch | 2026-11-24 | enquiry and booking mails escape what was typed (enquiry.ts:455, confirm.ts:68); no dangerouslySetInnerHTML with user text |
| LOG-1 | api | open | | | | | Security events are logged and kept (sign-ins, failures, permission and admin changes, exports) without secrets (OWASP A09) |
| A11Y-3 | web | open | | | | | Every control has a name and label; meaningful images have alt text; status messages are announced |
| A11Y-4 | web | open | | | | | A screen-reader pass on the main flows (NVDA, VoiceOver or TalkBack) |
| A11Y-5 | web | open | | | | | Targets at least 24 by 24 px (44 for primary touch); dragging has a non-drag alternative; sign-in allows paste and passkeys |
| OPS-6 | api | open | | | | | Health and readiness endpoints; graceful shutdown finishes or hands back in-flight work |
| DATA-4 | any | open | | | | | Backups are monitored: a failed or missing backup alerts someone |
| REL-10 | any | open | | | | | Tested on every platform it ships to, on every change: each operating system a desktop app is sold for, each browser engine (Chromium, WebKit, Firefox) for a web app, an iOS and Android build for a phone app |
| REL-9 | any | open | | | | | One version and one customer notes file: the version shown in the app, the store and the executable all come from one place, and each release has a plain-language entry (see ops-release.md) |
| REL-7 | any | open | | | | | CI is hardened: least-privilege tokens, actions and images pinned by digest, no secrets in pull-request builds from forks |
| AUTHZ-3 | api | pass | test | `npx vitest run --project backend tests/backend/site/route-walk.test.ts` | .bedrock/breaks/AUTHZ-3.patch | 2026-11-24 | walks every app/api route on disk; 26 gated routes answer 401 to every verb with no key; public and link-opened routes are an explicit list in the test |
| WEB-8 | api | open | | | | | OS command, template, path and deserialisation injection: no shell strings from input, no unsafe loaders (pickle, yaml.load, eval) |
| WEB-9 | api, web | open | | | | | TLS everywhere with HSTS; no plain-HTTP endpoints or mixed content; certificates valid |
| A11Y-6 | web | open | | | | | Forms: labels and instructions, errors identified in text next to the field, and how to fix them (WCAG 3.3.1-3.3.3) |
| A11Y-7 | web | open | | | | | Reflows at 320 px and 200% text without loss; page language set; captions for audio and video |
| OPS-9 | any | open | | | | | Someone owns it: who gets alerts and answers them, and an inventory of the services and dependencies it relies on |
| SEC-11 | any | open | | | | | A short threat model: what's valuable, who'd attack it, the top risks and which checks cover them |
| LEGAL-1 | any | open | | | | | Terms and privacy policy published, and they match what the app actually does |
| LEGAL-2 | any | open | | | | | An age gate suited to the audience |
| LEGAL-3 | api | open | | | | | One-click unsubscribe on every non-account email; no marketing texts without opt-in |
| LEGAL-4 | any | open | | | | | Every marketing claim has proof on file |
| LEGAL-5 | any | open | | | | | A registered copyright (DMCA) agent if it hosts other people's content |
| MONEY-1 | api | open | | | | | Double-buy guard, refunds and paid access ending correctly, all tested |
| MONEY-2 | any | open | | | | | Receipts and sales tax handled by the payment provider |
| SEC-6 | any | open | | | | | An independent security audit run, and its fixes merged (when it takes money or holds sensitive data) |
| SEC-7 | api | open | | | | | One careful load and abuse test against a staging copy, with the owner's OK |
| REL-4 | any | open | | | | | Release and rollback runbook rehearsed; the previous version can be restored in minutes |
| REL-5 | any | open | | | | | A kill switch or feature flag for risky features |
| OPS-1 | any | open | | | | | An incident plan, and a status page or channel users can see |
| OPS-2 | any | open | | | | | A breach notification plan: who is told, how fast |
| OPS-3 | any | open | | | | | Launch alerts (sign-ups, errors, spikes) reach the owner |
| REL-6 | any | open | | | | | Releases are built by CI from a tagged commit with provenance (SLSA level 2 or better), code-signed where installable, with checksums and an SBOM |
| DNS-1 | api, web | open | | | | | Domains: registrar lock, auto-renew, 2FA, DNSSEC, CAA records, and certificate-expiry monitoring |
| SLO-1 | api, web | open | | | | | An availability and latency target written down, with what happens when it's missed |
| OPS-4 | any | open | | | | | An exit plan: the whole system's data can be exported, and backups live outside the main provider |
| SEC-12 | api, web | open | | | | | A security.txt and a vulnerability disclosure policy saying how to report and what happens next |
| OPS-7 | api | open | | | | | Capacity: load tested to a written target, with load shedding or queueing instead of falling over |
| LEGAL-7 | any | open | | | | | EU and UK users: a lawful basis and consent for non-essential cookies and tracking, processing agreements with processors, data requests answered within the deadline |
| REL-8 | api, web | open | | | | | Progressive rollout: changes reach a small share of users first, with automatic or one-step halt |
| SEO-1 | web | open | | | | | Public pages have titles, descriptions, a sitemap and share images; private pages are no-index; nothing private is crawlable |
| OPS-5 | any | open | | | | | Someone else could run it from the runbook: deploy, restore, rotate secrets, answer an incident |
