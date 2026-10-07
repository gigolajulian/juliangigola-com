import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter_Tight, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { Intro } from "@/components/intro";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PhotoNotice } from "@/components/photo-notice";
import { SiteMenu } from "@/components/site-menu";
import { WorkFilter } from "@/components/work-filter";
import { WORK_CATEGORY_LINKS } from "@/lib/work";
import { WORK_HEADS } from "@/lib/work-heads";
import { GlassLight } from "@/components/glass-light";
import { PhotoFade } from "@/components/photo-fade";
import { PointerMark } from "@/components/pointer-mark";
import "./globals.css";
import { ImageFallback } from "@/components/image-fallback";
import { PageTransition } from "@/components/page-transition";
import { CardTilt } from "@/components/card-tilt";
import { FocusField } from "@/components/focus-field";
import { ldJson, siteGraph } from "@/lib/seo";

/* Two families and no more, at Julian's ask: Inter Tight Black for the
   name and every heading, IBM Plex Mono for everything else, text, menu,
   captions, labels, figures. Loaded through `next/font`, which fetches them
   from Google Fonts at build time and serves them from this site, so a
   visitor makes no request to Google and the text never flashes a fallback
   face. The variables are the ones the spec names; `globals.css` points
   `font-sans` at the mono so body text needs no class. */
const display = Inter_Tight({
  variable: "--font-display",
  subsets: ["latin"],
  /* 800 for the handle on a credit's card, a weight under the rest
     (Julian, 2026-10-03). */
  weight: ["800", "900"],
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});
/* Julian: the section titles (every h2 that is not a label) in Archivo
   900 capitals, from his own font file: the variable font cut to that one
   weight and to Latin (10.7 KB from 658). */
const archivo = localFont({
  src: "./fonts/Archivo-Black.woff2",
  variable: "--font-archivo",
  weight: "900",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});
/* The service boxes on About, in 500 capitals (Julian, 2026-10-05). */
const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: "500",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  /* 700 for the buttons (`action`, `cover-cta`), drawn rather than faked. */
  weight: ["400", "500", "700"],
  fallback: ["ui-monospace", "monospace"],
});

const SITE = "https://juliangigola.com";

