import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
// `work`, not `work-data`. The generated manifest is every project the old
// site ever had; `work.ts` is the set actually published, with hidden ones
// filtered out. Redirecting from a legacy URL to a page that is no longer
// built sends a visitor 308 → 404, which is worse than the plain 404 they
// would have got, because it looks like the site meant to take them there.
import { LINKABLE, CATEGORIES, LISTINGS, categoryHref } from "./lib/work";
import { BOOKING_SLUGS } from "./lib/booking-slugs";

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
const renameRedirects = LINKABLE.filter(
  (p): p is typeof p & { origin: string } => !!p.origin,
).flatMap((p) => [
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
 * Julian: Portfolio at /portfolio. The work lived at /work, and every
 * address under it is in the index, in his Instagram and in inboxes, so
 * each one answers with a permanent redirect to the same place under
 * /portfolio. Last, so a rename above sends an old slug straight to its new
 * one. Pages only: the photographs are still filed under `/work/`
 * (`image-loader.ts`), so nothing here matches a path with a dot in it or
 * one folder deeper than a project.
 */
const workRedirects = [
  // Julian (2026-09-29): the disciplines moved up beside the projects, so
  // /portfolio/category/editorial is /portfolio/editorial (and cover art
  // its project page) from here on.
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
  // Julian (2026-10-03): a session gallery small enough to be all there
  // is a screen of the page that books it (`contact-sheet.tsx`). Not
  // permanent while it is new.
  { source: "/portfolio/headshots", destination: "/headshots#work", permanent: false },
  { source: "/portfolio/graduation", destination: "/graduation-photos#work", permanent: false },
  // Julian: change Studio to About. The page moved; the old name follows.
  { source: "/studio", destination: "/#about", permanent: true },
  // Julian: About and Contact are homepage screens now. The query rides
  // along, so /contact?type=session still fills the form in.
  { source: "/about", destination: "/#about", permanent: true },
  { source: "/contact", destination: "/#contact", permanent: true },
  // /rates never got written — it still served the Format demo's biography.
  // Sessions is where a rate question actually gets answered now.
  { source: "/rates", destination: "/#sessions", permanent: true },
  // Julian: Sessions is a homepage screen now, and the page is gone.
  { source: "/sessions", destination: "/#sessions", permanent: true },
  { source: "/links", destination: "/#contact", permanent: true },
  // There was a cart in the header but nothing behind it.
  { source: "/store", destination: "/", permanent: true },
  // "Wedding" (33 frames) was folded into the Weddings gallery; the project
  // is hidden now and its frames live in the gallery's sequence.
  { source: "/work/bridal", destination: "/portfolio/weddings", permanent: true },
  { source: "/portfolio/bridal", destination: "/portfolio/weddings", permanent: true },
  // The terms and the privacy policy were two pages for a day; they are two
  // columns of one now, and the footer links straight to the anchors.
  // GISELLE was at its full gallery name and is at its own now. Both of
  // the old URLs are in the index and in Julian's own links.
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

/**
 * Security headers.
 *
 * The site was sending none — no CSP, no framing policy, no sniff
 * protection, no referrer policy, and `x-powered-by: Next.js` naming the
 * stack to anyone who asked. Cloudflare terminates TLS and enforces HTTPS,
 * which covers transport and nothing above it.
 *
 * `script-src` keeps `'unsafe-inline'`, and that is a deliberate limit rather
 * than an oversight. Next inlines its hydration payload as `<script>` tags in
 * every prerendered page, and the theme script in `app/layout.tsx` has to run
 * before first paint — nonces need a dynamic render, which this build does
 * not do. So CSP here is not an XSS backstop; it is a boundary on *where*
 * script, frames and connections may come from, which is worth having on its
 * own. The site renders no HTML from content, so there is no injection sink
 * for the inline allowance to widen.
 *
 * The specific allowances, each for one real reason:
 *   blob:            /admin previews a chosen photograph from an object URL
 *                    before it has been uploaded anywhere.
 *   api.github.com   /admin commits through the GitHub API from the browser.
 *   youtube/vimeo    /work/video embeds films from both. Four allowances,
 *                    each narrow: the two player origins in `frame-src`, the
 *                    two thumbnail CDNs in `img-src`, and the two oEmbed
 *                    endpoints in `connect-src` — which only /admin uses, to
 *                    read a title and a poster off a pasted link.
 *
 *                    `youtube-nocookie.com` rather than `youtube.com` for the
 *                    player: the ordinary domain sets an advertising cookie
 *                    on load, and this site has no cookie banner to justify
 *                    one. Nothing from either loads until a visitor presses
 *                    play (see `components/video-grid.tsx`), so the policy is
 *                    the boundary and the click is the consent.
 */
// Dev-only allowance so impeccable live mode can load. Guarded by NODE_ENV.
const __impeccableLiveDev =
  process.env.NODE_ENV === "development" ? " http://localhost:8400" : "";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Nothing here is meant to be embedded. Two spellings of one rule, because
  // `frame-ancestors` is the real one and `X-Frame-Options` below is what
  // older browsers read.
  "frame-ancestors 'none'",
  "form-action 'self'",
  // The provider stills for the video page, which are 16:9 thumbnails on
  // their own CDNs rather than frames from the archive.
  "img-src 'self' data: blob: https://i.ytimg.com https://i.vimeocdn.com",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
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
  `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://player.vimeo.com${__impeccableLiveDev}`,
  // The two players, and only as an embed — `frame-ancestors 'none'` above
  // is the other direction and still says nobody may frame this site.
  // And the booking calendars on /book and the session pages (Google Calendar
  // appointment schedules, `components/book-picker.tsx`, `components/contact-screen.tsx`).
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://calendar.google.com",
  // `vimeo.com` and `youtube.com` are oEmbed lookups made by /admin when a
  // link is pasted: the title, and the poster Vimeo does not publish at a
  // guessable URL. No page on the site fetches either.
  `connect-src 'self' https://api.github.com https://vimeo.com https://www.youtube.com${__impeccableLiveDev}`,
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin cross-site, never the path — a project URL can name a
  // client before the work is public.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // A year, subdomains included. No `preload`: that is a one-way door onto a
  // list that is slow to leave, and it should be a deliberate decision rather
  // than a side effect of hardening headers.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
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

const nextConfig: NextConfig = {
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
   * DialKit on the dev server only (Julian). A production build gets
   * `lib/dialkit-stub.ts` in its place: the configs' defaults and no panel,
   * so visitors no longer download 72KB gzipped of tuning panels they never
   * saw (the audit, 2026-10-02).
   */
  turbopack: {
    resolveAlias:
      process.env.NODE_ENV === "production" ? { dialkit: "./lib/dialkit-stub.ts" } : {},
  },

  /**
   * Photographs are resized and re-encoded by Cloudflare, not by Next.
   *
   * The site runs on Workers, where Next's own optimizer is not available —
   * and would be the wrong tool anyway, because the archive is not served
   * from this origin. It lives in R2. The loader rewrites every frame onto
   * Cloudflare Image Transformations, which is what finally makes the `sizes`
   * props in the components mean something: under the old static export the
   * loader ignored `width` entirely and every device downloaded the same
   * 1600px file. See `image-loader.ts`.
   */
  images: {
    loader: "custom",
    loaderFile: "./image-loader.ts",
    /* Three widths, not Next's eight. Every width a browser can ask for is
       a separate transformation, billed per unique source-and-size and
       counted against 5,000 a month included. 640 covers a phone, 1080 a
       laptop and a phone at 2x, 1920 everything else; the loader rounds a
       request up to the next one. `imageSizes` is kept for the small slots
       — the index panel, a picker thumbnail. */
    /* 1280 for a phone at 2.6x to 3x: a 100vw tile there needs 1050 to
       1170px and was rounding up to 1920, on every tile of / and /work.
       2500, the masters' own width, for a big dense screen: a 4K monitor
       at 150% shows a landscape frame 1907css wide and needs 2861px, and
       at 1920 it was drawn at two thirds density, which Julian saw as
       pixelated. */
    /* Five rungs, not eight. Every unique source-and-width is a
       transformation Cloudflare counts for the month, so the ladder is
       the multiplier on the whole archive: 1080 went because 1280 is
       18% more pixels and nobody can see the difference, and 128 went
       because nothing on the site is drawn that small. */
    deviceSizes: [640, 1280, 1920, 2500],
    /* 384 for the homepage's band: five tiles to a row makes each one
       about 254px on a laptop, and with `sizes` saying a third of the
       window every one of them was fetching the 640. */
    imageSizes: [384],
    /* 78 everywhere a photograph is shown: about 15% lighter than the
       harvester's 82 and not a difference Julian could see at 1:1. 82
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  /* A discipline's address is /portfolio/<slug>, beside the projects; its
     page is the `discipline` route under the work index's layout. After
     the files and before the dynamic routes, so it answers ahead of
     `/portfolio/[slug]` where a discipline and its one gallery share a
     slug (Automotive, Events, Places). */
  async rewrites() {
    return LISTINGS.map((c) => ({
      source: `/portfolio/${c.slug}`,
      destination: `/portfolio/discipline/${c.slug}`,
    }));
  },

  async redirects() {
    // Project slugs win over category slugs where a name is used for both.
    // A booking page wins over both: /headshots was the old site's gallery,
    // and is now the page that books one (`lib/booking-slugs.ts`).
    const seen = new Set<string>(BOOKING_SLUGS.map((s) => `/${s}`));
    return [
      // The old site's graduation gallery, in its links and the index:
      // the page that books one now, not the homepage list.
      { source: "/graduation", destination: "/graduation-photos", permanent: true },
      ...pageRedirects,
      ...renameRedirects,
      ...categoryRedirects,
      ...projectRedirects,
      ...workRedirects,
    ].filter(
      (r) => {
        if (seen.has(r.source)) return false;
        seen.add(r.source);
        return true;
      },
    );
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
