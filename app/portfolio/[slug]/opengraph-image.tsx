import { CARD_SIZE, CARD_TYPE, clientMark, renderCard } from "@/lib/share-card";
import { projectFacts } from "@/lib/share";
import { LINKABLE, getProject, markFor } from "@/lib/work";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

/* A project names the frame that sits beside its cover when the second in order is not the one. */
const SECOND: Record<string, string> = { ukiyosunknown: "/work/ukiyosunknown/03.jpg" };

export function generateStaticParams() {
  return LINKABLE.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = getProject((await params).slug)!;
  const { discipline } = projectFacts(p);
  const key = markFor(p.slug)?.slug;
  const file = key && (await readdir(join(process.cwd(), "assets/clients"))).find((f) => f.replace(/\.\w+$/, "") === key);
  const mark = file ? await clientMark(file) : null;
  const second = SECOND[p.slug] && p.images.find((f) => f.src === SECOND[p.slug]);
  return renderCard({ kicker: discipline, title: p.name, frames: second ? [p.images[0], second] : p.images, exact: !!second, mark });
}