/**
 * `viewport-fit=cover`, which Next does not set by default. Without it an
 * iPhone keeps the page out of the rounded corners and the home-indicator
 * zone, so a band at the foot of the cover ended above the bottom edge with
 * a strip of page colour under it — "make sure it covers all the way down".
 * With it the page runs to the edges and `env(safe-area-inset-bottom)`
 * becomes a real number, which the band's buttons pad by so they stay clear
 * of the indicator.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /* The browser's own bar takes the page's ground, so a phone does not
     wear a white strip over a dark site or the reverse. The two values are
     the `--background` tokens in `globals.css`, written out because a meta
     tag cannot read a custom property. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ebedef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a09" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    /* The region, with its cities in the description: San Jose has its own
       pages now (`lib/locations.ts`), which own that search. */
    default: "Julian Gigola | Photographer & Creative Director, SF Bay Area",
    // Project and section pages set only their own name; this frames it.
    template: "%s | Julian Gigola",
  },
  description:
    "Bay Area photographer and creative director. Headshots, portraits, grad photos, editorials, campaigns and music videos in San Jose, SF, Oakland and Santa Cruz.",
  openGraph: {
    type: "website",
    siteName: "Julian Gigola",
    locale: "en_US",
    /* No `url` here: set once at the root it was inherited by every page,
       so a shared /sessions link unfurled pointing at the homepage. The
       canonical on each page is the address. */
    /* The wordmark on black, at 1200x630: "Julian Gigola" in Inter Tight 900,
     * the logo's face. Julian's pick for the thumbnail (2026-10-06); it was
     * the eye mark before that, and the cover photograph before that.
     *
     * Nothing changes with the cover, so there is nothing to generate per
     * deploy: `public/og.jpg` is a committed file. book.juliangigola.com
     * uses the same card for its list page. */
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Julian Gigola",
      },
    ],
  },
  /* Named rather than inherited: Next fills `twitter:image` from the
     `opengraph-image` *file convention* on its own, but not from an
     `openGraph.images` written here — and a `summary_large_image` card with
     no image unfurls as a blank slab with the title beside it. */
  twitter: {
    card: "summary_large_image",
    images: ["/og.jpg"],
  },
  alternates: { canonical: "/" },
  // Bing Webmaster Tools ownership. Removing it unverifies the site there.
  verification: { other: { "msvalidate.01": "DEF796C06E3ACDCBF969BF1FF3E4EA6A" } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${archivo.variable} ${grotesk.variable} ${mono.variable} h-full antialiased`}
      // Dark is the default and is what the CSS already declares, so the
      // server renders the correct theme for everyone except the visitor who
      // has chosen light. That one case is what the script below fixes.
      suppressHydrationWarning
    >
      <head>
        {/* Applies the theme before the first paint: a choice made with the
         * toggle if there is one, otherwise whatever the visitor's system is
         * set to — Julian asked for the site to match how they have it set
         * up. Dark is the design and the fallback; light needs the attribute.
         *
         * It has to be inline and it has to be here: an effect runs after
         * hydration, which is several hundred milliseconds of a full-bleed
         * dark page for somebody whose system is light — the flash that
         * makes a theme feel broken. `theme-toggle.tsx` keeps following the
         * system after that, until the toggle is pressed.
         *
         * It also writes the page's colour onto both `theme-color` tags. Julian,
         * on an iPhone: the band behind the Dynamic Island came up white with
         * the site in dark. That is Safari tinting the top of the window from
         * `theme-color`, and the two tags below are keyed to the *system*
         * scheme — so a phone set to light with the site switched to dark got
         * the light colour over a black page. The tags stay for the visitor
         * with no JavaScript, and from here on both carry whichever theme is
         * actually showing; `theme-toggle.tsx` rewrites them when it changes.
         *
         * Storage throws outright in some privacy modes rather than
         * returning null, so the whole thing is wrapped; a failure there
         * still leaves the system check to run.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=location.search,f="deck-flyout";if(/[?&]flyout=1/.test(q))sessionStorage.setItem(f,"1");if(/[?&]flyout=0/.test(q))sessionStorage.removeItem(f);if(sessionStorage.getItem(f)==="1")document.documentElement.dataset.flyout="";var k="door-stack";if(/[?&]stack=0/.test(q))sessionStorage.setItem(k,"0");if(/[?&]stack=1/.test(q))sessionStorage.removeItem(k);if(sessionStorage.getItem(k)!=="0")document.documentElement.dataset.stack=""}catch(e){}var t=null;try{localStorage.removeItem("theme");t=sessionStorage.getItem("theme")}catch(e){}var l=t==="light"||(t!=="dark"&&matchMedia("(prefers-color-scheme: light)").matches);if(l)document.documentElement.dataset.theme="light";var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",l?"#ebedef":"#0b0a09")})()`,
          }}
        />
        {/* Whether this visit gets the opening, decided before the first
            paint because it cannot be decided after one: a frame of the
            site showing and then a curtain dropping over it is worse than
            no curtain at all.

            Three conditions (the first page of a visit, whichever it is,
            but not /admin; not seen yet; motion not turned down), and
            `?intro=1` to see it again on demand.
            `sessionStorage` throws outright in some privacy modes rather
            than returning null, so the whole thing is wrapped and a
            failure simply means no opening.

            Also the moment of the eye's one blink (`intro.tsx`), random,
            100 to 260ms in, picked here so the stylesheet plays it on the
            sweep's clock rather than the script's. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=location.search;try{if(/[?&]menu3d=1/.test(q))sessionStorage.setItem("jg-menu3d","1");if(/[?&]menu3d=0/.test(q))sessionStorage.removeItem("jg-menu3d");if(sessionStorage.getItem("jg-menu3d"))document.documentElement.dataset.menu3d=""}catch(e){}try{var d=(q.match(/[?&]deal=([a-z]+)/)||[])[1];if(d==="old")sessionStorage.removeItem("jg-deal");else if(d)sessionStorage.setItem("jg-deal",d);d=sessionStorage.getItem("jg-deal");if(d)document.documentElement.dataset.deal=d==="1"?"new":d}catch(e){}if(/[?&]intro=0/.test(q))return;var force=/[?&]intro=1/.test(q);var seen=false;try{seen=!!sessionStorage.getItem("jg-intro")}catch(e){}var calm=matchMedia("(prefers-reduced-motion: reduce)").matches;var admin=location.pathname.indexOf("/admin")===0;if(force||(!admin&&!seen&&!calm)){var r=document.documentElement;r.dataset.intro="1";r.style.setProperty("--jg-blink-at",Math.round(100+Math.random()*160)+"ms")}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Who Julian is, where he works and what can be booked, for
            search engines and AI answers to read rather than infer. One
            graph on every page; see `lib/seo.ts`. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldJson(siteGraph()) }}
        />
        {/* First stop for a keyboard or screen-reader visitor: the nav is
            fixed and the galleries are long, so skipping past the chrome
            matters more here than on a text site. */}
        <a
          href="#main"
          className="label sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
        >
          Skip to content
        </a>

        {/* The wall of work opens over the page on a first arrival, and the
            page is already underneath it. See `intro.tsx`. */}
        <Intro />

        <SiteHeader />
        {/* The drawer the burger opens. A sibling of the header and of
            `main`, because both of those are what it comes out from under
            — see `site-menu.tsx`. */}
        <SiteMenu />
        {/* And the one /work opens from the other side. Here rather than
            in the work route's own shell for the same reason: that shell
            is inside `main`, and `main` is what this slides out from
            under. It renders nothing off /work. */}
        <WorkFilter categories={WORK_CATEGORY_LINKS} heads={WORK_HEADS} />
        {/* Writes the pointer's position onto whichever glass control is
            under it — see `glass` in globals.css. Renders nothing. */}
        <GlassLight />
        {/* Marks lazily loaded pictures as they land so they fade in rather
            than pop — see `photo-fade.tsx`. Renders nothing. */}
        <PhotoFade />
        {/* `tabIndex={-1}` so the skip link's focus lands here and the next Tab
            is the first thing in the content, not the header again. */}
        <main id="main" tabIndex={-1} className="rise flex flex-1 flex-col outline-none">
          {/* Every page zooms in and out of the next: `page-transition.tsx`
              and `.page` in `globals.css`. */}
          <ImageFallback />
          <PageTransition>{children}</PageTransition>
        </main>
        <SiteFooter />
        {/* A phone on its side is asked to stand it up (Julian, 2026-10-04):
            the site is laid out for a phone upright. Only a phone, only on
            its side (`.turn-upright`, globals.css). */}
        <div className="turn-upright" aria-hidden>
          {/* The phone, and on its screen the small arrow of a turn (Julian:
              a spiral arrow in the phone's screen). */}
          <svg viewBox="0 0 64 64" width="88" height="88" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <g className="turn-upright-phone">
              <rect x="20" y="8" width="24" height="48" rx="4" />
              <g className="turn-upright-turn" strokeWidth="1">
                <path d="M35.5 32a3.5 3.5 0 1 1-1.03-2.47" />
                <path d="M34.75 28.25v1.6h-1.6" />
              </g>
            </g>
          </svg>
          <p className="label text-center">Turn your phone upright
            <span className="block text-muted-foreground">for the best experience</span>
          </p>
        </div>
        {/* Focus round the pointer over a gallery: `focus-field.tsx`. */}
        <FocusField />
        <CardTilt />
        <PhotoNotice />
        {/* The pointer over anything that opens large, site wide. One
            mount: it follows the pointer and shows only over `[data-ring]`,
            so every gallery and strip shares it and none carries its own. */}
        {/* And the pointer itself: the site's mark in place of the arrow.
            See `pointer-mark.tsx`. */}
        <PointerMark />
      </body>
    </html>
  );
}
