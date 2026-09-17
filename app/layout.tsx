import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PhotoNotice } from "@/components/photo-notice";
import { GlassLight } from "@/components/glass-light";
import { PhotoFade } from "@/components/photo-fade";
import { PointerRing } from "@/components/pointer-ring";
import "./globals.css";
import { PageTransition } from "@/components/page-transition";

/* Inter for everything that is read rather than announced, at Julian's ask.
   It pairs with the masthead the way the Swiss posters did: one condensed
   and heavy face for the name and the titles, one neutral face at text
   sizes underneath, and no third voice competing with either.

   Inter rather than the Geist it replaces for two things it does that the
   site actually uses. Its figures can be set to one width, so the counts
   down the cover's index and the frame counters no longer shuffle sideways
   as they change. And it carries an optical size axis, so the same family
   is drawn for a 11px label and a 16px paragraph instead of one drawing
   being scaled to both.

   `globals.css` resolves `font-sans` from `--font-sans` (shadcn's theme
   block names it that), so the variable has to match. */
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Declared but not preloaded. `font-mono` is set in three places and all
// three are in /admin — a token field, a key field, a log — yet the 29kB
// woff2 was in a `<link rel="preload">` on every page of the site, fetched
// before first paint for text nobody outside /admin ever sees. Without the
// preload the browser fetches it when a page first uses it, which is what a
// font that one route needs should do.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

// Univers Bold Condensed for the masthead and project titles.
//
// Frutiger, 1957 — the same grotesque that set Swiss poster design and has
// not looked dated since. Condensed and heavy, so a name or a project title
// holds its own against a photograph without needing to be enormous.
//
// Self-hosted rather than pulled from a CDN: `next/font/local` inlines the
// @font-face, hashes the filename, and preloads it, so there is no
// third-party request and no flash of fallback text.
const display = localFont({
  src: "./fonts/OPTIUniversSixtySeven.otf",
  variable: "--font-display",
  display: "swap",
  // The one weight this file contains. Declaring it means `font-display` text
  // is never synthetically emboldened on top of an already-bold face.
  weight: "700",
  style: "normal",
  // No tracking adjustment. The face is drawn tight and is set tight
  // everywhere — see `display` in `globals.css`.
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
    { media: "(prefers-color-scheme: light)", color: "#efece7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a09" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Julian Gigola, Photographer & Creative Director, Bay Area",
    // Project and section pages set only their own name; this frames it.
    template: "%s | Julian Gigola",
  },
  description:
    "Editorial, campaign, and artist photography from the San Francisco Bay Area. Published in WIRED. Available for commissions and sessions.",
  openGraph: {
    type: "website",
    siteName: "Julian Gigola",
    locale: "en_US",
    /* No `url` here: set once at the root it was inherited by every page,
       so a shared /sessions link unfurled pointing at the homepage. The
       canonical on each page is the address. */
    /* The eye mark on black, at 1200x630. Julian's pick for the thumbnail.
     *
     * It used to be the cover photograph, cropped from whatever `coverSlug`
     * named by a `prebuild` script. The mark does not change with the cover,
     * so there is nothing left to generate per deploy and the script is gone:
     * `public/og.jpg` is now a committed file, made from `app/icon.svg`.
     *
     * The trade: an unfurl in a feed is 500px wide and a photograph sells the
     * work harder than a logo does. It is the same mark as the tab, though,
     * which is the other thing a share card can be worth — a site you
     * recognise before you have read the title. */
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
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
         * `localStorage` throws outright in some privacy modes rather than
         * returning null, so the whole thing is wrapped; a failure there
         * still leaves the system check to run.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}if(t==="light"||(t!=="dark"&&matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.dataset.theme="light"})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* First stop for a keyboard or screen-reader visitor: the nav is
            fixed and the galleries are long, so skipping past the chrome
            matters more here than on a text site. */}
        <a
          href="#main"
          className="label sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
        >
          Skip to content
        </a>

        <SiteHeader />
        {/* Writes the pointer's position onto whichever glass control is
            under it — see `glass` in globals.css. Renders nothing. */}
        <GlassLight />
        {/* Marks lazily loaded pictures as they land so they fade in rather
            than pop — see `photo-fade.tsx`. Renders nothing. */}
        <PhotoFade />
        <main id="main" className="rise flex flex-1 flex-col">
          {/* Every page zooms in and out of the next: `page-transition.tsx`
              and `.page` in `globals.css`. */}
          <PageTransition>{children}</PageTransition>
        </main>
        <SiteFooter />
        <PhotoNotice />
        {/* The pointer over anything that opens large, site wide. One
            mount: it follows the pointer and shows only over `[data-ring]`,
            so every gallery and strip shares it and none carries its own. */}
        <PointerRing />
      </body>
    </html>
  );
}
