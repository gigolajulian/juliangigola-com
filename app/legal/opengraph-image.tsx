import { CARD_SIZE, CARD_TYPE, renderCard } from "@/lib/share-card";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

export default function Image() {
  return renderCard({ kicker: "Legal", title: "Terms and privacy", byline: "The site, the photographs and your data", oneLine: true, frames: [] });
}
