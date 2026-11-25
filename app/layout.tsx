import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Intro } from "@/components/splash/intro";
import { JG_INNER } from "@/components/splash/jg-cover";
import { SPLASH_RUN } from "@/lib/work/splash-run";
import { PhotoNotice } from "@/components/site/photo-notice";
import { GlassLight } from "@/components/effects/glass-light";
import { PhotoFade } from "@/components/effects/photo-fade";
import { TextCaret } from "@/components/effects/text-caret";
import { NavMemo } from "@/components/site/back-link";
import { PageFly } from "@/components/site/page-fly";
import { THEME_COLOR } from "@/lib/theme-color";
import "./globals.css";
import { ImageFallback } from "@/components/site/image-fallback";
import { PageTransition } from "@/components/site/page-transition";
import { CardTilt } from "@/components/effects/card-tilt";
import { HoverSettle } from "@/components/effects/hover-settle";
import { FocusField } from "@/components/contact/focus-field";
import { ldJson, siteGraph } from "@/lib/og/seo";
import { DebugGate } from "@/components/dev/debug-gate";
import { VisitTrail } from "@/components/analytics/visit-trail";
import { ClickBeacon } from "@/components/analytics/click-beacon";
import { MotionGate, SiteFooter, SiteHeader } from "@/components/site/chrome";
import { ScrollThumb } from "@/components/site/scroll-thumb";
import { SmoothScroll } from "@/components/site/smooth-scroll";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { V4PAGES_HEAD } from "@/lib/flags/v4pages";
import { SKY_HEAD } from "@/lib/flags/sky-flag";

/* JG V3 (DESIGN.md): Inter Tight for the display type and the wordmark,
   IBM Plex Mono for everything else, and Archivo Expanded for the booking
   card's big numbers only (`--font-figures`). No other faces. Served from this site
   through `next/font`, so a visitor makes no request to Google.
   `--font-wordmark` points at the same face (`styles/v3.css`).
   The files are committed rather than fetched by `next/font/google`
   (latin, latin-ext A, arrows and punctuation, cut from google/fonts with
   pyftsubset; Inter Tight limited to wght 500-900): a build must not
   depend on Google answering. */
const display = localFont({
  variable: "--font-display",
  src: "./fonts/InterTight-Variable.woff2",
  weight: "500 900",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});
/* Archivo 800 at 125% width (OFL), cut to 0-9 : $ , and space, 2.4KB.
   Any other character falls through to Inter Tight. */
const figures = localFont({
  variable: "--font-figures",
  src: "./fonts/ArchivoExpanded-Figures.woff2",
  weight: "800",
  adjustFontFallback: false,
  // Only the booking card uses it, so it loads when the card draws, not on every page.
  preload: false,
});
const mono = localFont({
  variable: "--font-mono",
  /* 700 for the buttons (`action`, `cover-cta`), drawn rather than faked. */
  src: [
    { path: "./fonts/IBMPlexMono-400.woff2", weight: "400" },
    { path: "./fonts/IBMPlexMono-500.woff2", weight: "500" },
    { path: "./fonts/IBMPlexMono-700.woff2", weight: "700" },
  ],
  fallback: ["ui-monospace", "monospace"],
  /* The automatic fallback is Arial, proportional and wider than Plex, so
     the cover's role line wrapped until Plex landed (CLS on phones). A
     monospace fallback already has Plex's 0.6em advance. */
  adjustFontFallback: false,
});

/* Geist Mono (OFL) for the hero tagline only, so it reads clearly.
   Cut to A-Z, a-z, space and "|", weights 400-600, 5KB. */
