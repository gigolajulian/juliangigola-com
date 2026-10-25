import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookCard } from "@/components/book-here";
import { InquireWall } from "@/components/inquire-wall";
import { BOOK_MENU, BOOKING_PAGES, pageForSession } from "@/lib/booking";
import { wallOf } from "@/lib/work";
import { V3Book } from "@/components/v3/book";
import { SESSIONS, isSession } from "@/lib/v3";
import { BOOK_CARDS, ogCard } from "@/lib/og";

/* One session's booking on a page of its own (Julian, 2026-10-14), for
   book.juliangigola.com/<session>: the booking sheet's look, standing
   still. Its name over the calendar, the session's wall behind. */

const item = (slug: string) => BOOK_MENU.find((m) => m.slug === slug);

export function generateStaticParams() {
  return [...BOOK_MENU.map((m) => ({ slug: m.slug })), { slug: "consultation" }, { slug: "editorial" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  if (slug === "consultation") return { title: "Book a consultation", description: "15 minutes, phone or video. Pick a time on my calendar.", alternates: { canonical: "/book/consultation" } };
  const m = item(slug);
  const card = BOOK_CARDS[slug] ? ogCard(BOOK_CARDS[slug], "Julian Gigola") : {};
  if (!m && isSession(slug)) return { title: `Book ${SESSIONS[slug].name}`, description: SESSIONS[slug].blurb, alternates: { canonical: `/book/${slug}` }, ...card };
  return m ? { title: `Book ${m.name}`, description: m.blurb, alternates: { canonical: `/book/${m.slug}` }, ...card } : {};
}

export default async function BookSession({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  // JG V3: the master's sessions get its stepper; the rest keep this card.
  if (isSession(slug)) return <V3Book slug={slug} />;
  const m = item(slug);
  if (!m) notFound();
  const p = pageForSession(m.slug) ?? BOOKING_PAGES.find((x) => x.slug === m.slug);
  const wall = wallOf((p?.gallery.href ?? m.page ?? "").split("/").pop() ?? "");
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center sm:p-[clamp(1rem,4vh,3rem)] sm:pt-20">
      <div inert className="enquiry-backdrop questions-wall fixed inset-0 -z-10 overflow-hidden bg-background max-sm:hidden">
        {wall.length ? <InquireWall items={wall} /> : null}
      </div>
      <div data-book-frame className="flex w-full flex-col gap-5 sm:h-[min(50rem,calc(100dvh-8rem))] sm:w-[min(46rem,100%)] sm:gap-6">
        <header className="flex flex-col gap-3 px-[var(--card-x,1.25rem)] pt-24 sm:px-0 sm:pt-0">
          <p className="label text-muted-foreground">You&apos;re booking</p>
          <h1 className="font-display text-4xl uppercase leading-[0.9] sm:text-6xl">{m.name}</h1>
          {m.blurb ? <p className="text-[0.9375rem] normal-case leading-relaxed text-muted-foreground text-balance">{m.blurb}</p> : null}
        </header>
        <BookCard item={m} className="min-h-0 flex-1 max-sm:flex-none max-sm:mx-[3px] max-sm:bg-transparent max-sm:shadow-none max-sm:backdrop-blur-none max-sm:[container-type:inline-size]" />
      </div>
    </main>
  );
}
