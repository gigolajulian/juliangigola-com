import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
// `work`, not `work-data`. The generated manifest is every project the old
// site ever had; `work.ts` is the set actually published, with hidden ones
// filtered out. Redirecting from a legacy URL to a page that is no longer
// built sends a visitor 308 → 404, which is worse than the plain 404 they
// would have got, because it looks like the site meant to take them there.
import { PROJECTS, CATEGORIES, categoryHref } from "./lib/work";

/**
 * The old site published every project at the site root — `/wired-magazine`,
 * `/dystopia`, `/sago`. Those URLs are in Instagram bios, in email threads,
 * and in Google's index, so all of them have to keep working.
 *
 * Generated from the manifest rather than typed out, so a project added or
 * renamed later cannot fall out of the list.
 */
const projectRedirects = PROJECTS.map((p) => ({
  source: `/${p.slug}`,
  destination: `/work/${p.slug}`,
  permanent: true,
}));

/**
 * Old category pages. Each one lands on that discipline's own page now, so an
 * indexed `/editorial` arrives at the editorial work rather than at seventy
 * projects with a filter still to apply. `categoryHref` handles the two edge
 * cases — a category that is itself one gallery, and one with no work yet.
 */
const categoryRedirects = CATEGORIES.map((c) => ({
  source: `/${c.slug}`,
  destination: c.section === "SESSIONS" ? "/sessions" : categoryHref(c.slug),
  permanent: true,
}));

/** Pages that moved or were retired. */
const pageRedirects = [
  { source: "/about", destination: "/studio", permanent: true },
  // /rates never got written — it still served the Format demo's biography.
  // Sessions is where a rate question actually gets answered now.
  { source: "/rates", destination: "/sessions", permanent: true },
  { source: "/links", destination: "/contact", permanent: true },
  // There was a cart in the header but nothing behind it.
  { source: "/store", destination: "/", permanent: true },
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
     the reel on /work/video starts at 15% volume, and Vimeo's embed takes no
     volume parameter — `muted` is all a URL can say. Setting a level needs
     `player.js`.
     
     Weighed rather than waved through: it is one origin, loaded on one route,
     after the frame is already playing, and the page works without it (the
     reel stays silent, which is the safe direction). The alternative was
     dropping the volume request or shipping sound at whatever level the
     visitor's last Vimeo session left it at. */
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://player.vimeo.com",
  // The two players, and only as an embed — `frame-ancestors 'none'` above
  // is the other direction and still says nobody may frame this site.
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  // `vimeo.com` and `youtube.com` are oEmbed lookups made by /admin when a
  // link is pasted: the title, and the poster Vimeo does not publish at a
  // guessable URL. No page on the site fetches either.
  "connect-src 'self' https://api.github.com https://vimeo.com https://www.youtube.com",
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
  images: { loader: "custom", loaderFile: "./image-loader.ts" },

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

  async redirects() {
    // Project slugs win over category slugs where a name is used for both.
    const seen = new Set<string>();
    return [...pageRedirects, ...categoryRedirects, ...projectRedirects].filter(
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
