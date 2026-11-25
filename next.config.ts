import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
// `work`, not `work-data`. The generated manifest is every project the old
// site ever had; `work.ts` is the set actually published, with hidden ones
// filtered out. Redirecting from a legacy URL to a page that is no longer
// built sends a visitor 308 → 404, which is worse than the plain 404 they
// would have got, because it looks like the site meant to take them there.
import { LINKABLE, CATEGORIES, LISTINGS, categoryHref } from "./lib/work/work";
import { BOOKING_SLUGS } from "./lib/booking/slugs";

/** The site's one version (version.json; package.json's stays out of commits), checked against RELEASES.md and the tags
    by scripts/check-version.mjs. */
const SITE_VERSION: string = JSON.parse(readFileSync("version.json", "utf8")).version;

/**
 * The old site published every project at the site root — `/wired-magazine`,
 * `/dystopia`, `/sago`. Those URLs are in Instagram bios, in email threads,
 * and in Google's index, so all of them have to keep working.
 *
 * Generated from the manifest rather than typed out, so a project added or
 * renamed later cannot fall out of the list.
 */
const projectRedirects = LINKABLE.map((p) => ({
  source: `/${p.slug}`,
  destination: `/portfolio/${p.slug}`,
  permanent: true,
}));

/**
 * A project whose address was changed in /admin. Both of the old forms are
 * in the index and in Julian's own links - the page and the bare slug -
 * and both land on the page as it is now. Generated from the manifest so
 * a rename cannot be made without its redirect.
 */
const renameRedirects = LINKABLE.filter((p): p is typeof p & { origin: string } => !!p.origin).flatMap((p) => [
  {
    source: `/work/${p.origin}`,
    destination: `/portfolio/${p.slug}`,
    permanent: true,
  },
  {
    source: `/portfolio/${p.origin}`,
    destination: `/portfolio/${p.slug}`,
    permanent: true,
  },
  { source: `/${p.origin}`, destination: `/portfolio/${p.slug}`, permanent: true },
]);

/**
 * Old category pages. Each one lands on that discipline's own page now, so an
 * indexed `/editorial` arrives at the editorial work rather than at seventy
 * projects with a filter still to apply. `categoryHref` handles the two edge
 * cases — a category that is itself one gallery, and one with no work yet.
 */
const categoryRedirects = CATEGORIES.map((c) => ({
  source: `/${c.slug}`,
  destination: c.section === "SESSIONS" ? "/#sessions" : categoryHref(c.slug),
  permanent: true,
}));

/**
 * The discipline pages are retired for /portfolio with the chip on
 * (Julian's call). Where a discipline shares its slug with its one gallery
 * (Automotive, Events, Places, Cover art) the project page answers instead.
 */
const disciplineRedirects = [
  ...LISTINGS.filter((c) => !LINKABLE.some((p) => p.slug === c.slug)).map((c) => ({
    source: `/portfolio/${c.slug}`,
    destination: categoryHref(c.slug),
    permanent: true,
  })),
  { source: "/portfolio/discipline/:slug([a-z0-9-]+)", destination: "/portfolio?d=:slug", permanent: true },
];

/**
 * Portfolio at /portfolio (Julian's call). Every old /work address is in
 * the index, in his Instagram and in inboxes, so each one answers with a permanent redirect to the same place under
 * /portfolio. Last, so a rename above sends an old slug straight to its new
 * one. Pages only: the photographs are still filed under `/work/`
 * (`image-loader.ts`), so nothing here matches a path with a dot in it or
 * one folder deeper than a project.
 */
const workRedirects = [
  // The disciplines sit beside the projects: /portfolio/category/editorial
  // is /portfolio/editorial (and cover art its project page).
  {
    source: "/portfolio/category/:slug([a-z0-9-]+)",
    destination: "/portfolio/:slug",
    permanent: true,
  },
  { source: "/work", destination: "/portfolio", permanent: true },
  { source: "/work/video", destination: "/portfolio/video", permanent: true },
  {
    source: "/work/category/:slug([a-z0-9-]+)",
    destination: "/portfolio/:slug",
    permanent: true,
  },
  {
    source: "/work/:slug([a-z0-9-]+)",
    destination: "/portfolio/:slug",
    permanent: true,
  },
];

