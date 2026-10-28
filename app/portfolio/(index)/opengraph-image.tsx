import { CARD_SIZE, CARD_TYPE, renderCard } from "@/lib/share-card";
import { FEATURED } from "@/lib/work";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

export default function Image() {
  const pool = FEATURED.map((p) => p.images[0]);
  return renderCard({ kicker: "Portfolio", title: "Julian Gigola", byline: "Selected work", oneLine: true, panel: 620, exact: true, frames: [pool[3]] });
}
