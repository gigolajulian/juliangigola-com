# SEO checklist

The running list for juliangigola.com, read by the `seo-next` skill. Research
and reasoning are in `HANDOFF-seo.md`. One line per item.

Robots policy (Julian, 2026-10-02): **Googlebot-Image blocked** (photos stay
out of Google Images and Gemini training), **Google-Extended allowed** (so
Gemini can recommend the site). AI search crawlers allowed, training crawlers
blocked. The terms name Google as the text-only exception.

## Done

- Booking pages for headshots, graduation, portraits, model digitals, music, brand, with title, description, FAQ, Service and Offer data (PR #5, f70fe63)
- Weddings booking page, /weddings (362a1b3)
- Booking pages render on a cache miss instead of 404 on Cloudflare (c78a863)
- robots.txt: Google-Extended allowed, Googlebot-Image blocked; terms updated (9c0242a)
- Hero line: "Based in the SF Bay Area. Available to travel worldwide" (3899399)
- Alt text on booking-page photos and homepage cover (PR #8, ef645fa, 8f5774f)
- Alt text everywhere else from discipline and credits, generated (8f5774f)
- Homepage: session links carry each booking page's heading (97d7d96, 7a932e6)
- Homepage meta description in Julian's words (4e545f2)
- About: sessions sentence in Julian's words (c9d43ad)
- Client logos: the company name as text in each logo link (975e7f4)
- Video stills: "Still from <title>" alt text (PR #13, 04551d1)
- Live check 2026-10-02: 119 sitemap URLs all 200; www and http 301 to apex; real 404s; one h1, canonical and description on every checked page; no empty alts on home, booking pages or /portfolio
- Footer's hidden city text gone; cities live in the description and JSON-LD `areaServed` (checked 2026-10-05)
- Search numbers in /admin Traffic (Google) and the Agentic OS dashboard (Google and Bing), 2026-10-05

## Next (code)

1. Campus guides: "Best spots for SJSU grad photos", then SCU and SF State. Live before January for spring commencement. Copy needs Julian's sign-off.
2. After the Google Business Profile is verified: add it (and Yelp) to `sameAs` in the structured data, and a "Leave a review" link.
3. Written descriptions for the ~1,200 gallery photos that only have generated alt text, starting with the most-viewed projects.
4. Session links wrap under "Book a session" at 1280px wide (layout, not ranking).

## Julian only

- Google Business Profile on hello@juliangigola.com: created 2026-10-02, **not verified yet**. Address, text code, then usually a video in the Google Maps app.
- Ask 5 to 10 past clients for Google reviews once it is verified.
- Prices for headshots, portraits and weddings in /admin (still "On request").
- Sitemaps done: Google read it 2026-10-05, 119 URLs, success; Bing has it: 119 URLs, crawled 2026-10-03; IndexNow on via Cloudflare Crawler Hints, 2026-10-05).
- Bing Places (import from Google), Apple Business Connect, Yelp.
- Directories: Thumbtack, Expertise.com, Peerspace, Wonderful Machine, ProductionHub, WeddingWire.
- Decide on photos for the Google profile (they help ranking; conflicts with keeping photos away from Google).
- Confirm copy Claude wrote: team headshots, campus spots, travel lines, weddings text (`lib/booking.ts`).
- Block AI scrapers at the edge (2026-10-07 test with `curl -A <bot>`): ClaudeBot, Claude-Web, anthropic-ai, Bytespider, Amazonbot, cohere-ai already get 403. Still 200 on pages and photos: GPTBot, CCBot, FacebookBot, Meta-ExternalAgent, Diffbot, omgili, ImagesiftBot, img2dataset, Timpibot, AI2Bot, PanguBot, ICC-Crawler, Scrapy, python-requests. Fix: Cloudflare dashboard, Security rules, add those user agents to the existing block rule (or Security > Bots > Block AI bots), then re-run the curl test. Code cannot do it: static files are served without the Worker.
- Cloudflare AI Crawl Control: check OAI-SearchBot, Claude-SearchBot, PerplexityBot aren't blocked at the edge.
- Monthly: Search Console, Bing AI Performance report, and ask ChatGPT, Gemini and Perplexity "best headshot photographer in San Jose".
