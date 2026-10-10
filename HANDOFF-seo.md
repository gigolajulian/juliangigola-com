# SEO & Booking Handoff — juliangigola.com

**Date:** 2 October 2026
**Branch:** `claude/blissful-archimedes-osawgk`
**Status: not live yet.** All the work below is on the branch above. The site
deploys only from `main`, so nothing changes on juliangigola.com until the
branch is merged.

---

## 1. How to make it live

1. Open the comparison page:
   https://github.com/gigolajulian/juliangigola-com/compare/main...claude/blissful-archimedes-osawgk
2. Click **Create pull request**, then **Merge**.
3. Cloudflare Workers Builds deploys `main` automatically. Allow a couple of minutes.
4. Check these addresses:
   - https://juliangigola.com/headshots
   - https://juliangigola.com/graduation-photos
   - https://juliangigola.com/model-digitals
   - https://juliangigola.com/portraits
   - https://juliangigola.com/music-photography
   - https://juliangigola.com/brand-photography
5. After it is live, submit the sitemap
   (`https://juliangigola.com/sitemap.xml`) in **Google Search Console** and
   **Bing Webmaster Tools** so the new pages are crawled quickly.

The branch already includes everything merged into `main` up to PR #4, and it
merges cleanly. One conflict, in `components/contact-screen.tsx`, was resolved
by keeping both sides.

**Before merging, read section 6: some wording needs your confirmation.**

---

## 2. What the research found

### Where demand is, and what converts

There are no public search volumes for city-level searches. The national
figures below come from SEO blogs that quote Keyword Planner or Semrush, and
those sources disagree, so treat them as estimates. To get exact local
numbers, run the list through **Google Keyword Planner** (free with an Ads
account) with the location set to *San Francisco–Oakland–San Jose*.

| Service | Main search to target | Competition | Notes |
|---|---|---|---|
| Graduation | sjsu grad photos, santa clara university graduation photographer | **Low** | Easiest wins. Searches peak in March–May. |
| Model digitals | model digitals / polaroids, modeling portfolio photographer | **Low** | Agency terms; people searching them are ready to book. |
| Musician press | musician press photos bay area, band photographer SF | **Low** | San Jose results show only Yelp, GigSalad and Craigslist. |
| Music video | music video director san francisco / san jose | Low–medium | Mostly directories rank today. |
| Headshots | headshot photographer san francisco / san jose | High in SF, medium in SJ | "Silicon Valley" is how South Bay companies search. |
| Brand campaigns | commercial / brand photographer san francisco | High | Highest fees. Win it with long-tail terms and directories. |
| Editorial | fashion photographer san francisco | Medium | Real but small demand. |
| Portraits | portrait photographer san francisco | Medium | |
| Weddings | **editorial** wedding photographer san francisco | Niche | The general "wedding photographer" search is saturated. |

**Not worth chasing:**
- "fashion photography" and "album cover": inspiration searches, not hiring.
- "creative director san francisco": job seekers.
- "videographer SF": dominated by wedding videographers.
- "Assyrian photographer": no search demand, but a strong story for About and press.

**Typical published Bay Area prices** (useful when you set yours):

| Service | Typical price |
|---|---|
| Headshots | $175–550 per person; corporate team days $2,000–3,500 |
| Graduation | $350–650 |
| Model digitals | $250–330 |
| Portraits | $250–400 is common |
| Weddings | $4,500–6,000 mid-range |

### What wins in the search results (competitor patterns)

- One page per service, with the city in the title and heading
  (Pacifica Studio, Tiana Hunter, Edelson).
- Visible prices (Steven Cotton from $175, Pacifica $350/$450, Brandon Andre $300).
- FAQ and guide content: cost guides, "best SJSU photo spots", "what are model digitals".
- Review counts and badges shown up front.
- **Competitor to watch: Pacifica Studio** (pacifica.studio). It is in Santa Clara
  and sells exactly your session mix: SJSU, SCU and Stanford grads, model
  portfolios, headshots and portraits.

### How AI search picks businesses (ChatGPT, Claude, Gemini, Perplexity, Copilot)

| Engine | Where it gets results |
|---|---|
| ChatGPT search | Its own index and crawler (`OAI-SearchBot`), plus Yelp data through a licensing deal |
| Claude web search | Brave Search; crawlers `Claude-SearchBot` and `Claude-User` |
| Gemini, Google AI Overviews and AI Mode | Google's index, plus Google Business Profile and Maps data |
| Copilot | Bing's index and Bing Places |
| Perplexity | Its own index (`PerplexityBot`) |

