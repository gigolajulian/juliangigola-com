import { CARD_SIZE, CARD_TYPE, framesOf, renderCard } from "@/lib/share-card";
import { pageForSession } from "@/lib/booking";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

/* One photograph: the first of the Portraits session. */
export default async function Image() {
  const page = pageForSession("portraits")!;
  const [frame] = page.picks?.length ? await framesOf(page.picks) : [page.tiles[0].frame];
  return renderCard({
    kicker: "Sessions",
    title: "Book a session",
    byline: "Portraits, graduation,\nheadshots",
    exact: true,
    frames: [frame],
  });
}
