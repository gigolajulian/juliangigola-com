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

Cloudflare Workers, via `@opennextjs/cloudflare`. Push to `main` deploys —
through **Workers Builds**, which is connected to this repository from the
Cloudflare dashboard rather than driven by a workflow file. There is no
`.github/workflows`: the previous GitHub Actions deploy needed a Cloudflare
API token kept as a repository secret, and this needs no token at all.

Build command `npx opennextjs-cloudflare build`, deploy command
`npx opennextjs-cloudflare deploy`. Change those in the dashboard under the
Worker's **Settings → Builds**, not here.

That is also what makes `/admin` useful: it commits `content/site.json`, the
push starts a build, and the edit is live in a couple of minutes.

### Adding a project from /admin

New shoots go in `content/projects.json`, **not** `lib/work-data.ts` — the
harvester overwrites that file, so a project written there survives exactly
until the next harvest and then vanishes with nothing failing. `lib/work.ts`
merges the two, added work first, so a shoot uploaded today leads its
discipline.

The photographs are resized in the browser to the same 2500px/q82 the
harvester uses (`lib/admin-image.ts`) and committed under
`public/work/<slug>/` **in the same commit as the manifest**, via the Git Data
API (`lib/admin-github.ts`). One commit, one build, and the manifest is never
in the repo describing files that are not.

`content/projects.json` is validated as strictly as `site.json`: a frame that
points anywhere but `/work/`, an unknown discipline, or a duplicate slug fails
the build rather than shipping. Failing the deploy leaves the last good build
serving, which is the safe direction.

### Taking work down

**Hide** removes a project from the site — every index, the discipline pages,
`sitemap.xml`, and its own route — and is reversible. It is the only kind of
removal a harvested project can have: `lib/work-data.ts` is regenerated, so a
deletion there returns on the next harvest with nothing to show it ever went.
The list lives in `hidden` in `content/projects.json`, and `lib/work.ts`
filters once, where every consumer reads, rather than at each index.

**Delete** is offered only for projects added through `/admin`, because only
those have files that are ours to remove. It takes the manifest entry and
every file under `public/work/<slug>/` in one commit — listed from the repo
rather than derived from the manifest, so a half-finished upload does not
leave orphans behind.

### Where enquiries go

The contact form writes to a KV namespace and `/admin`'s **Inbox** tab reads
it. Nothing is emailed, which is the point: an enquiry that is stored cannot
bounce, cannot land in a spam folder, and needs no sending domain, no API key
and no monthly bill. The sender needs no mail app either — the form used to
hand back a prefilled `mailto:` and ask them to send it themselves, which is
work for the one person you want to hear from.

Two things make it work, and only one of them is set up for you:

- **`INBOX` namespace** — bound in `wrangler.jsonc`, created already. Writing
  an enquiry needs nothing else, so the form captures messages from the first
  deploy.
- **`INBOX_KEY` secret** — `wrangler secret put INBOX_KEY`, any long random
  string, then paste it into the Inbox tab once. Until it is set the route
  **refuses every read**: an enquiry carries somebody's name, their address
  and what they want, and the failure to avoid is the one where that is
  readable by whoever asks. The GitHub token cannot stand in for it — GitHub
  has no opinion about data held on this site.

Cloudflare Access in front of `/admin` is still worth having, but it is not
what protects this.

#### What stops it being spammed

A Server Action is a public endpoint, and this one writes to a store with a
quota. Three things stand in front of it, in `lib/inbox.ts`:

- **A five-minute cooldown per sender.** Read before anything is written, so a
  sender inside the window costs one read and no writes. Keyed on a hash of
  the address salted with the day, never the address itself.
- **A ceiling of 200 a day**, across everybody — because the cooldown is per
  sender and a spammer has more than one. KV allows a thousand writes a day
  and each enquiry costs two, so the cap cannot exhaust the quota. Past it the
  form says so and offers the `mailto:`; refusing a message is fine, pretending
  to accept one is not.
- **A honeypot field**, answered with the same success a real enquiry gets.
  Telling a bot it was caught is telling whoever wrote it what to change.
  Nothing is stored, so neither the inbox nor the quota pays for it.

`scripts/check-inbox.mjs` covers all of that — 46 cases, including the
cooldown's boundaries and a clock that runs backwards.

A Cloudflare **Rate Limiting** rule on `/contact` is still the right thing to
add on top, since the cooldown is enforced by a store the request can reach
and a rule is enforced before it gets there.

### Security headers

Declared twice, in `next.config.ts` and in `public/_headers`, because both can
serve a response: the Worker renders some, and Cloudflare serves prerendered
pages straight off the edge without invoking it. Keep the two in step.

`script-src` allows `'unsafe-inline'`, deliberately. Next inlines its
hydration payload into every prerendered page and the theme script has to run
before first paint; nonces need a dynamic render. So the CSP is not an XSS
backstop here — it is a boundary on where script, frames and connections may
come from. `connect-src` is the one that earns its keep: the `/admin` GitHub
token lives in `localStorage`, and restricting connections to this origin and
`api.github.com` means script that did somehow run has nowhere to send it.

### /admin is behind Cloudflare Access — on one hostname only

> **Open right now.** The Access application covers
> `juliangigola.jg-website-new.workers.dev/admin`, which challenges correctly.
> It does **not** cover the custom domain, and that is the hostname anybody
> actually reaches:
>
> | URL | |
> | --- | --- |
> | `juliangigola.jg-website-new.workers.dev/admin` | 302 to the Access login |
> | `www.juliangigola.com/admin` | **200, the whole page** |
> | `juliangigola.com/admin` | **200, the whole page** |
>
> Fix: Zero Trust → Access → Applications → this application → add
> `juliangigola.com` and `www.juliangigola.com`, both path-scoped to `/admin`.
> Three clicks, no code. A self-hosted Access application is scoped per
> hostname, so adding a custom domain to the Worker does not extend a policy
> written against `workers.dev` — which is exactly what happened here.
>
> What is and is not exposed meanwhile: the page renders the editor UI and the
> content the last build published, all of which is already public on the
> site. It cannot write anything. Every write is authorised by a GitHub
> fine-grained token that lives in one browser's `localStorage` and is never
> served with the page, so a stranger reaching `/admin` gets a form that
> cannot commit. The hole is an unlisted UI left open, not a data leak or a
> write path.

The editor is a public page that a GitHub token is pasted into, so it is
gated by a Zero Trust policy rather than by anything in this codebase — no
login code, no password, and no session handling to get wrong.

Application: self-hosted, **path-scoped** to `/admin` so the rest of the site
stays public, with every hostname the site answers on listed. Policy "Julian
only": Allow where email is Julian's. Note that the Worker-level Access
option protects *every* hostname on the Worker and would put the whole
portfolio behind a login — it is the wrong tool here.

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
- **The inbox key** — `wrangler secret put INBOX_KEY`, then paste it into /admin's
  Inbox tab. Enquiries are captured either way; without the key they cannot be read.
- **Session rates** — `from` is `null` on every entry in `lib/sessions.ts`.
- **Alt text** — 1,084 frames came across without any. The ones that appear in indexes
  and covers are worth a pass by hand.

## Notes

- `AGENTS.md` is written by `next dev`, not by hand.
- Old Format URLs (`/wired-magazine`, `/about`, `/rates`, …) are redirected in
  `next.config.ts`, generated from the manifest so they cannot drift.
