import type { Metadata } from "next";
import { shareOg } from "@/lib/og/share";
import { SessionBook } from "@/components/booking/book";
import { Packages } from "@/components/booking/packages";
import { isSession } from "@/lib/booking/catalog";

export const metadata: Metadata = {
  title: "Book a session",
  description:
    "Pick a session and a time: portraits, graduation, headshots, studio digitals, model tests and weddings in the San Francisco Bay Area.",
  alternates: { canonical: "/book" },
  ...shareOg(
    "Book a session",
    "Portraits, graduation, headshots, studio digitals, model tests and weddings in the San Francisco Bay Area. Pick a time on my calendar.",
  ),
};

/* The package cards; `?session=` (the old links) opens that session's stepper. */
export default async function BookPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  return isSession(session) ? <SessionBook slug={session} /> : <Packages />;
}
