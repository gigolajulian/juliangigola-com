import type { Metadata } from "next";
import { shareOg } from "@/lib/share";
import { BookPicker, type Bookable } from "@/components/book-picker";
import { V3Book } from "@/components/v3/book";
import { calEvent, pageForSession } from "@/lib/booking";
import { isSession } from "@/lib/v3";
import { wallOf } from "@/lib/work";
import { SESSION_TYPES, formatPrice } from "@/lib/sessions";

export const metadata: Metadata = {
  title: "Book a session",
  description:
    "Pick a session and a time: portraits, graduation, headshots and studio digitals in the San Francisco Bay Area.",
  alternates: { canonical: "/book" },
...shareOg("Book a session","Portraits, graduation, headshots and studio digitals in the San Francisco Bay Area. Pick a time on my calendar."),
};

/* The four sessions, each a Cal.com event (`CAL_EVENTS`, `lib/booking.ts`);
   weddings book a call (its page's `book.cal`). The lengths are the events' own. */
const LENGTHS: Record<string, string> = {
  portraits: "1 hour",
  graduation: "90 minutes",
  headshots: "30 minutes",
  "studio-digitals": "45 minutes",
  weddings: "Call",
};

/* JG V3: the stepper, on graduation unless `?session=` names another (master
   `#/book`). `?classic` keeps the page as it was before V3. */
export default async function BookPage({ searchParams }: { searchParams: Promise<{ session?: string; classic?: string }> }) {
  const { session, classic } = await searchParams;
  if (classic === undefined) return <V3Book slug={isSession(session) ? session : "graduation"} />;
  const sessions: Bookable[] = SESSION_TYPES.flatMap((s) => {
    const cal = calEvent(s.slug) ?? pageForSession(s.slug)?.book.cal;
    // Its wall, as its own booking page has (`/book/[slug]`).
    const wall = wallOf(pageForSession(s.slug)?.gallery.href.split("/").pop() ?? "");
    return cal ? [{ slug: s.slug, name: s.name, blurb: s.blurb, rate: formatPrice(s.from), length: LENGTHS[s.slug], cal, wall }] : [];
  });
  return <BookPicker sessions={sessions} start={session} />;
}
