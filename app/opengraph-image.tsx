import { CARD_SIZE, CARD_TYPE, renderCard } from "@/lib/share-card";
import { FEATURED } from "@/lib/work";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

/* One photograph, so the wordmark can take the room. */
export default function Image() {
  const pool = FEATURED.map((p) => p.images[0]);
  return renderCard({ kicker: "San Francisco Bay Area", title: "Julian Gigola", byline: "Photographer and creative director", oneLine: true, panel: 620, exact: true, frames: [pool[0]] });
}