/** Pages that moved or were retired. */
const pageRedirects = [
  // A session gallery small enough to be all there is a screen of the page
  // that books it (Julian's call). Permanent, so Google drops the old addresses.
  { source: "/portfolio/headshots", destination: "/headshots#work", permanent: true },
  { source: "/portfolio/graduation", destination: "/graduation-photos#work", permanent: true },
  // /studio (to /about) and /links (to /contact) are Cloudflare redirect rules
  // ("studio to about", "links to contact", 308, juliangigola.com only), not code.
  // Sessions is where a rate question gets answered.
  { source: "/rates", destination: "/#sessions", permanent: true },
  // Sessions is a homepage screen, not a page (Julian's call).
  { source: "/sessions", destination: "/#sessions", permanent: true },
  // No store.
  { source: "/store", destination: "/", permanent: true },
  // "Wedding" is hidden; its frames live in the Weddings gallery's sequence.
  { source: "/work/bridal", destination: "/portfolio/weddings", permanent: true },
  { source: "/portfolio/bridal", destination: "/portfolio/weddings", permanent: true },
  // The terms and the privacy policy are two columns of one page, and the
  // footer links straight to the anchors. GISELLE's old full gallery name is
  // in the index and in Julian's own links.
  {
    source: "/work/giselle-studio-digitals",
    destination: "/portfolio/giselle",
    permanent: true,
  },
  {
    source: "/portfolio/giselle-studio-digitals",
    destination: "/portfolio/giselle",
    permanent: true,
  },
  {
    source: "/giselle-studio-digitals",
    destination: "/portfolio/giselle",
    permanent: true,
  },
  { source: "/terms", destination: "/legal#terms", permanent: true },
  { source: "/privacy", destination: "/legal#privacy", permanent: true },
];

/** The old category addresses in one hop (they were two: to `/portfolio/<slug>`, then on): each goes
    straight to where `/portfolio/<slug>` is itself sent. A slug that is a page of its own keeps the rule below. */
const categoryPathRedirects = [...pageRedirects, ...disciplineRedirects]
  .filter((r) => /^\/portfolio\/[a-z0-9-]+$/.test(r.source))
  .flatMap((r) => ["/portfolio/category/", "/work/category/"].map((pre) => ({ ...r, source: pre + r.source.slice("/portfolio/".length) })));

/**
 * A production build for this machine, not for Cloudflare.
 *
 * `JG_LOCAL=1` is set by `npm run perf` (`scripts/perf/run.mjs`) and by
 * nothing that deploys. With it, a build served by `next start` on
 * http://localhost behaves like the live site in the two ways that matter
 * for timing a frame:
 *
 *   - `/cdn-cgi/image/*` is proxied to https://juliangigola.com, so the
 *     photographs are the production-sized ones Cloudflare resizes. Without
 *     it every frame 404s locally and a swipe moves empty boxes.
 *   - `upgrade-insecure-requests` and HSTS are left out. Safari upgrades
 *     every request on plain-http localhost to https under that directive,
 *     and the page loads with no stylesheet and no scripts.
 *
 * Read at build time. A Cloudflare build never sets it, so its routes and
 * headers are exactly as before.
 */
const LOCAL = process.env.JG_LOCAL === "1";

/**
 * A branch preview asks the live zone for its resized photographs.
 *
 * `/cdn-cgi/image/` 404s on `*.workers.dev`, so a preview fell back to the
 * 2500px originals and decoded about 15 times the pixels live does. Workers
 * Builds names the branch it is building; any branch but `main` gets the
 * live origin in front of the loader's URLs (`image-loader.ts`). Empty on
 * main and outside Workers Builds, where the URLs are exactly as before.
 * Setting the variable by hand wins, for a local build that wants the same.
 */
const CI_BRANCH = process.env.WORKERS_CI_BRANCH;
const IMAGE_CDN_ORIGIN = process.env.NEXT_PUBLIC_IMAGE_CDN_ORIGIN ?? (CI_BRANCH && CI_BRANCH !== "main" ? "https://juliangigola.com" : "");

// Dev-only allowance so impeccable live mode can load. Guarded by NODE_ENV.
const __impeccableLiveDev = process.env.NODE_ENV === "development" ? " http://localhost:8400" : "";

