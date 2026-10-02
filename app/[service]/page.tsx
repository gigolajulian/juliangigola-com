import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Strip } from "@/components/strip";
import { StripPage } from "@/components/strip-page";
import { ContactScreen } from "@/components/contact-screen";
import {
  LdJson,
  LocalCover,
  LocalDetails,
  LocalWhere,
  LocalWork,
} from "@/components/local-screens";
import { LocalQuestions } from "@/components/local-questions";
import { BOOKING_PAGES, bookingHref, bookingPage } from "@/lib/booking";
import { serviceGraph } from "@/lib/seo";

/* ── a booking page ───────────────────────────────────────────────
 * One service, at the root: /headshots, /graduation-photos. A deck of
 * screens like the homepage (Julian: no vertical pages), read left to
 * right in the order somebody pricing a shoot asks: what is it and what
 * does it cost, what does it look like, what is included, where, the
 * questions, and the form, set to this service. The words are in
 * `lib/booking.ts`; the screens in `components/local-screens.tsx`.
 * ─────────────────────────────────────────────────────────────── */

/* Only the pages `lib/booking.ts` lists. Any other address at the root is
   a 404 rather than an empty page rendered on request. */
export const dynamicParams = false;

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

  const [cover, ...work] = page.tiles;
  const others = BOOKING_PAGES.filter((p) => p !== page);

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
        label={`${page.h1}: what it is, the work, the details, where, questions, and booking. One screen at a time, left and right.`}
        next={page.back.href === "/portfolio" ? { href: "/portfolio", name: "Portfolio" } : { href: "/", name: "Home" }}
        paged
        deck="screens"
        bleed
        className="flex-1"
      >
        <LocalCover
          label={page.name}
          crumb={page.back}
          kicker={page.kicker}
          title={page.h1}
          lead={page.lead}
          facts={[page.rate, ...(page.turnaround ? [`Ready in ${page.turnaround}`] : [])]}
          actions={[
            { href: "#book", label: page.book.title },
            { href: "#work", label: "See the work", quiet: true },
          ]}
          frame={cover?.frame}
          alt={cover?.frame.alt || `${page.h1}, photographed by Julian Gigola`}
        />
        <LocalWork tiles={work} gallery={page.gallery} />
        <LocalDetails
          blocks={page.blocks}
          more={{
            heading: "Also booking",
            links: others.map((p) => ({ href: bookingHref(p), label: p.h1 })),
          }}
        />
        <LocalWhere places={page.where} />
        <LocalQuestions faqs={page.faqs} />
        <ContactScreen
          title={page.book.title}
          label="Book"
          hash="book"
          defaults={{ type: page.book.type, session: page.book.session }}
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
