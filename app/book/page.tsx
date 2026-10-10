import type { Metadata } from "next";
import { BookPicker, type Bookable } from "@/components/book-picker";
import { calEvent } from "@/lib/booking";
import { SESSION_TYPES, formatPrice } from "@/lib/sessions";

export const metadata: Metadata = {
  title: "Book a session",
  description:
    "Pick a session and a time: portraits, graduation, headshots and studio digitals in the San Francisco Bay Area.",
  alternates: { canonical: "/book" },
};

/* The four sessions, each a Cal.com event (`CAL_EVENTS`, `lib/booking.ts`);
   weddings are booked by inquiry. The lengths are the events' own. */
const LENGTHS: Record<string, string> = {
  portraits: "1 hour",
  graduation: "90 minutes",
  headshots: "30 minutes",
  "studio-digitals": "45 minutes",
};

export default async function BookPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  const sessions: Bookable[] = SESSION_TYPES.flatMap((s) => {
    const cal = calEvent(s.slug);
    return cal ? [{ slug: s.slug, name: s.name, blurb: s.blurb, rate: formatPrice(s.from), length: LENGTHS[s.slug], cal }] : [];
  });
  return <BookPicker sessions={sessions} start={session} />;
}
