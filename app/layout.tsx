import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Intro } from "@/components/intro";
import { SiteFooter } from "@/components/site-footer";
import { PhotoNotice } from "@/components/photo-notice";
import { GlassLight } from "@/components/glass-light";
import { PhotoFade } from "@/components/photo-fade";
import { TextCaret } from "@/components/text-caret";
import { NavMemo } from "@/components/back-link";
import { PageFly } from "@/components/v3/page-fly";
import { THEME_COLOR } from "@/lib/theme-color";
import "./globals.css";
import { ImageFallback } from "@/components/image-fallback";
import { PageTransition } from "@/components/page-transition";
import { CardTilt } from "@/components/card-tilt";
import { HoverSettle } from "@/components/hover-settle";
import { FocusField } from "@/components/focus-field";
import { ldJson, siteGraph } from "@/lib/seo";
import { DebugGate } from "@/components/debug-gate";
import { TypeDials } from "@/components/type-dials";
import { clips, DEFAULTS, LATE, LEVELS, LIQUID, SKIP, sizesOf, typeSizer } from "@/lib/type-size";
import { VisitTrail } from "@/components/visit-trail";
import { ClickBeacon } from "@/components/click-beacon";
import { LegacyHeader, LegacyMenu, MotionGate, OnLegacy, OnV3, V3Footer, V3Header } from "@/components/v3/chrome";
import { ScrollThumb } from "@/components/v3/scroll-thumb";
import { SmoothScroll } from "@/components/v3/smooth-scroll";
import { ScrollReveal } from "@/components/v3/scroll-reveal";

/* JG V3 (DESIGN.md): Inter Tight for the display type and the wordmark,
   IBM Plex Mono for everything else. No other faces. Served from this site
   through `next/font`, so a visitor makes no request to Google.
   `--font-wordmark` points at the same face (`styles/v3.css`).
   The files are committed rather than fetched by `next/font/google`
   (latin, latin-ext A, arrows and punctuation, cut from google/fonts with
   pyftsubset; Inter Tight limited to wght 500-900). That fetch failed
   Turbopack on the v3.0.2 and v3.0.3 production builds, 21 "Can't resolve
   .../font/google/font" errors, and a retry passed. A build must not
   depend on Google answering. */
