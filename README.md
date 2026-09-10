# juliangigola.com

Portfolio and booking site for Julian Gigola — photographer and creative director,
San Francisco Bay Area. Replaces a stock Format template.

Next.js 16 (App Router) · Tailwind v4 · TypeScript · fully static.

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

Frames are stored at 1600px wide, mozjpeg q82 — the widest a frame is ever displayed, with
`next/image` deriving every smaller size. The originals average 2.5 MB each; storing them
would put ~2.9 GB in this repo for pixels nothing can show.

### Adding a cover image

Drop the full-resolution original in `PICS/` (untracked), resize it to 1600px wide at
q82 into `public/hero/`, then add an entry to `COVER_OVERRIDES` in `lib/work.ts`. The
`color` field is the image's **mean**, not its dominant — it is the mat drawn behind an
`object-contain` frame, and on a sunset image the dominant bucket comes back near-black.

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
