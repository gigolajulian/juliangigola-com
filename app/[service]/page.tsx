import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Strip } from "@/components/strip";
import { StripPage } from "@/components/strip-page";
import { ContactScreen } from "@/components/contact-screen";
import { LdJson } from "@/components/local-screens";
import { LocalQuestions } from "@/components/local-questions";
import { CoverFloat } from "@/components/cover-float";
import { Testimonials } from "@/components/testimonials";
import { BOOKING_PAGES, bookingHref, bookingPage } from "@/lib/booking";
import { getProject, projectsIn, wallOf } from "@/lib/work";
import { InquireWall } from "@/components/inquire-wall";
import { ContactSheet } from "@/components/contact-sheet";
import { serviceGraph } from "@/lib/seo";

/* ── a booking page ───────────────────────────────────────────────
 * One service, at the root: /headshots, /graduation-photos. Built from
 * the homepage's own screens (Julian, 2026-10-02): its floating cover
 * with this service's photographs and title, the testimonials, the
 * details and questions on one screen, and the form, set to this service.
 * The words are in `lib/booking.ts`.
 * ─────────────────────────────────────────────────────────────── */

/* Prerendered, and rendered on request where the prerendered copy is not
   there: a Workers preview upload carries no cache, and `dynamicParams =
   false` turned every miss into a 404 (2026-10-02). Any address at the
   root that `lib/booking.ts` does not list is a 404 all the same, from
   `notFound()` below. */
export function generateStaticParams() {
  return BOOKING_PAGES.map((p) => ({ service: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/[service]">,
): Promise<Metadata> {
  const { service } = await props.params;
  const page = bookingPage(service);
  if (!page) return {};
  const cover = page.tiles[0]?.frame;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: bookingHref(page) },
    openGraph: {
      title: page.title,
      description: page.description,
      ...(cover
        ? { images: [{ url: cover.src, width: cover.width, height: cover.height, alt: page.h1 }] }
        : {}),
    },
    ...(cover
      ? { twitter: { card: "summary_large_image", images: [cover.src] } }
      : {}),
  };
}

export default async function BookingPage(props: PageProps<"/[service]">) {
  const { service } = await props.params;
  const page = bookingPage(service);
  if (!page) notFound();

  const others = BOOKING_PAGES.filter((p) => p !== page);
  /* The cover's frames: each tile's photograph, opening what the tile
     opens (the gallery, or a project). Julian (2026-10-02): headshot 09
     stays in the gallery, not on the cover. */
  const work = page.tiles
    .filter((t) => !t.frame.src.endsWith("/headshots/09.jpg"))
    .flatMap((t) => {
      const project = getProject(t.href.split("/").pop() ?? "");
      return project ? [{ ...project, cover: t.frame }] : [];
    });
  /* A session carries its gallery as a screen of its own (Julian,
     2026-10-03): the frames chosen for it where the gallery is large
     (`picks`, `lib/booking.ts`), all of it where it fits in four rows of
     five, and otherwise fourteen, taken in turn from each of the
     discipline's projects or spread through the one gallery. */
  const slug = page.gallery.href.split("/").pop() ?? "";
  const one = getProject(slug);
  const sets = (one ? [one] : projectsIn(slug)).map((p) => p.images);
  const total = sets.reduce((n, s) => n + s.length, 0);
  const all = sets.flat();
  const sheet = !page.session
    ? undefined
    : page.picks
      ? page.picks.flatMap((src) => all.filter((f) => f.src === src).slice(0, 1))
      : total <= 19
      ? all
      : sets.length === 1
        ? Array.from({ length: 14 }, (_, i) => sets[0][Math.floor((i * total) / 14)])
        : Array.from({ length: Math.max(...sets.map((s) => s.length)) }, (_, k) =>
            sets.flatMap((s) => (s[k] ? [s[k]] : [])),
          )
            .flat()
            .slice(0, 14);
  const facts = [page.rate, ...(page.turnaround ? [`Ready in ${page.turnaround}`] : [])];

  return (
    <StripPage>
      <LdJson
        data={serviceGraph({
          url: bookingHref(page),
          name: page.name,
          service: page.service,
          description: page.description,
          price: page.price,
          faqs: page.faqs,
          places: page.where.map((w) => w.name),
        })}
      />
      <Strip
        label={`${page.h1}: what people say, the details and questions, and booking. One screen at a time, left and right.`}
        next={{ href: "/", name: "Home" }}
        paged
        deck="screens"
        bleed
        className="flex-1"
      >
        <CoverFloat
          work={work}
          heading={{
            title: page.h1.replace(/San (Francisco|Jose)/g, "San\u00a0$1"),
            where: facts.join(" · "),
            ctas: [
              { href: "#book", label: page.book.title },
              { href: sheet ? "#work" : page.gallery.href, label: "See the work" },
            ],
          }}
          className="w-full shrink-0 max-sm:h-[100svh] sm:h-full"
        />
        {sheet ? (
          <ContactSheet
            frames={sheet}
            total={total}
            name={page.name}
            book={page.book.title}
            gallery={page.gallery.href}
            even={page.slug === "headshots"}
          />
        ) : null}
        <Testimonials cells />
        <LocalQuestions
          faqs={page.faqs}
          backdrop={<InquireWall items={wallOf(slug)} />}
          details={{
            facts,
            blocks: [
              ...page.blocks,
              {
                heading: "Also booking",
                links: others.map((p) => ({ href: bookingHref(p), label: p.h1 })),
              },
            ],
          }}
        />
        <ContactScreen
          title={page.book.title}
          label="Book"
          hash="book"
          defaults={{ type: page.book.type, session: page.book.session }}
          calendar={page.book.calendar}
          intro={
            <>
              <span className="sm:block sm:text-balance">
                {[page.rate, page.turnaround ? `ready in ${page.turnaround}` : null]
                  .filter(Boolean)
                  .join(", ")}
                .
              </span>{" "}
              <span className="sm:block sm:text-balance">
                Say when and where, and I&rsquo;ll come back to confirm the
                date{page.price === null ? " with a quote" : ""}.
              </span>
            </>
          }
        />
      </Strip>
    </StripPage>
  );
}
