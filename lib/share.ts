import type { Metadata } from "next";

/** The share text every page uses: "<Name> | Julian Gigola" and one line.
    `title` is the bare name; the root template adds the rest to <title>.
    A page's openGraph replaces the layout's whole block, so the site fields
    come along. The image comes from the page's opengraph-image file. */
export const share = (title: string, description: string): Metadata => ({
  title,
  description,
  ...shareOg(title, description),
});

/** Only the preview fields, for a page whose <title> is worded for search. */
export const shareOg = (title: string, description: string): Metadata => ({
  openGraph: {
    type: "website",
    siteName: "Julian Gigola",
    locale: "en_US",
    title: `${title} | Julian Gigola`,
    description,
  },
  twitter: { card: "summary_large_image", title: `${title} | Julian Gigola`, description },
});

const SKIP = /photo|bts|assist|archive|grip|video|3d|in frame|tech/i;

/** Discipline and the main credits of a project, for the card and its text:
    "Model Kai Lin, styling Mia R" in the manifest's own order. */
export const projectFacts = (p: {
  categories: { name: string }[];
  credits: { role: string; name: string }[];
}) => {
  const discipline = p.categories[0]?.name ?? "Photography";
  const credits = p.credits
    .filter((c) => c.name && !SKIP.test(c.role))
    .slice(0, 3)
    .map((c) => `${c.role.toLowerCase()} ${c.name}`);
  const list = credits.length > 1 ? `${credits.slice(0, -1).join(", ")} and ${credits.at(-1)}` : credits[0];
  return {
    discipline,
    credits,
    description: `${discipline} by Julian Gigola${list ? `, with ${list}` : ""}.`,
  };
};
