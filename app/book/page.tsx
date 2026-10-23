import type { Metadata } from "next";
import { V3Book } from "@/components/v3/book";
import { isSession } from "@/lib/v3";

export const metadata: Metadata = {
  title: "Book a session",
  description:
    "Pick a session and a time: portraits, graduation, headshots and studio digitals in the San Francisco Bay Area.",
  alternates: { canonical: "/book" },
};

/* JG V3: the stepper, on graduation unless `?session=` names another (master `#/book`). */
export default async function BookPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  return <V3Book slug={isSession(session) ? session : "graduation"} />;
}