/**
 * Security headers.
 *
 * The site was sending none: no CSP, no framing policy, no sniff
 * protection, no referrer policy, and `x-powered-by: Next.js` naming the
 * stack to anyone who asked. Cloudflare terminates TLS and enforces HTTPS,
 * which covers transport and nothing above it.
 *
 * `script-src` keeps `'unsafe-inline'`, and that is a deliberate limit rather
 * than an oversight. Next inlines its hydration payload as `<script>` tags in
 * every prerendered page, and the theme script in `app/layout.tsx` has to run
 * before first paint; nonces need a dynamic render, which this build does
 * not do. So CSP here is not an XSS backstop; it is a boundary on *where*
 * script, frames and connections may come from, which is worth having on its
 * own. The site renders no HTML from content, so there is no injection sink
 * for the inline allowance to widen.
 *
 * The specific allowances, each for one real reason:
 *   blob:            /admin previews a chosen photograph from an object URL
 *                    before it has been uploaded anywhere.
 *   api.github.com   /admin commits through the GitHub API from the browser.
 *   youtube/vimeo    /portfolio/video embeds films from both. Four allowances,
 *                    each narrow: the two player origins in `frame-src`, the
 *                    two thumbnail CDNs in `img-src`, and the two oEmbed
 *                    endpoints in `connect-src`, which only /admin uses, to
 *                    read a title and a poster off a pasted link.
 *
 *                    `youtube-nocookie.com` rather than `youtube.com` for the
 *                    player: the ordinary domain sets an advertising cookie
 *                    on load, and this site has no cookie banner to justify
 *                    one. The previews play muted as each film comes into
 *                    frame (`components/portfolio/video.tsx`).
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Nothing here is meant to be embedded by another site. Two spellings of one
  // rule, because `frame-ancestors` is the real one and `X-Frame-Options`
  // below is what older browsers read. 'self' rather than 'none' for one
  // frame: /admin's SEO tab shows a page live under its click map
  // (`admin-seo.tsx`). Julian's call over a per-URL exception.
  "frame-ancestors 'self'",
  "form-action 'self'",
  // The provider stills for the video page, which are 16:9 thumbnails on
  // their own CDNs rather than frames from the archive. The site's own
  // origin by name is for a branch preview on workers.dev, whose resized
  // photographs come from the live zone (`IMAGE_CDN_ORIGIN` above).
  "img-src 'self' data: blob: https://juliangigola.com https://i.ytimg.com https://i.vimeocdn.com",
  // Adobe Fonts for the `?font=v2` preview (`app/layout.tsx`): the kit's
  // stylesheet and files from use.typekit.net, its counting stylesheet
  // from p.typekit.net. Nothing loads from either without the flag.
  "font-src 'self' https://use.typekit.net",
  "style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net",
  // Cloudflare Web Analytics. The beacon is injected by the zone, not by
  // this app, so the first CSP blocked it and took the site's only analytics
  // with it — found by reading the console after deploying, not by guessing.
  // Its own POST goes to /cdn-cgi/rum on this origin, which `connect-src
  // 'self'` already covers.
  /* `player.vimeo.com` is Vimeo's player API, and it is here for one reason:
     the reel on /work/video starts at 5% volume, and Vimeo's embed takes no
     volume parameter — `muted` is all a URL can say. Setting a level needs
     `player.js`.
     
     Weighed rather than waved through: it is one origin, loaded on one route,
     after the frame is already playing, and the page works without it (the
     reel stays silent, which is the safe direction). The alternative was
     dropping the volume request or shipping sound at whatever level the
     visitor's last Vimeo session left it at. */
  `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://player.vimeo.com https://js.stripe.com https://*.js.stripe.com${__impeccableLiveDev}`,
  // The two players, and only as an embed. `frame-ancestors 'self'` above
  // is the other direction and still says no other site may frame this one.
  // 'self' is the SEO tab's frame of the site's own pages.
  // Stripe's Payment Element for the $100 deposit (`lib/booking/deposit.ts`): its
  // script and frames from js.stripe.com, 3D Secure from hooks.stripe.com,
  // and its calls to api.stripe.com.
  // `w.soundcloud.com`: SoundCloud's player, for a cover whose song is only there (`components/cover/cover-sound.tsx`).
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://w.soundcloud.com",
  // `vimeo.com` and `youtube.com` are oEmbed lookups made by /admin when a
  // link is pasted: the title, and the poster Vimeo does not publish at a
  // guessable URL. No page on the site fetches either.
  `connect-src 'self' https://api.stripe.com https://api.github.com https://vimeo.com https://www.youtube.com${__impeccableLiveDev}`,
  // The song previews on Cover art (`components/cover/cover-sound.tsx`, behind `?v4pages=c1,snd`) stream from
  // Apple's preview host. Without this line `default-src` covers media and blocks them. `blob:` is /admin's
  // preview of a clip before it is uploaded.
  "media-src 'self' blob: https://audio-ssl.itunes.apple.com",
  // Not on a local build (`LOCAL` above): there is no https on localhost.
  ...(LOCAL ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const WITH_PAYMENT = 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")';
const NO_PAYMENT = "camera=(), microphone=(), geolocation=(), payment=()";
/** Pages that never take a payment in place. `public/_headers` lists the same for the prerendered copies. */
const NO_PAYMENT_PATHS = ["/admin", "/admin/:path*", "/proof/:path*", "/delivery/:path*", "/visit", "/client/:path*"];

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin cross-site, never the path — a project URL can name a
  // client before the work is public.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Payment only for Stripe's frames: the deposit step's Apple Pay and Google Pay buttons live in a js.stripe.com
  // iframe, and `payment=()` switched them off. Site-wide because the step opens in soft navigations from any page;
  // the private routes below keep `payment=()`.
  { key: "Permissions-Policy", value: WITH_PAYMENT },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // A year, subdomains included. No `preload`: that is a one-way door onto a
  // list that is slow to leave, and it should be a deliberate decision rather
  // than a side effect of hardening headers.
  ...(LOCAL
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]),
  // The rights reservation, in the two machine-readable forms that exist.
  // `noai`/`noimageai` is the de-facto signal (DeviantArt's, honoured by a
  // growing list of crawlers); `TDM-Reservation: 1` is the W3C TDMRep
  // protocol, which is what makes the opt-out in Article 4(3) of the EU
  // copyright directive "machine-readable" and therefore effective. The
  // human-readable version is clause 5 of /legal#terms; `/robots.txt` names the
  // crawlers. None of this stops a crawler that ignores it — it makes
  // ignoring it a breach from the first request, which is the point.
  { key: "X-Robots-Tag", value: "noai, noimageai" },
  { key: "TDM-Reservation", value: "1" },
  { key: "TDM-Policy", value: "https://juliangigola.com/legal#terms" },
];

