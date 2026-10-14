import imageLoader from "../image-loader";
import type { DriftWallItem } from "@/components/DriftWall";

/** One wall photograph as the page sends it: the frame, its project and where it opens. */
export type WallTile = { src: string; title: string; href: string };

/* Its two small copies (640px, a 300px tile on a retina screen, and a 320
   a phone's 80px tile takes at three times) are worked out where the wall
   is drawn. Sent with every tile, the session walls alone were 137KB of
   the homepage's HTML (audit, 2026-10-14). */
export const wallItem = ({ src, title, href }: WallTile): DriftWallItem => ({
  image: imageLoader({ src, width: 640, quality: 70 }),
  srcSet: [320, 640].map((w) => `${imageLoader({ src, width: w, quality: 70 })} ${w}w`).join(", "),
  title,
  href,
});