- **Your robots.txt already lets every AI search crawler in.** It blocks only
  the crawlers that collect training data (GPTBot, ClaudeBot and others). Those
  blocks do not affect search results.
- **One exception: `Google-Extended` is blocked.** That doesn't affect Google
  Search or AI Overviews, but per Google's documentation it likely keeps you
  out of answers in the Gemini app. **Decision for you** (section 6).
- **About 40% of what AI engines cite for local services is business listings
  and reviews** (Google, Yelp, Bing, Apple). Third-party "best photographers in
  X" lists are the most-cited page type for "best X" questions.
- **llms.txt does nothing.** No major engine reads it.

---

## 3. What was built

### Six booking pages, one per service

Each page is a sideways deck of screens like the homepage. On phones the
screens stack down the page.

| Address | Title in Google |
|---|---|
| `/headshots` | Headshot Photographer, San Francisco & San Jose |
| `/graduation-photos` | Graduation Photos in San Jose & San Francisco |
| `/model-digitals` | Model Digitals & Polaroids, SF & San Jose |
| `/portraits` | Portrait Photographer, San Francisco & San Jose |
| `/music-photography` | Musician Press Photos & Music Videos, Bay Area |
| `/brand-photography` | Brand & Campaign Photographer, SF & San Jose |

**Screens on every page:**
1. **Cover:** title, short intro, price and turnaround, a booking button, and a photo.
2. **The work:** six photos, each opening its gallery or project.
3. **The details:** what's included, plus links to the other five booking pages.
4. **Where I shoot:** San Francisco, San Jose, Oakland, Santa Cruz, Los Angeles,
   New York, with a note for each. Graduation lists campuses instead.
5. **Questions:** 4–6 answers to what people search before booking, e.g. "How
   much do headshots cost in San Francisco or San Jose?".
6. **Book:** your contact form, already set to that session or kind of shoot.

### Search and AI improvements across the site

- **Page titles and descriptions are written for real searches.**
  - Homepage: "Julian Gigola | Photographer & Creative Director, SF Bay Area".
  - Portfolio pages that now have a booking page are retitled as portfolios
    ("Headshot Portfolio, San Francisco Bay Area"), so Google ranks the page
    that takes bookings rather than splitting between the two.
- **Structured data on every page** (the code that tells search engines and AI
  who you are): you as a person with Instagram, LinkedIn and Vimeo; your
  business with its service area (Bay Area cities, LA, New York); and a
  catalogue of your services with prices where they're set.
- **Each booking page adds its own structured data:** the service and price,
  its questions and answers, and a breadcrumb.
- **The sitemap** lists the booking pages above the portfolio pages.
- **The footer on every page** reads: San Francisco Bay Area · San Francisco ·
  San Jose · Oakland · Santa Cruz.
- **Homepage Sessions screen:** each session now shows "More on Headshots →"
  (and so on), and its photo links to the booking page. Weddings has no page
  yet, so it shows no link.

### Redirects

- `/headshots` and `/portraits` used to be redirects left from the old Format
  site. They now open the new pages.
