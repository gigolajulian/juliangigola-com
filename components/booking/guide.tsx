import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { shareOg } from "@/lib/og/share";
import { serviceGraph } from "@/lib/og/seo";
import { LdJson } from "@/components/site/ld-json";
import { ServiceBook } from "@/components/booking/service";
import { guidePage } from "@/lib/booking/service-pages";

/* A page under a booking page (/headshots/teams, /music-photography/cover-art) or a city page
   (/san-jose-photographer): the booking page's layout and structured data, its words in
   `GUIDE_PAGES` (`lib/booking/service-pages.ts`). */

export function guideMetadata(slug: string): Metadata {
  const p = guidePage(slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/${p.slug}` },
    ...shareOg(p.title, p.description),
  };
}

export function GuideView({ slug }: { slug: string }) {
  const p = guidePage(slug);
  if (!p) notFound();
  return (
    <>
      <LdJson
        data={serviceGraph({
          url: `/${p.slug}`,
          name: p.name,
          service: p.service,
          description: p.description,
          price: p.price,
          faqs: p.faqs,
          places: p.area ?? p.where.map((w) => w.name),
          parent: p.parent,
        })}
      />
      <ServiceBook page={p} frames={p.tiles.map((t) => t.frame)} />
    </>
  );
}
