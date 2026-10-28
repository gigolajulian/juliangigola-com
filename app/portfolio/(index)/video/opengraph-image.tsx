import { CARD_SIZE, CARD_TYPE, renderCard } from "@/lib/share-card";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

/* A still from one of the films (the drone shot of the reel) themselves (`public/films/`). */
export default function Image() {
  const still = (src: string, width: number, height: number) => ({ src, width, height, alt: "", color: "#0b0b0a" });
  return renderCard({
    kicker: "Motion",
    title: "Video",
    byline: "Music videos and\ncommercials",
    exact: true,
    frames: [still("/films/directors-reel.jpg", 1920, 1080)],
  });
}
