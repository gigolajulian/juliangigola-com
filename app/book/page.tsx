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

/* book.juliangigola.com, a Cloudflare redirect to here. The four
   sessions with a Google Calendar appointment schedule on
   hello@juliangigola.com; weddings are booked by inquiry. Live
   without the 50% deposit, which waits on Stripe in Calendar's
   settings. The lengths are the schedules' own. */
const CALENDARS: Record<string, { id: string; length: string }> = {
  portraits: { id: "AcZssZ14pWKn0PhQZxKSfrSjutq_NM4vtqcRXF4C4PYuzZrXcN54Ec4BO_Rms3HgjKdsDRQYo670AQbD", length: "1 hour" },
  graduation: { id: "AcZssZ1xuDp0FQU0bQESt670XPAJ7R76ql1RdYTRBokN_AybNjkeSrqXLGD8_Qg5bDY9FZBRbDhYiGz7", length: "1 hour" },
  headshots: { id: "AcZssZ0uTmIdvTQpdNHXZu7EIbFffjn9qFap_BVZQ0aOFL03IsfZ6CRDagD3cWnaAbkvlrTTCM9_l-OY", length: "30 minutes" },
  "studio-digitals": { id: "AcZssZ3ZCkVh-KA0BaMB1EDaf9nat1xleBQ0tPBHEhqNlau_nzeVjlOsmnAVHo9dqVtURSSFNSHqjazB", length: "45 minutes" },
};

export default async function BookPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  const sessions: Bookable[] = SESSION_TYPES.flatMap((s) => {
    const c = CALENDARS[s.slug];
    return c ? [{ slug: s.slug, name: s.name, blurb: s.blurb, rate: formatPrice(s.from), length: c.length, calendar: c.id, cal: calEvent(s.slug) }] : [];
  });
  return <BookPicker sessions={sessions} start={session} />;
}
