import type { Metadata } from "next";

/* A page's own link card: a 1200x630 JPG in public/og/, framed and locked on
   the Link Card Locks page. A page's openGraph replaces the layout's whole
   block, so the site fields come along. */
export const ogCard = (file: string, alt: string): Metadata => ({
  openGraph: {
    type: "website",
    siteName: "Julian Gigola",
    locale: "en_US",
    images: [{ url: `/og/${file}.jpg`, width: 1200, height: 630, alt }],
  },
  twitter: { card: "summary_large_image", images: [`/og/${file}.jpg`] },
});

/** /book/<slug> → its card in public/og/. */
export const BOOK_CARDS: Record<string, string> = {
  portraits: "portraits",
  headshots: "headshots",
  graduation: "graduation",
  "studio-digitals": "digitals",
  editorial: "editorial",
  "brand-photography": "campaign",
};
