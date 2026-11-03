/**
 * The campus guides: where I take grad photos on one campus, under its
 * booking page (/graduation-photos/sjsu). Bing shows students searching
 * where to shoot on campus; commencement is in spring (SEO.md, Next 1).
 *
 * Each spot names its photographs from the graduation gallery by file, so
 * the alt text is the gallery's own (`lib/alt-text.ts`). A spot with no
 * photograph of mine is text only.
 */

import { SESSION_TYPES, formatPrice } from "./sessions";

export type Spot = { name: string; note: string; frames: string[] };

export type CampusGuide = {
  slug: string;
  /** The campus in a word, for the crumb and the booking page's link. */
  name: string;
  title: string;
  description: string;
  h1: string;
  kicker: string;
  lead: string;
  spots: Spot[];
  /** The photo row at the top, in order: six of the spots' frames. */
  photos: string[];
  plan: string;
  faqs: { q: string; a: string }[];
};

const grad = SESSION_TYPES.find((s) => s.slug === "graduation")!;
const g = (n: string) => `/work/graduation/${n}.jpg`;

export const CAMPUS_GUIDES: CampusGuide[] = [
  {
    slug: "sjsu",
    name: "SJSU",
    title: "Best Spots for SJSU Grad Photos",
    description:
      "Where I take SJSU graduation photos: Tower Hall, the palm walk, the San Jose State sign, the glass walkways and the Smith and Carlos statue. Light, timing and a route for one session.",
    h1: "Best spots for SJSU grad photos",
    kicker: "San Jose State · Campus guide",
    lead: "I shoot graduation sessions at SJSU every spring. These are the spots I use and the light that works at each.",
    spots: [
      {
        name: "Tower Hall and Tower Lawn",
        note: "The frame everyone wants. The tower lights up late in the afternoon, and the lawn leaves room for the cap toss.",
        frames: [g("14")],
      },
      {
        name: "The palm walk",
        note: "Two rows of palms and one long line down the middle. Best when the sun sits low behind the trees.",
        frames: [g("15"), g("01")],
      },
      {
        name: "The brick steps",
        note: "Red brick, a black rail and an old lamp post. Good for sitting poses and the family frame.",
        frames: [g("02")],
      },
      {
        name: "The San Jose State University sign",
        note: "One clear frame that says where you graduated. The blue wall matches the stole.",
        frames: [g("04")],
      },
      {
        name: "The glass walkways",
        note: "Glass and steel throw light back at you, so these work even at midday.",
        frames: [g("13"), g("03")],
      },
      {
        name: "The Tommie Smith and John Carlos statue",
        note: "The statue between Clark Hall and Tower Lawn. It gets busy close to commencement, so I plan it early in the session.",
        frames: [],
      },
    ],
    // His four lead the row (Julian).
    photos: ["01", "02", "03", "04", "14", "15"].map(g),
    plan: "I start at the glass walkways, where the light works at any hour, then the sign, the statue and the brick steps, and finish at Tower Hall and the palms when the light is low. Two outfit changes fit between stops in 90 minutes.",
    faqs: [
      {
        q: "Where are the best spots for SJSU grad photos?",
        a: "Tower Hall and Tower Lawn, the palm walk, the brick steps, the San Jose State University sign, the glass walkways and the Tommie Smith and John Carlos statue.",
      },
      {
        q: "What time of day is best for photos at SJSU?",
        a: "Late afternoon. Tower Hall and the palms get the low sun. At midday I work at the glass walkways.",
      },
      {
        q: "How much are graduation photos at SJSU?",
        a: grad.from === null
          ? "Quoted on request. SJSU is included, with no travel fee."
          : `${formatPrice(grad.from)} for 90 minutes at SJSU, with two outfit changes, an edited gallery and a print release. SJSU is included, with no travel fee.`,
      },
      {
        q: "When should I book my SJSU grad photos?",
        a: "Four to six weeks ahead, for a shoot a week or two before commencement. Spring dates go first.",
      },
      {
        q: "Can my family join the session?",
        a: "Yes. I keep the last stop for the family frame.",
      },
    ],
  },
];

export const campusGuide = (slug: string) => CAMPUS_GUIDES.find((c) => c.slug === slug);
export const campusHref = (c: CampusGuide) => `/graduation-photos/${c.slug}`;