const display = localFont({
  variable: "--font-display",
  src: "./fonts/InterTight-Variable.woff2",
  weight: "500 900",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
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
    /* The region, with its cities in the description: San Jose has its own
       pages now (`lib/locations.ts`), which own that search. */
    default: "Julian Gigola | Photographer & Creative Director, SF Bay Area",
    // Project and section pages set only their own name; this frames it.
    template: "%s | Julian Gigola",
  },
  description:
    "Photographer and creative director based in the San Francisco Bay Area. Fashion editorial, commercial campaigns and artist development. Available worldwide.",
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

/* Font v2's sizes before the first paint (Julian: the text grew and moved
   about 1.4s after load, when `type-dials.tsx` first sized it). The same
   sizing, run as the parser reaches the foot of the page; `type-dials.tsx`
   takes over what it sized, and fits it again once the faces are in.
   The cover's two lines (`LATE`) and text in clipping boxes (`clips`) are
   left to that later pass, as before. Chrome holds the first paint until then
   (`rel="expect"` in the head). */
const TYPE_EARLY = `(function(){try{if(document.documentElement.dataset.font!=="v2")return;var s=(${typeSizer.toString()})(${JSON.stringify(LEVELS)},${JSON.stringify(sizesOf(DEFAULTS))},${JSON.stringify(SKIP)},${JSON.stringify(LIQUID)});s.scan([document.body],${JSON.stringify(`${SKIP}, ${LATE}`)},${clips.toString()});s.fit();window.__jgType=s}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable} h-full antialiased`}
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
            __html: `(function(){try{var q=location.search,f="deck-flyout";if(/[?&]flyout=1/.test(q))sessionStorage.setItem(f,"1");if(/[?&]flyout=0/.test(q))sessionStorage.removeItem(f);if(sessionStorage.getItem(f)==="1")document.documentElement.dataset.flyout="";var k="door-stack";if(/[?&]stack=0/.test(q))sessionStorage.setItem(k,"0");if(/[?&]stack=1/.test(q))sessionStorage.removeItem(k);if(sessionStorage.getItem(k)!=="0")document.documentElement.dataset.stack=""}catch(e){}var t=null;try{localStorage.removeItem("theme");t=sessionStorage.getItem("theme")}catch(e){}var l=t==="light"||(t!=="dark"&&matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.dataset.theme=l?"light":"dark";var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",l?"#ebedef":"#0b0a09")})()`,
          }}
        />
        {/* Font v2 (`app/styles/font-v2.css`), off since V3 (Inter Tight and
            Plex Mono only). `?font=v2` brings it back for the tab, `?font=0`
            clears it. Before the first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=location.search,k="jg-font";if(/[?&]font=v2/.test(q))sessionStorage.setItem(k,"v2");if(/[?&]font=0/.test(q))sessionStorage.removeItem(k);if(sessionStorage.getItem(k)!=="v2")return;document.documentElement.dataset.font="v2";var l=document.createElement("link");l.rel="stylesheet";l.href="https://use.typekit.net/wxg8xur.css";document.head.appendChild(l)}catch(e){}})()`,
          }}
        />
        {/* Whether this visit gets the opening, decided before the first
            paint because it cannot be decided after one: a frame of the
            site showing and then a curtain dropping over it is worse than
            no curtain at all.

            Three conditions (the first page of a visit, whichever it is,
            but not /admin; not seen yet; motion not turned down), and
            `?intro=1` to see it again on demand. `?splash=basic` plays
            the basicagency.com preview instead (`intro.tsx`). On the
            homepage the opening is the burst (`burst-splash.ts`, Julian
            2026-10-28), which lands on the hero; other pages, which have
            no hero to land on, and `?splash=sheet` keep the contact sheet.
            `sessionStorage` throws outright in some privacy modes rather
            than returning null, so the whole thing is wrapped and a
            failure simply means no opening.

            Also the moment of the eye's one blink (`intro.tsx`), random,
            100 to 260ms in, picked here so the stylesheet plays it on the
            sweep's clock rather than the script's. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var mo=true;try{var k3="jg-v3motion-off",q3=location.search;if(/[?&]v3motion=0/.test(q3))sessionStorage.setItem(k3,"1");else if(/[?&]v3motion/.test(q3))sessionStorage.removeItem(k3);mo=!sessionStorage.getItem(k3)}catch(e){}if(mo)document.documentElement.dataset.v3motion="";try{var kb="jg-solidhdr";if(/[?&]blur=0/.test(q3))sessionStorage.setItem(kb,"1");else if(/[?&]blur/.test(q3))sessionStorage.removeItem(kb);if(sessionStorage.getItem(kb))document.documentElement.dataset.solidhdr=""}catch(e){}try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.gather="";document.documentElement.dataset.moves=""}}catch(e){}try{var q=location.search;try{if(/[?&]menu3d=1/.test(q))sessionStorage.setItem("jg-menu3d","1");if(/[?&]menu3d=0/.test(q))sessionStorage.removeItem("jg-menu3d");if(sessionStorage.getItem("jg-menu3d"))document.documentElement.dataset.menu3d=""}catch(e){}try{if(/[?&]sleeve=1/.test(q))sessionStorage.setItem("jg-sleeve","1");if(/[?&]sleeve=0/.test(q))sessionStorage.removeItem("jg-sleeve");if(sessionStorage.getItem("jg-sleeve"))document.documentElement.dataset.sleeve=""}catch(e){}if(/[?&]intro=0/.test(q)||!mo)return;var basic=/[?&]splash=basic/.test(q);var sand=/[?&]splash=sand/.test(q);var burst=/[?&]splash=burst/.test(q);var force=basic||sand||burst||/[?&]intro=1/.test(q);var seen=false;try{seen=!!sessionStorage.getItem("jg-intro")}catch(e){}var calm=matchMedia("(prefers-reduced-motion: reduce)").matches;var admin=location.pathname.indexOf("/admin")===0;if(force||(!admin&&!seen&&!calm)){var r=document.documentElement;r.dataset.intro="1";if(sand)r.dataset.splash="sand";if(burst||(location.pathname==="/"&&!basic&&!sand&&!/[?&]splash=sheet/.test(q)))r.dataset.splash="burst";if(basic){r.dataset.splash="basic";setTimeout(function(){r.dataset.intro="half";r.dataset.splashed="";setTimeout(function(){r.removeAttribute("data-intro");r.removeAttribute("data-splash")},1200)},500)}r.style.setProperty("--jg-blink-at",Math.round(100+Math.random()*160)+"ms")}}catch(e){}})()`,
          }}
        />
        {process.env.NODE_ENV === "production" ? (
          <link rel="expect" href="#jg-sized" {...{ blocking: "render" }} />
        ) : null}
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

        {/* The contact sheet opens over the page on a first arrival, and the
            page is already underneath it. See `intro.tsx`. Not behind
            MotionGate: that renders nothing on the server, and the sheet
            has to be in the HTML to start before hydration. The head
            script above sets `data-intro` on a first arrival unless `?v3motion=0`. */}
        <Intro />

        <OnLegacy>
          <LegacyHeader />
        </OnLegacy>
        <OnV3>
          <V3Header />
          <ScrollThumb />
          <SmoothScroll />
          <ScrollReveal />
        </OnV3>
        {/* Where a visit began and what it read, for an inquiry to carry. */}
        <VisitTrail />
        {/* The drawer the burger opens. A sibling of the header and of
            `main`, because both of those are what it comes out from under
            — see `site-menu.tsx`. */}
        <OnLegacy>
          <LegacyMenu />
        </OnLegacy>
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
        <OnLegacy>
          <SiteFooter />
        </OnLegacy>
        <OnV3>
          <V3Footer />
        </OnV3>
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
        <PageFly />
        {/* fps, finger dots and a frame log, only with `?debug`. The
            overlay itself loads only then: `debug-gate.tsx`. */}
        <DebugGate />
        <TypeDials />
        {/* Clicks and scroll depth for /admin's SEO tab, one beacon per
            page view, no cookie. See `click-beacon.tsx`. Renders nothing. */}
        <ClickBeacon />
        {/* Production only: on the dev server React reports the sizes as
            a hydration mismatch, and its double mount undoes them. */}
        {process.env.NODE_ENV === "production" ? (
          <>
            <script dangerouslySetInnerHTML={{ __html: TYPE_EARLY }} />
            <div id="jg-sized" hidden />
          </>
        ) : null}
      </body>
    </html>
  );
}
