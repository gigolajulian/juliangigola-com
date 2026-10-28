import { CARD_SIZE, CARD_TYPE, framesOf, renderCard } from "@/lib/share-card";
import { BOOK_MENU, pageForSession } from "@/lib/booking";
import { FEATURED } from "@/lib/work";

export const size = CARD_SIZE;
export const contentType = CARD_TYPE;
export const alt = "Julian Gigola";

export function generateStaticParams() {
  return [...BOOK_MENU.map((m) => ({ slug: m.slug })), { slug: "consultation" }, { slug: "editorial" }];
}

/* Which of a session's picks (0-based) its card uses, cover first, where the first two will not do. */
const CARD_PICKS: Record<string, number[]> = { portraits: [0, 4] };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const m = BOOK_MENU.find((x) => x.slug === slug);
  const page = pageForSession(slug);
  /* Julian's picks for the session when it has them, else its covers. */
  const chosen = CARD_PICKS[slug]?.map((i) => page?.picks?.[i]).filter((x): x is string => !!x);
  const frames = chosen?.length ? await framesOf(chosen) : page?.picks?.length ? await framesOf(page.picks) : (page?.tiles ?? []).map((t) => t.frame);
  return renderCard({
    kicker: "Book a session",
    title: m?.name ?? (slug === "consultation" ? "Consultation" : slug[0].toUpperCase() + slug.slice(1)),
    byline: "with Julian Gigola",
    frames: frames.length ? frames : FEATURED.map((p) => p.images[0]),
  });
}
