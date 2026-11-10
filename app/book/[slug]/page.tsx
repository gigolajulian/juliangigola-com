import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BOOK_MENU } from "@/lib/booking/booking";
import { V3Book } from "@/components/v3/book";
import { SESSIONS, isSession } from "@/lib/v3";
import { shareOg } from "@/lib/share";

/* One session's booking on a page of its own (Julian, 2026-10-14), for
   book.juliangigola.com/<session>. V3's stepper for every session; a
   commission without one (music, brand) goes to its own page. */

const item = (slug: string) => BOOK_MENU.find((m) => m.slug === slug);

export function generateStaticParams() {
  return Object.keys(SESSIONS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  if (slug === "consultation") return { title: "Book a consultation", description: "15 minutes, phone or video. Pick a time on my calendar.", alternates: { canonical: "/book/consultation" }, ...shareOg("Book a consultation", "15 minutes, phone or video, with Julian Gigola. Pick a time on my calendar.") };
  const m = item(slug);
  const card = shareOg(`Book ${item(slug)?.name ?? slug}`, `${item(slug)?.name ?? "A session"} with Julian Gigola in the San Francisco Bay Area. Pick a time on my calendar.`);
  if (!m && isSession(slug)) return { title: `Book ${SESSIONS[slug].name}`, description: SESSIONS[slug].blurb, alternates: { canonical: `/book/${slug}` }, ...card };
  return m ? { title: `Book ${m.name}`, description: m.blurb, alternates: { canonical: `/book/${m.slug}` }, ...card } : {};
}

export default async function BookSession({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  if (isSession(slug)) return <V3Book slug={slug} />;
  // The pre-V3 card is gone: a commission's old /book address lands on its page.
  const m = item(slug);
  if (!m) notFound();
  permanentRedirect(m.page ?? "/book");
}
