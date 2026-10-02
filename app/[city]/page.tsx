import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Strip } from "@/components/strip";
import { StripPage } from "@/components/strip-page";
import { ContactScreen } from "@/components/contact-screen";
import {
  LdJson,
  LocalCover,
  LocalServices,
} from "@/components/local-screens";
import { CITIES, cityOf, localHref, pagesIn } from "@/lib/locations";
import { WORK_PAGE } from "@/lib/work";
import { localGraph } from "@/lib/seo";
import { RESPONSE_TIME } from "@/lib/site";

/* ── a city ───────────────────────────────────────────────────────
 * /san-jose: "photographer in San Jose" is a search in its own right, and
 * this is the page that answers it, and the door to each booking page in
 * the city. Three screens: who and where, the services, the form.
 * ─────────────────────────────────────────────────────────────── */

export const dynamicParams = false;

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

const COPY: Record<string, { title: string; description: string; lead: string }> = {
  "san-jose": {
    title: "Photographer in San Jose & Silicon Valley",
    description:
      "Photographer in San Jose and Silicon Valley: graduation photos at SJSU and SCU, headshots, portraits, model digitals, brand campaigns and music.",
    lead: "Photographer and creative director working in San Jose and across Silicon Valley: graduation photos at SJSU and Santa Clara, headshots, portraits and digitals, and campaigns, press photos and music videos for brands and artists.",
  },
};

export async function generateMetadata(
  props: PageProps<"/[city]">,
): Promise<Metadata> {
  const { city } = await props.params;
  const copy = COPY[city];
  if (!copy) return {};
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: `/${city}` },
    openGraph: { title: copy.title, description: copy.description },
  };
}

export default async function CityPage(props: PageProps<"/[city]">) {
  const { city: slug } = await props.params;
  const city = cityOf(slug);
  const copy = COPY[slug];
  if (!city || !copy) notFound();

  const pages = pagesIn(city.slug);
  /* The cover: the brand page's lead photograph, the work that most
     looks like the rest of the site. */
  const frame = (pages.find((p) => p.slug === "brand-photography") ?? pages[0])
    ?.tiles[0]?.frame;

  return (
    <StripPage>
      <LdJson
        data={localGraph({
          url: `/${city.slug}`,
          name: city.name,
          service: "Photography",
          description: copy.description,
          price: null,
          faqs: [],
          city,
        })}
      />
      <Strip
        label={`Julian Gigola in ${city.name}: the services, and how to book. One screen at a time, left and right.`}
        next={WORK_PAGE}
        paged
        deck="screens"
        bleed
        className="flex-1"
      >
        <LocalCover
          label={city.name}
          kicker={`${city.name} · ${city.region}`}
          title={`Photographer in ${city.name}`}
          lead={copy.lead}
          facts={["Studio or location", ...(RESPONSE_TIME ? [`Replies ${RESPONSE_TIME}`] : [])]}
          actions={[
            { href: "#services", label: "See the services" },
            { href: "#book", label: "Get in touch", quiet: true },
          ]}
          frame={frame}
          alt={`Photography by Julian Gigola, photographer in ${city.name}`}
        />
        <LocalServices
          city={city.name}
          items={pages.map((p) => ({
            href: localHref(p),
            name: p.name,
            rate: p.rate,
            lead: p.lead,
          }))}
        />
        <ContactScreen label="Book" hash="book" />
      </Strip>
    </StripPage>
  );
}