const tagline = localFont({
  variable: "--font-tagline",
  src: "./fonts/GeistMono-Tagline.woff2",
  weight: "400 600",
  fallback: ["ui-monospace", "monospace"],
  adjustFontFallback: false,
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
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    /* The region only: the cities are in JSON-LD `areaServed` (lib/og/seo.ts), and San Jose has its own
       pages now, which own that search. */
    default: "Julian Gigola | Photographer & Creative Director, SF Bay Area",
    // Project and section pages set only their own name; this frames it.
    template: "%s | Julian Gigola",
  },
  description:
    "Photographer and creative director based in the San Francisco Bay Area. Fashion editorials, brand campaigns, cover art and music videos. Available worldwide.",
  openGraph: {
    type: "website",
    siteName: "Julian Gigola",
    locale: "en_US",
    /* No `url` here: set once at the root it was inherited by every page,
       so a shared /sessions link unfurled pointing at the homepage. The
       canonical on each page is the address. */
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  // Bing Webmaster Tools ownership. Removing it unverifies the site there.
  verification: { other: { "msvalidate.01": "DEF796C06E3ACDCBF969BF1FF3E4EA6A" } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable} ${figures.variable} ${tagline.variable} h-full antialiased`}
      // Dark is the default and is what the CSS already declares, so the
      // server renders the correct theme for everyone except the visitor who
      // has chosen light. That one case is what the script below fixes.
      suppressHydrationWarning
      // Static: every page runs the v4 home's styles, and mtscroll.css and the home's CSS select on it.
      data-mtscroll=""
    >
      <head>
        {/* Applies the theme before the first paint: a choice made with the
         * toggle if there is one, otherwise whatever the visitor's system is
         * set to (Julian's call). Dark is the design and the fallback; light needs the attribute.
         *
         * It has to be inline and it has to be here: an effect runs after
         * hydration, which is several hundred milliseconds of a full-bleed
         * dark page for somebody whose system is light — the flash that
         * makes a theme feel broken. `components/site/chrome.tsx` keeps following the
         * system after that, until the toggle is pressed.
         *
         * It also writes the page's colour onto both `theme-color` tags. Julian,
         * on an iPhone: the band behind the Dynamic Island came up white with
         * the site in dark. That is Safari tinting the top of the window from
         * `theme-color`, and the two tags below are keyed to the *system*
         * scheme — so a phone set to light with the site switched to dark got
         * the light colour over a black page. The tags stay for the visitor
         * with no JavaScript, and from here on both carry whichever theme is
         * actually showing; `components/site/chrome.tsx` rewrites them when it changes.
         *
         * The proof gate's wall (the default; `?proofwall=0` for the plain gate) is always dark.
         *
         * Storage throws outright in some privacy modes rather than
         * returning null, so the whole thing is wrapped; a failure there
         * still leaves the system check to run.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=null;try{t=sessionStorage.getItem("theme")}catch(e){}var l=t==="light"||(t!=="dark"&&matchMedia("(prefers-color-scheme: light)").matches);if((location.pathname.indexOf("/proof")===0||location.pathname.indexOf("/delivery")===0)&&!/[?&]proofwall=0/.test(location.search)){l=false;document.documentElement.dataset.proofwall=""}document.documentElement.dataset.theme=l?"light":"dark";var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",l?"#ffffff":"#000000")})()`,
          }}
        />
        {/* Whether this visit gets the opening, decided before the first
            paint because it cannot be decided after one: a frame of the
            site showing and then a curtain dropping over it is worse than
            no curtain at all.

            The homepage's opening is `data-mt-intro` (not seen yet; motion
            not turned down; `?intro=1` to see it again, `?intro=0` to skip).
            A first arrival on an inner page gets the booking wait's JG cover
            instead, once a visit on its own key (`jg-cover-intro`), so the
            homepage's opening still plays when the visitor gets there
            (Julian, 2026-11-21: "A, once per visit"). Not on /book, which
            puts up its own. `?splash=split` on an inner page still plays the
            old split opening (`split-splash.ts`) as a test link.
            `sessionStorage` throws outright in some privacy modes rather
            than returning null, so the whole thing is wrapped and a
            failure simply means no opening. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){document.documentElement.dataset.v3motion="";document.documentElement.dataset.navfx="";try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.moves=""}}catch(e){}try{var q=location.search;var mt=location.pathname==="/";if(mt&&!/[?&]intro=0/.test(q)&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&(/[?&]intro=1/.test(q)||!sessionStorage.getItem("jg-intro"))){var rr=document.documentElement;rr.dataset.mtIntro="1";setTimeout(function(){if(rr.dataset.mtIntro==="1"&&!("mtOwn" in rr.dataset)){delete rr.dataset.mtIntro;rr.dataset.mtLate=""}},6000)}if(/[?&]intro=0/.test(q)||mt)return;var split=/[?&]splash=split/.test(q);var calm=matchMedia("(prefers-reduced-motion: reduce)").matches;var admin=location.pathname.indexOf("/admin")===0||location.pathname.indexOf("/proof/")===0||location.pathname.indexOf("/delivery/")===0||location.pathname.indexOf("/contract/")===0||/^(admin|leads)[.]/.test(location.hostname);if(location.pathname.indexOf("/book")!==0&&!admin&&!calm){var kc="jg-cover-intro",sc=false;try{sc=!!sessionStorage.getItem(kc);sessionStorage.setItem(kc,"1")}catch(e){sc=true}if(!sc||/[?&]intro=1/.test(q))document.documentElement.dataset.coverIntro=""}if(split){var r=document.documentElement;r.dataset.intro="1";r.dataset.splash="split"}}catch(e){}})()`,
          }}
        />
        {/* `data-v4pages`: what is left of the inner-pages plan on trial (lib/flags/v4pages.ts). `?v4pages` turns
            every key on for the tab, `?v4pages=view` only that, `?v4pages=0` off.
            With no choice made in the tab every key is on. */}
        <script
          dangerouslySetInnerHTML={{
            __html: V4PAGES_HEAD,
          }}
        />
        {/* `data-sky`: the time picker in the hour's light, on unless `?sky=0` (lib/flags/sky-flag.ts). */}
        <script dangerouslySetInnerHTML={{ __html: SKY_HEAD }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* The JG cover for a first arrival on an inner page (`data-cover-intro`, set in the head), up before the
            first paint like the booking wait's and opened once the page is ready (`jg-cover.ts`, `JG_INNER`). */}
        <script dangerouslySetInnerHTML={{ __html: `if("coverIntro" in document.documentElement.dataset){${JG_INNER}}` }} />
        {/* Who Julian is, where he works and what can be booked, for
            search engines and AI answers to read rather than infer. One
            graph on every page; see `lib/og/seo.ts`. */}
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

        {/* The splash opens over the page on a first arrival, and the
            page is already underneath it. See `intro.tsx`. Not behind
            MotionGate: that renders nothing on the server, and the splash
            has to be in the HTML to start before hydration. The head
            script above sets `data-intro` on a first arrival. */}
        <Intro run={SPLASH_RUN} />

        <SiteHeader />
        <ScrollThumb />
        <SmoothScroll />
        <ScrollReveal />
        {/* Where a visit began and what it read, for an inquiry to carry. */}
        <VisitTrail />
        {/* Writes the pointer's position onto whichever glass control is
            under it — see `glass` in globals.css. Renders nothing. */}
        <MotionGate>
          <GlassLight />
        </MotionGate>
        {/* Marks lazily loaded pictures as they land so they fade in rather
            than pop — see `photo-fade.tsx`. Renders nothing. */}
        <MotionGate>
          <PhotoFade />
        </MotionGate>
        {/* `tabIndex={-1}` so the skip link's focus lands here and the next Tab
            is the first thing in the content, not the header again. */}
        <main id="main" tabIndex={-1} className="rise flex flex-1 flex-col outline-none">
          {/* Every page zooms in and out of the next: `page-transition.tsx`
              and `.page` in `globals.css`. */}
          <ImageFallback />
          {/* Always mounted: swapping a fallback for it after hydration
              rebuilt the whole page. It gates its own motion. */}
          <PageTransition>{children}</PageTransition>
        </main>
        <SiteFooter />
        {/* Focus round the pointer over a gallery: `focus-field.tsx`. */}
        <MotionGate>
          <FocusField />
          <CardTilt />
          {/* A photograph's hover waits 600ms after a page lands: `hover-settle.tsx`. */}
          <HoverSettle />
        </MotionGate>
        <PhotoNotice />
        {/* The pointer over anything that opens large, site wide. One
            mount: it follows the pointer and shows only over `[data-ring]`,
            so every gallery and strip shares it and none carries its own. */}
        <TextCaret />
        <NavMemo />
        {/* After PageTransition: it holds a Back and replays the popstate, which PageFly's own listener then sees. */}
        <PageFly />
        {/* fps, finger dots and a frame log, only with `?debug`. The
            overlay itself loads only then: `debug-gate.tsx`. */}
        <DebugGate />
        {/* Clicks and scroll depth for /admin's SEO tab, one beacon per
            page view, no cookie. See `click-beacon.tsx`. Renders nothing. */}
        <ClickBeacon />
      </body>
    </html>
  );
}
