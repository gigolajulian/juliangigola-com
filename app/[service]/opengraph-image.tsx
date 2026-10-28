import { CARD_SIZE, CARD_TYPE, framesOf, renderCard } from "@/lib/share-card";
import { BOOKING_PAGES, bookingPage } from "@/lib/booking";
import { FEATURED } from "@/lib/work";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

export function generateStaticParams() {
  return BOOKING_PAGES.map((p) => ({ service: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ service: string }> }) {
  const page = bookingPage((await params).service)!;
  const frames = page.picks?.length ? await framesOf(page.picks) : page.tiles.map((t) => t.frame);
  return renderCard({ kicker: "Book a session", title: page.name, byline: page.rate, frames: frames.length ? frames : FEATURED.map((p) => p.images[0]) });
}