const ADMIN_HOST = "admin.juliangigola.com";
// The installed Leads app: its own origin, so its own sign-in and storage.
const LEADS_HOST = "leads.juliangigola.com";

const nextConfig: NextConfig = {
  // `next dev` refuses its scripts to other hosts; these two are the same app.
  allowedDevOrigins: [ADMIN_HOST, LEADS_HOST],
  // The build stamp `/api/build` reports (Workers Builds sets the sha), and the one version line (REL-9).
  env: {
    BUILD_SHA: process.env.WORKERS_CI_COMMIT_SHA ?? "local",
    BUILD_VERSION: SITE_VERSION,
    NEXT_PUBLIC_IMAGE_CDN_ORIGIN: IMAGE_CDN_ORIGIN,
  },
  // Hides the floating dev badge that sits over the bottom-left corner of
  // every page while `next dev` is running. It never shipped to production,
  // but it lands exactly where the masthead and the numbered index are, which
  // makes it impossible to judge the cover honestly.
  //
  // Compile and runtime errors are still surfaced — this only removes the
  // idle indicator, not the error overlay.
  devIndicators: false,

  /* The inquiry form carries up to eight reference images, shrunk in the
     browser to a few hundred KB each (`components/reference-picks.tsx`).
     Next's 1MB default would refuse the second or third. */
  experimental: {
    serverActions: { bodySizeLimit: "24mb" },
  },

  /**
   * Photographs are resized and re-encoded by Cloudflare, not by Next.
   *
   * The site runs on Workers, where Next's own optimizer is not available —
   * and would be the wrong tool anyway. The archive (public/work) ships from
   * git and is served from this origin. The loader rewrites every frame onto
   * Cloudflare Image Transformations, so the `sizes` props in the components
   * pick a file per width. See `image-loader.ts`.
   */
  images: {
    loader: "custom",
    loaderFile: "./image-loader.ts",
    /* Five rungs, not Next's eight. Every unique source-and-width is a
       transformation Cloudflare counts against 5,000 a month, so the
       ladder is the multiplier on the whole archive; the loader rounds a
       request up to the next rung. 640 for a phone, 1080 for a laptop or a
       phone at 2x (Julian's call: the 1280 would be about 40% more bytes),
       1280 for a phone at 2.6x to 3x, 1920 for most else, and 2500, the
       masters' own width, for a 4K screen, which at 1920 pixelates. */
    deviceSizes: [640, 1080, 1280, 1920, 2500],
    /* 384 for the homepage's band: five tiles to a row makes each one
       about 254px on a laptop, where the 640 would be twice the pixels. */
    imageSizes: [384],
    /* 78 everywhere a photograph is shown: about 15% lighter than the
       harvester's 82 and not a visible difference at 1:1. 82
       only for the full-size copy the viewer swaps in to be zoomed.
       Next 16 coerces any quality not listed here to the nearest one. */
    qualities: [78, 82],
  },

  // Stops naming the framework and its version to every request. Free, and
  // one less thing pointing an attacker at the right CVE list.
  poweredByHeader: false,

  async headers() {
    /* Production only, and not as a convenience — the dev server cannot run
       under this policy.
     
       Three things broke when it did. React's development build calls
       `eval()` for debugging; `connect-src 'self'` does not cover `ws:`,
       which is a different scheme, so HMR's websocket was refused; and
       `nosniff` rejected `_clientMiddlewareManifest.js`, which Next dev
       serves as `application/json` and then loads as a script.
     
       Each has a dev-only allowance, and adding three holes to a production
       policy so that a local toolchain is happy is how a policy stops meaning
       anything. Nothing is lost by skipping it here: in production these
       responses come from Cloudflare, which reads `public/_headers`, and from
       this config for anything the Worker renders. The dev server serves
       neither. */
    if (process.env.NODE_ENV === "development") return [];
    return [
      { source: "/:path*", headers: securityHeaders },
      // admin.juliangigola.com serves the whole Worker, so nothing on it is indexed.
      {
        source: "/:path*",
        has: [{ type: "host", value: ADMIN_HOST }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: LEADS_HOST }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      // /visit is unlisted: the directions page Julian sends to booked
      // clients. `public/_headers` says the same for the prerendered copy.
      { source: "/visit", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // /admin and the lead desk (Julian: "hidden from all seo"). robots.txt
      // disallows /admin and the sitemap leaves it out; this covers a crawler
      // that reaches a URL anyway. `/api/inbox` and `/api/leads` say the same on their own responses.
      { source: "/admin", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // Last, so it overrides the site-wide Permissions-Policy: no payment on the private pages or the admin hosts.
      ...NO_PAYMENT_PATHS.map((source) => ({ source, headers: [{ key: "Permissions-Policy", value: NO_PAYMENT }] })),
      ...[ADMIN_HOST, LEADS_HOST].map((value) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value }],
        headers: [{ key: "Permissions-Policy", value: NO_PAYMENT }],
      })),
    ];
  },

  /* A discipline's address is /portfolio/<slug>, beside the projects; its
     page is the `discipline` route under the work index's layout. After
     the files and before the dynamic routes, so it answers ahead of
     `/portfolio/[slug]` where a discipline and its one gallery share a
     slug (Automotive, Events, Places). */
  async rewrites() {
    const listings: { source: string; destination: string }[] = [];
    /* A local build or the dev server asks the live zone for its resized
       photographs (`LOCAL` above). Never in a Cloudflare build, where the
       zone answers `/cdn-cgi/image/` itself. */
    // admin.juliangigola.com opens the editor at its root. Before the files,
    // or the homepage answers `/` first.
    const beforeFiles = [
      { source: "/", has: [{ type: "host" as const, value: ADMIN_HOST }], destination: "/admin" },
      // leads.juliangigola.com is the Leads app, opening on Needs me.
      { source: "/", has: [{ type: "host" as const, value: LEADS_HOST }], destination: "/admin/leads" },
    ];
    if (!LOCAL && process.env.NODE_ENV !== "development") return { beforeFiles, afterFiles: listings };
    return {
      beforeFiles,
      afterFiles: [
        ...listings,
        {
          source: "/cdn-cgi/image/:path*",
          destination: "https://juliangigola.com/cdn-cgi/image/:path*",
        },
      ],
    };
  },

  async redirects() {
    // Project slugs win over category slugs where a name is used for both.
    // A booking page wins over both: /headshots was the old site's gallery,
    // and is now the page that books one (`lib/booking/slugs.ts`).
    const seen = new Set<string>(BOOKING_SLUGS.map((s) => `/${s}`));
    return [
      // The old site's graduation gallery, in its links and the index:
      // the page that books one now, not the homepage list.
      { source: "/graduation", destination: "/graduation-photos", permanent: true },
      ...pageRedirects,
      ...renameRedirects,
      ...categoryRedirects,
      ...projectRedirects,
      ...categoryPathRedirects,
      ...workRedirects,
      ...disciplineRedirects,
    ].filter((r) => {
      if (seen.has(r.source)) return false;
      seen.add(r.source);
      return true;
    });
  },
};

/* Local bindings in `next dev`.
 *
 * Without this, `getCloudflareContext()` has no `env` outside a real Worker,
 * so the contact form would take its "no inbox attached" branch on every
 * submission here and the one path worth testing — an enquiry going in and
 * coming back out of /admin — could only be tested in production. The adapter
 * stands up Miniflare with the bindings from `wrangler.jsonc`, so the KV
 * namespace is a local one on disk under `.wrangler/`.
 *
 * Development only; it is a no-op in a build. */
void initOpenNextCloudflareForDev();

export default nextConfig;
