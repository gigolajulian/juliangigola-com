import { CARD_SIZE, CARD_TYPE, renderCard } from "@/lib/share-card";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

/* The about page's own photograph of Julian on set (the steps photo crops badly at 1.91:1). */
export default function Image() {
  const frame = (src: string, width: number, height: number) => ({ src, width, height, alt: "", color: "#0b0b0a" });
  return renderCard({
    exact: true,
    kicker: "Biography",
    title: "About",
    byline: "Photographer and\ncreative director",
    frames: [frame("/about/julian-studio.jpg", 2048, 1365)],
  });
}