- `/graduation` (the old site's address) now redirects to `/graduation-photos`.

### Where things live in the code

| File | What it holds |
|---|---|
| `lib/booking.ts` | **All booking-page wording:** titles, intros, questions and answers, where you shoot, photos. Edit copy here. |
| `lib/booking-slugs.ts` | The six page addresses. Read by both the pages and `next.config.ts`. |
| `lib/seo.ts` | Portfolio page titles and descriptions, and the site-wide structured data. |
| `app/[service]/page.tsx` | The booking page route. |
| `components/local-screens.tsx` | The cover, work, details and where screens. |
| `components/local-questions.tsx` | The questions screen. |
| `content/site.json` (via /admin) | **Session prices, inclusions and turnaround.** The booking pages read these, so changing a price in /admin updates the page, its description and its structured data. |

### Checks run

- Production build and TypeScript typecheck pass.
- Lint is clean on every changed file. Five lint problems remain in files this
  work did not touch, and they are also on `main`.
- Every page checked in a browser at desktop and phone sizes.
- Every page has exactly one main heading, a canonical address and valid
  structured data. Descriptions are under 160 characters.

---

## 4. Off-site checklist (you have to do these yourself)

These matter as much as the website. They decide whether you appear in Google
Maps and in AI answers like "best headshot photographer in San Jose".

### 4.1 Google Business Profile (highest priority, about 15 minutes)

Go to **business.google.com** and sign in with the Google account that should own it.

| Field | What to enter |
|---|---|
| Business name | `Julian Gigola`. Real name only; adding keywords breaks Google's rules and can get the profile suspended. |
| Business type | Serves customers at their location (a service-area business, not a storefront) |
| Address | Where you actually work from, SF or San Jose. Google hides it, but uses it to rank map results by distance. |
| Service areas | San Francisco, San Jose, Oakland, Santa Cruz, Santa Clara, Palo Alto, Berkeley, Sunnyvale. Google limits this to roughly a two-hour drive, so LA and NY go in the description. |
| Primary category | Photographer |
| Extra categories | Any of these Google's list offers: Portrait studio, Wedding photographer, Commercial photographer, Video production service |
| Website | `https://juliangigola.com` |
| Phone | Optional but recommended |
| Verification | Usually a short video showing your gear and proof you run the business; sometimes a phone or email code |

**Description** (under the 750-character limit; paste as is):

> Photographer and creative director based in the San Francisco Bay Area, with 12+ years of experience and work published in WIRED. Sessions in San Francisco and San Jose: headshots for LinkedIn, press and actors; graduation photos at SJSU, Santa Clara University and Bay Area campuses; portraits; agency-standard model digitals; and editorial-style weddings. Commissions for brands and artists: fashion editorials, brand campaigns, musician press photos, album cover art and music videos, with art and creative direction. Studio or location, across the Bay Area from San Francisco and Oakland to San Jose and Santa Cruz, and available to travel to Los Angeles and New York.

**Services:**

| Service | Price |
|---|---|
| Graduation photos | From $400 |
| Model digitals | From $250 |
| Headshots | add once set |
| Portraits | add once set |
| Weddings | add once set |
| Fashion & editorial photography | Quote |
| Brand campaign photography | Quote |
| Musician press photos & cover art | Quote |
| Music video direction | Quote |

**Photos:** at least 10 of your best, one or two per service, plus a portrait of you.

### 4.2 Reviews (the biggest map-ranking factor you control)

- In the Google profile, use **Ask for reviews** to get a short link.
- Send it to recent clients. Graduation and headshot clients are the easiest to ask.
- Five to ten real reviews put you ahead of most solo photographers.

### 4.3 The other listings (about 5 minutes each)

- **Bing Places** (bingplaces.com): use "Import from Google Business Profile". Feeds Bing and Copilot.
- **Apple Business Connect** (businessconnect.apple.com): feeds Apple Maps and Siri.
- **Yelp** (biz.yelp.com): claim a free listing. ChatGPT and Apple pull from Yelp.

### 4.4 Directories and lists that showed up repeatedly in research

| Directory or list | Best for |
|---|---|
| Expertise.com (SF portrait photographers) | Portraits, headshots |
| Peerspace "best fashion / portrait photographers in SF" | Fashion, portraits |
| Thumbtack (SF and San Jose headshots) | Headshots |
| Snappr | General |
| Wonderful Machine | Commercial, fashion |
| ProductionHub | Music video |
| WeddingWire, Zola | Weddings, if you want more |
| 7x7, DoTheBay | Pitch a story: local press for the editorial work |

### 4.5 Settings to check

- **Google Search Console:** verify the site and submit the sitemap.
- **Bing Webmaster Tools:** already verified. Submit the sitemap and turn on
  IndexNow, which pings Bing when pages change.
- **Cloudflare → AI Crawl Control / Bot settings:** make sure the AI search
  crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot) aren't blocked at
  Cloudflare's edge, whatever robots.txt says.

---

## 5. After the profiles are live

Send Claude the Google Business Profile link and the Yelp page, and it will:
- add them to the site's structured data, so engines connect your profiles to the site;
- put a "Leave a review" link where past clients will see it.

---

## 6. Decisions and wording to confirm

### Wording written for the pages that you haven't confirmed

Everything else comes from your existing site copy. Edit any of these in `lib/booking.ts`.

1. **Headshots:** "Can you photograph a whole team? Yes…" and the "For teams" block.
2. **Digitals:** "Do you shoot portfolio tests too? Yes, quoted on request."
3. **Brands:** "Can you shoot stills and video on the same day? Yes."
4. **Graduation campus spots:**
   - SJSU: Tower Hall, the Smith–Carlos statue, King Library.
   - Santa Clara University: the Mission Church, Palm Drive.
   - SF State: Malcolm X Plaza, the J. Paul Leonard Library.
   - USF: St. Ignatius Church, Lone Mountain.
   - UC Berkeley: Sather Tower, Sather Gate.
