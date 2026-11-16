import { CARD_SIZE, CARD_TYPE, renderCard } from "@/lib/share-card";
import { FEATURED } from "@/lib/work";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

/* The page's own card: its shareOg block replaces the layout's, image included. */
export default function Image() {
  const pool = FEATURED.map((p) => p.images[0]);
  return renderCard({ kicker: "Contact", title: "Commissions", byline: "Campaigns, editorial,\ncover art", frames: [...pool.slice(4), ...pool.slice(0, 4)] });
}
