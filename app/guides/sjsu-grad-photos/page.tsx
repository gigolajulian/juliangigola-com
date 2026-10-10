import type { Metadata } from "next";
import Link from "next/link";

/* DRAFT, not linked, not in the sitemap, noindex. Copy waits on Julian's
   sign-off (SEO.md, Next 1). Remove `robots` and add the slug to
   `app/sitemap.ts` when it is approved. */
export const metadata: Metadata = {
  title: "Best spots for SJSU grad photos",
  description:
    "Where I shoot graduation photos at San Jose State: Tower Hall, the Tommie Smith and John Carlos statue, King Library and the Paseo. What each looks like and when the light is good.",
  alternates: { canonical: "/guides/sjsu-grad-photos" },
  robots: { index: false, follow: false },
};

const SPOTS = [
  {
    name: "Tower Hall and Tower Lawn",
    body: "The clock tower is the frame most families want. I shoot it from the lawn with the tower behind you, and again tighter from low down so the brick fills the sky. Go early in the day, before the lawn fills with other graduates.",
  },
  {
    name: "The Tommie Smith and John Carlos statue",
    body: "The statue is the most photographed thing on campus, so I keep it short. One frame beside it, one from a distance with the lawn around you. It reads well in cap and gown.",
  },
  {
    name: "King Library",
    body: "The glass and the steps give clean lines and shade. It is the spot I use when the sun is high and the lawn is too bright. Gowns hold their shape against the straight edges.",
  },
  {
    name: "The Paseo de San Carlos",
    body: "A long walkway with trees on both sides. Good for walking shots and for a full-length frame with the gown moving. It is quiet on weekday mornings.",
  },
];

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="font-display text-4xl">Best spots for SJSU grad photos</h1>
      <p className="mt-6">
        I shoot graduation sessions at San Jose State most weeks in spring. These are the four places I use
        most, in the order I would walk them. An hour covers all four with two outfit changes.
      </p>
      {SPOTS.map((s) => (
        <section key={s.name} className="mt-10">
          <h2 className="text-xl">{s.name}</h2>
          <p className="mt-2">{s.body}</p>
        </section>
      ))}
      <h2 className="mt-12 text-xl">When to shoot</h2>
      <p className="mt-2">
        Book four to six weeks ahead and shoot a week or two before the ceremony. Soft light comes early
        in the morning and in the last hour before sunset. I plan the route around where the sun sits
        that day.
      </p>
      <p className="mt-10">
        <Link href="/graduation-photos" className="underline">
          Book a graduation session
        </Link>
      </p>
    </main>
  );
}