5. **Graduation, other campuses:** the answer names Stanford and UC Santa Cruz "with a travel fee".
6. **Travel wording:** "Travel is quoted with the booking" for LA and New York,
   and "Say where in the form" for Oakland and Santa Cruz.
7. **General advice** (what to wear, when to book), written as advice rather than your policy.

### Decisions for you

| # | Decision | Why it matters |
|---|---|---|
| 1 | **Graduation travel fee for San Francisco campuses** | Your session copy covers SJSU and SCU in the price, with a travel fee "further out". The page therefore tells SF State, USF and Berkeley students they'll pay one. If San Francisco is a home base, change the Graduation text in /admin. |
| 2 | **Prices for headshots, portraits and weddings** | They show "On request". Prices are among the most-searched questions, and AI engines quote them. |
| 3 | **Unblock `Google-Extended`?** | It likely keeps you out of Gemini app answers. Training blocks for other companies (GPTBot, ClaudeBot) don't affect search and can stay. One line in `app/robots.ts`. |
| 4 | **Weddings booking page?** | Built, /weddings is live. Possible angles: "editorial wedding photographer", and Assyrian weddings in San Jose and Turlock, where no photographer currently targets that search. |
| 5 | **Visible location lines** | The homepage hero still says "Based in San Francisco, CA". It could name both cities. |

---

## 7. Suggested next steps, in order

1. Confirm section 6, then merge (section 1).
2. Create the Google Business Profile and ask for the first reviews (section 4).
3. Set Bing Places, Apple Business Connect and Yelp (section 4.3).
4. Set the missing prices in /admin.
5. Write alt text for the photos people see first (homepage, covers, session
   galleries). 1,229 photos currently have none.
6. Write campus guides ("Best spots for SJSU grad photos") before January, ahead
   of spring commencement. One competitor owns the SJSU results with posts like these.
7. ~~Build a weddings page~~ Done: /weddings is live (200) through `app/[service]`.
8. Check results monthly: Google Search Console (including its AI report), Bing
   Webmaster Tools' AI Performance report, and a few test questions in
   ChatGPT, Gemini and Perplexity ("best headshot photographer in San Jose").

---

## 8. Main sources

- Anthropic crawlers: https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- OpenAI crawlers: https://developers.openai.com/api/docs/bots
- Google AI features: https://developers.google.com/search/docs/appearance/ai-features
- Google crawlers (Google-Extended): https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
- Bing AI Performance report: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- Where AI engines get citations (Yext): https://www.yext.com/about/news-media/ai-citations-release
- "Best of" lists in AI answers (Ahrefs): https://ahrefs.com/blog/best-lists-research/
- Photography keyword volumes: https://www.keysearch.co/top-keywords/photography-keywords · https://www.seopital.co/blog/seo-keywords-for-photographers · https://www.imaginated.com/photography/business/marketing/seo/keywords/
- SF headshot pricing: https://edelsonphotography.com/how-much-is-headshot-photography-in-san-francisco/
- Competitor (Pacifica Studio): https://pacifica.studio/pricing · https://pacifica.studio/locations/san-jose/headshots
- Model digitals pricing: https://www.brandonandrephoto.com/san-francisco-modeling-digitals
- SF wedding pricing: https://zoelarkin.com/how-much-does-a-wedding-photographer-cost-in-the-san-francisco-bay-area/

## 9. Threads (2026-10-10)

- **Done:** live check, all Done items in SEO.md still hold (titles, descriptions, canonicals, JSON-LD, one h1, robots policy, 119 sitemap URLs).
- **In progress, jg-CONTENT:** gallery alt text on branch `content`. Rules sent: one sentence, 8 to 18 words, at most 125 characters, no trailing period, only what the frame shows, no skin or body, no banned words. 81 frames cleared by me (script over every changed frame plus 15 photos opened), head 9e7b982.
- **Alt text: done.** Every gallery frame has written alt text (#104, #107, #108, all live). Live check 2026-10-10: 109 /portfolio/ pages plus /headshots, 0 empty alts, 0 gendered words. The 85 empty `cover.jpg` fields are filled from each project's lead frame by `withLeadFrame`, on purpose. `scripts/harvest.mjs` still wipes hand-written alt if it regenerates `work-data.ts`: do not run it without a plan.
- **Next for me:** campus guides (needs Julian's sign-off on copy), spot-check each new batch, `sameAs` once the Google Business Profile is verified.
