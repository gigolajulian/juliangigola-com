/**
 * The clients with a mark on file: the catalogue /admin picks the client walls
 * from, and the mark on a project's page and card (`markFor`). Each links into
 * the work it refers to.
 */
export type Client = {
  name: string;
  /** The key a logo file is named for, in `assets/clients/`. */
  slug: string;
  /** Where the mark goes. Not always a project — two of these are films. */
  href: string;
  /**
   * An override on how much of the row's height this mark takes.
   *
   * Nothing sets it: `scripts/make-clients.mjs` levels each mark's *ink
   * area* across the set, since equal height gives a wide wordmark four
   * times the area of a compact glyph.
   *
   * This stays for the judgement the pixels cannot make: a logo that should
   * dominate, or one whose trademark rules dictate a size.
   */
  scale?: number;
};

/**
 * Every client with a mark on file, as the catalogue the editor picks from.
 *
 * `href` rather than a slug, because a client is not always a project: Pear
 * VC and Ladera Granola are films, and their work is on /work/video.
 */
export const PRESS: Client[] = [
  { name: "WIRED", slug: "wired-magazine", href: "/portfolio/wired-magazine" },
  { name: "Pear VC", slug: "pear-vc", href: "/portfolio/video#pear-vc" },
  { name: "Ladera Granola", slug: "ladera-granola", href: "/portfolio/video#ladera-granola" },
  { name: "SOLSWEAR", slug: "sols", href: "/portfolio/sols" },
  { name: "UKIYOSUNKNOWN", slug: "ukiyosunknown", href: "/portfolio/ukiyosunknown" },
  { name: "JUBO", slug: "jubo", href: "/portfolio/jubo" },
  { name: "SAGO", slug: "sago", href: "/portfolio/sago" },
  { name: "GOOD CULT", slug: "goodcult", href: "/portfolio/goodcult" },
  { name: "PARADOX", slug: "paradox", href: "/portfolio/paradox" },
  { name: "HUA", slug: "hua", href: "/portfolio/hua" },
  /* No project of its own on the site, so the mark leads to EMPIRE itself
     (Julian's call). */
  { name: "EMPIRE", slug: "empire", href: "https://www.empi.re/" },
];

/**
 * The mark of the client a project was shot for, if that client has one.
 *
 * Eight do. The strip shows it in the panel as the cover it belongs to comes
 * to the middle: a credential stated where it was earned, rather than a wall
 * of logos somewhere else. Julian: the client logos need to be more
 * integrated.
 */
export const markFor = (slug: string): Client | undefined => PRESS.find((c) => c.href === `/portfolio/${slug}`);
