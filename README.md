# juliangigola.com

Portfolio and booking site for Julian Gigola — photographer and creative director,
San Francisco Bay Area. Replaces a stock Format template.

Next.js 16 (App Router) · Tailwind v4 · TypeScript · Cloudflare Workers.

## Running it

```bash
npm install
npm run dev
```

`npm run build` prerenders every page, including one per project.

## How it is put together

**The work is the interface.** One committed dark theme, Univers Bold Condensed for
display and Geist for everything else, hairline rules instead of boxes, and motion only
where it does a job. The site is judged on bookings, not looks — every page a visitor can
finish ends in a single clear ask.

### Content

All 74 projects and 1,131 frames were migrated off the old Format site.

| File | What it is |
| --- | --- |
| `lib/work-data.ts` | **Generated.** Every project, its credits, categories and frames. Written by `scripts/harvest.mjs`; do not hand-edit — it gets overwritten. |
| `lib/work.ts` | The only module the app reads work from. Holds the editorial decisions: what is featured, what leads the homepage, how categories group. |
| `lib/work-types.ts` | Shapes for the above. |
| `lib/sessions.ts` | Bookable session types. `from: null` renders as "On request". |
| `lib/site.ts` | Reply-time promise and the booking-calendar URL. |
| `lib/testimonials.ts` | Client quotes. Empty; the section hides itself until it isn't. |

### Re-running the migration

```bash
node scripts/harvest.mjs
```

Format serves every page as JSON at `?format=json`, which carries full-resolution image
URLs, per-frame dominant colours and the credits block — so the script reads that API
rather than scraping markup. Page responses are cached under `.harvest-cache/`, and images
already on disk are skipped, so re-runs are cheap. `--refresh` clears the cache.

Frames are stored at 2500px wide, mozjpeg q82 — Format's largest render, and enough to
stay sharp in the lightbox, which asks for `sizes="100vw"` and so wants ~2900 device
pixels on a 1440px retina screen. Cloudflare cuts each one down per device at request
time, so a larger source costs a visitor nothing.

**The archive is not in this repo.** `public/work/` is ~690MB and git keeps every version
of every blob forever. It lives in an R2 bucket, served from `images.juliangigola.com`;
`lib/work-data.ts` is the manifest that points at it. After a harvest, push it:

```bash
node scripts/sync-r2.mjs
```

A fresh clone therefore has no photographs under `public/work/` until you either run the
harvester or pull them down from R2. Everything else — `public/hero/`, `public/covers/` —
ships with the app.

### Adding a cover image

Drop the full-resolution original in `PICS/` (untracked), resize it to 2500px wide at
q82 into `public/hero/`, then add an entry to `COVER_OVERRIDES` in `lib/work.ts`. The
`color` field is the image's **mean**, not its dominant — it is the mat drawn behind an
`object-contain` frame, and on a sunset image the dominant bucket comes back near-black.
Measure the mean from the **written file**, not the pipeline before it: the JPEG encode
shifts it enough to matter.

An override that names a frame already in the archive uses `archiveFrame()` instead, which
reads the dimensions from the manifest — hardcoding them there is how they went stale when
the archive moved from 1600px to 2500px.

## Hosting

Cloudflare Workers, via `@opennextjs/cloudflare`. Push to `main` deploys
(`.github/workflows/deploy.yml`).

| | |
| --- | --- |
| `wrangler.jsonc` | Worker name, `nodejs_compat`, and the static asset directory. |
| `open-next.config.ts` | Deliberately bare — the defaults cover this site. |
| `image-loader.ts` | Rewrites every frame onto Cloudflare Image Transformations. Off unless `NEXT_PUBLIC_IMAGE_CDN=1`, because `/cdn-cgi/` exists only on a real zone. |
| `.env.example` | Every variable, and which are secrets. |

```bash
npx opennextjs-cloudflare build     # bundle the Worker
npx wrangler dev --local            # serve it on :8787
npx wrangler tail                   # live production logs
```

Two things only work on the custom domain, never on `*.workers.dev`: image
transformations, and anything else behind `/cdn-cgi/`. Judge image quality on
`www.juliangigola.com`.

It was on GitHub Pages before this, as a static export. That had no image optimizer — the
loader ignored `width` and every device downloaded the same file — and no redirects, and a
build step that overwrote the contact form's Server Action with a stub so it could never
send mail. All three are fixed by having a server.

## Still to wire up

- **Booking** — set `BOOKING_URL` in `lib/site.ts` to a Google Calendar appointment
  schedule. "Check availability" buttons then appear on `/sessions` and `/contact`.
- **Contact delivery** — set `RESEND_API_KEY` and `CONTACT_TO`. Until then the form
  validates, refuses to fail silently, and hands back a working `mailto:`.
- **Session rates** — `from` is `null` on every entry in `lib/sessions.ts`.
- **Alt text** — 1,084 frames came across without any. The ones that appear in indexes
  and covers are worth a pass by hand.

## Notes

- `AGENTS.md` is written by `next dev`, not by hand.
- Old Format URLs (`/wired-magazine`, `/about`, `/rates`, …) are redirected in
  `next.config.ts`, generated from the manifest so they cannot drift.
