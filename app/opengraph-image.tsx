import { CARD_SIZE, CARD_TYPE, renderCard } from "@/lib/share-card";
import { PROJECTS } from "@/lib/work";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

/* One photograph, so the wordmark can take the room. Julian's pick
   (2026-11-10): I WANNA BE A HUMAN 01, fixed so the featured order no
   longer decides it. */
const SRC = "/work/i-wanna-be-a-human/01.jpg";

export default function Image() {
  const frame = PROJECTS.flatMap((p) => p.images).find((f) => f.src === SRC);
  if (!frame) throw new Error(`Share card frame not in the archive: ${SRC}`);
  return renderCard({ kicker: "San Francisco Bay Area", title: "Julian Gigola", byline: "Photographer and creative director", oneLine: true, panel: 620, exact: true, frames: [frame] });
}
