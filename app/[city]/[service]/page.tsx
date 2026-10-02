import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Strip } from "@/components/strip";
import { StripPage } from "@/components/strip-page";
import { ContactScreen } from "@/components/contact-screen";
import {
  LdJson,
  LocalCover,
  LocalDetails,
  LocalWork,
} from "@/components/local-screens";
import { LocalQuestions } from "@/components/local-questions";
import { PAGES, cityOf, localHref, pageOf, pagesIn } from "@/lib/locations";
import { localGraph } from "@/lib/seo";

/* ── a booking page ───────────────────────────────────────────────
 * One service in one city, at /<city>/<service>: /san-jose/headshots.
 * A deck of screens like the homepage (Julian: no vertical pages), read
 * left to right in the order somebody pricing a shoot asks: what is it
 * and what does it cost, what does it look like, what is included, the
 * questions, and the form, set to this service. The words are in
 * `lib/locations.ts`; the screens in `components/local-screens.tsx`.
 * ─────────────────────────────────────────────────────────────── */

/* Only the pages `lib/locations.ts` lists. Anything else at this depth is
   a 404 rather than an empty page rendered on request. */
export const dynamicParams = false;

export function generateStaticParams() {
  return PAGES.map((p) => ({ city: p.city, service: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/[city]/[service]">,
): Promise<Metadata> {
  const { city, service } = await props.params;
  const page = pageOf(city, service);
  if (!page) return {};
  const cover = page.tiles[0]?.frame;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: localHref(page) },
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

export default async function LocalPage(props: PageProps<"/[city]/[service]">) {
  const { city: citySlug, service } = await props.params;
  const page = pageOf(citySlug, service);
  const city = cityOf(citySlug);
  if (!page || !city) notFound();

  const [cover, ...work] = page.tiles;
  const siblings = pagesIn(city.slug).filter((p) => p !== page);

  return (
    <StripPage>
      <LdJson
        data={localGraph({
          url: localHref(page),
          name: page.name,
          service: page.service,
          description: page.description,
          price: page.price,
          faqs: page.faqs,
          city,
        })}
      />
      <Strip
        label={`${page.h1}: what it is, the work, the details, questions, and booking. One screen at a time, left and right.`}
        next={{ href: `/${city.slug}`, name: city.name }}
        paged
        deck="screens"
        bleed
        className="flex-1"
      >
        <LocalCover
          label={page.name}
          crumb={{ href: `/${city.slug}`, label: city.name }}
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
            heading: `Also in ${city.name}`,
            links: siblings.map((p) => ({ href: localHref(p), label: p.h1 })),
          }}
        />
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
