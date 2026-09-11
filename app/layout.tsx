import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PhotoNotice } from "@/components/photo-notice";
import "./globals.css";

// `globals.css` resolves `font-sans` from `--font-sans` (shadcn's theme block
// names it that), so the Geist variable has to match — the create-next-app
// default of `--font-geist-sans` would leave `font-sans` unresolved.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  // A tight grotesque at display size sits better with slightly open
  // tracking than the negative tracking a Didone wants.
  adjustFontFallback: false,
});

const SITE = "https://www.juliangigola.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Julian Gigola — Photographer & Creative Director, Bay Area",
    // Project and section pages set only their own name; this frames it.
    template: "%s — Julian Gigola",
  },
  description:
    "Editorial, campaign, and artist photography from the San Francisco Bay Area. Published in WIRED. Available for commissions and sessions.",
  openGraph: {
    type: "website",
    siteName: "Julian Gigola",
    locale: "en_US",
    url: SITE,
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
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
        <main id="main" className="rise flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
        <PhotoNotice />
      </body>
    </html>
  );
}
