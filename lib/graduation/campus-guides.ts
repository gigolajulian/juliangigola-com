/**
 * The campus guides: where I take grad photos on one campus, under its
 * booking page (/graduation-photos/sjsu). Bing shows students searching
 * where to shoot on campus; commencement is in spring (SEO.md, Next 1).
 *
 * Each spot names its photographs from the graduation gallery by file, so
 * the alt text is the gallery's own (`lib/work/alt-text.ts`). A spot with no
 * photograph of mine is text only.
 */

import { SESSION_TYPES } from "@/lib/booking/sessions";

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
      "Where I take SJSU graduation photos: Tower Hall, the palm walk, the San Jose State sign and the glass walkways. Light, timing and a route for one session.",
    h1: "Best spots for SJSU grad photos",
    kicker: "San Jose State · Campus guide",
    lead: "I shoot grads at SJSU every spring, so I know this campus well. Here are the spots I take people to, and when the light is best at each.",
    spots: [
      {
        name: "Tower Hall and Tower Lawn",
        note: "Everyone wants this one, and it's worth it. Late in the afternoon the tower catches the sun, and the lawn gives you room to throw your cap.",
        frames: [g("14")],
      },
      {
        name: "The palm walk",
        note: "Two rows of palms and one long line down the middle. I like it most when the sun drops low behind the trees.",
        frames: [g("15"), g("01")],
      },
      {
        name: "The brick steps",
        note: "Red brick, a black rail and an old lamp post. It's an easy place to sit and relax, and a good spot for a photo with your family.",
        frames: [g("02")],
      },
      {
        name: "The San Jose State University sign",
        note: "The one photo that says exactly where you graduated. The blue wall even matches your stole.",
        frames: [g("04")],
      },
      {
        name: "The glass walkways",
        note: "All that glass and steel bounces light back at you, so it looks good even at noon. That's why I usually start here.",
        frames: [g("13"), g("03")],
      },
    ],
    // His four lead the row (Julian).
    photos: ["01", "02", "03", "04", "14", "15"].map(g),
    plan: "I usually start at the glass walkways, since the light works there any time of day. Then the sign and the brick steps. I save Tower Hall and the palms for the end, when the light gets low and soft. It all fits in 90 minutes, with time for two outfit changes.",
    faqs: [
      {
        q: "Where are the best spots for SJSU grad photos?",
        a: "My favorites are Tower Hall and Tower Lawn, the palm walk, the brick steps, the San Jose State sign and the glass walkways.",
      },
      {
        q: "What time of day is best for photos at SJSU?",
        a: "Late afternoon. That's when Tower Hall and the palms get the low sun. If midday is all you have, I'll start at the glass walkways.",
      },
      {
        q: "How much are graduation photos at SJSU?",
        a: grad.from === null
          ? "I quote it when you get in touch, and there's no travel fee for SJSU."
          : `It's $${grad.from.toLocaleString("en-US")} for 90 minutes on campus. That covers two outfit changes, an edited gallery and a print release, and there's no travel fee for SJSU.`,
      },
      {
        q: "When should I book my SJSU grad photos?",
        a: "Four to six weeks out is a good rule, for a shoot a week or two before commencement. Spring dates fill up first.",
      },
      {
        q: "Can my family join the session?",
        a: "Of course. I save the last stop for a photo with your family.",
      },
    ],
  },
];

export const campusGuide = (slug: string) => CAMPUS_GUIDES.find((c) => c.slug === slug);
export const campusHref = (c: CampusGuide) => `/graduation-photos/${c.slug}`;
