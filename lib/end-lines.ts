import type { Project } from "./work-types";
import { SESSIONS, commissionsIn, disciplineOf, enquiryTypeFor, wallOf } from "./work";
import { BOOK_MENU, type MenuItem } from "./booking";
import type { WallTile } from "./wall-tile";

/* The end card's headline (`EndCell`, preview `?cross=1`): Julian's locked
   lines per discipline, 2026-10-18. Each project takes the next line of its
   discipline's list in portfolio order, so neighbours never repeat. The
   second line is set in capitals by the card. */
const LINES: Record<string, [string, string][]> = {
  editorial: [
    ["Your next issue,", "Shot after dark"],
    ["Your next cover story,", "Framed like this"],
    ["Your next editorial,", "Shot like this"],
    ["Your next feature,", "Lit to hold the page"],
    ["Your next issue,", "Captured like this"],
    ["Your next spread,", "Styled like this"],
    ["Your next cover,", "Shot for print"],
    ["Your next editorial,", "Ready for print"],
    ["Your next look,", "Captured in detail"],
  ],
  campaigns: [
    ["Your next launch,", "Ready for drop"],
    ["Your next lookbook,", "Styled like this"],
    ["Your next campaign,", "Shot like this"],
    ["Your next drop,", "Captured in detail"],
    ["Your next collection,", "Styled like this"],
  ],
  portraits: [
    ["Your next portrait,", "Captured like this"],
    ["Your next portrait,", "Framed like this"],
    ["Your next portrait,", "Snapped like this"],
    ["Your next portrait,", "Styled like this"],
    ["Your next portrait,", "Shot in studio"],
  ],
  "artist-presskit": [
    ["Your next press run,", "Captured like this"],
    ["Your next release,", "Shot like this"],
    ["Your next rollout,", "Styled like this"],
    ["Your next album,", "Styled like this"],
  ],
  chroma: [
    ["Your next story,", "Caught in light"],
    ["Your next frame,", "Painted in light"],
    ["Your next shoot,", "Saturated like this"],
    ["Your next look,", "Caught in color"],
  ],
  automotive: [["Your next build,", "Under the light"]],
  places: [
    ["Your next room,", "In its best light"],
    ["Your venue,", "Framed like this"],
  ],
  coverart: [
    ["Your next cover,", "Shot like this"],
    ["Your next record,", "Framed like this"],
    ["Your next era,", "Starts here"],
    ["Your next single,", "Framed like this"],
  ],
  "mixed-media": [
    ["Your next idea,", "Made real"],
    ["Your concept,", "Cut and layered"],
    ["Your next idea,", "Built by hand"],
  ],
  video: [
    ["Your next scene,", "Shot like this"],
    ["Your next video,", "Directed like this"],
    ["Your next scene,", "Cut like this"],
  ],
  events: [
    ["Your next show,", "Kept like this"],
    ["Your next night,", "Shot like this"],
  ],
  "studio-digitals": [
    ["Your next casting,", "Ready like this"],
    ["Your digitals,", "Captured like this"],
    ["Your next casting,", "Shot clean"],
  ],
  headshots: [["Your profile,", "Captured like this"]],
  graduation: [["Your big day,", "Kept like this"]],
  weddings: [["Your big day,", "Captured like this"]],
};

/** Sessions sets end on Book a session rather than Inquire. */
const BOOK = new Set(["studio-digitals", "headshots", "graduation", "weddings"]);

export type EndLine = {
  lead: string;
  punch: string;
  book: boolean;
  /** What the button opens in place: the session's calendar or the
      inquiry form carrying the project, over the discipline's wall. */
  ask: { item: MenuItem; wall: WallTile[] };
};

export function endLine(p: Project): EndLine {
  const session = p.categories.find((c) => c.section === "SESSIONS")?.slug;
  const here = session ?? disciplineOf(p) ?? p.categories[0]?.slug ?? "";
  const pool = session
    ? SESSIONS.filter((x) => x.categories.some((c) => c.slug === session))
    : commissionsIn(here);
  const list = LINES[here] ?? LINES.editorial;
  const i = Math.max(0, pool.findIndex((x) => x.slug === p.slug));
  const [lead, punch] = list[i % list.length];
  const book = BOOK.has(here);
  const item: MenuItem =
    (book && BOOK_MENU.find((m) => m.slug === here)) || {
      slug: "commission",
      name: "Commission",
      blurb: "",
      group: "commission",
      form: { type: enquiryTypeFor(p), ref: p.name },
    };
  return { lead, punch, book, ask: { item, wall: wallOf(here) } };
}
