import type { Metadata } from "next";
import { shareOg } from "@/lib/share";
import { notFound } from "next/navigation";
import { LdJson } from "@/components/local-screens";
import { BOOKING_PAGES, bookingHref, bookingPage } from "@/lib/booking";
import { LINKABLE, getProject, projectsIn } from "@/lib/work";
import { serviceGraph } from "@/lib/seo";
import { V3Service } from "@/components/v3/service";

/* ── a booking page ───────────────────────────────────────────────
 * One service, at the root: /headshots, /graduation-photos. Built from
 * the homepage's own screens: its floating cover with this service's
 * photographs and title, the testimonials, the details and questions on
 * one screen, and the form, set to this service. The words are in
 * `lib/booking.ts`.
 * ─────────────────────────────────────────────────────────────── */

/* Prerendered, and rendered on request where the prerendered copy is
   not there: a Workers preview upload carries no cache, and
   `dynamicParams = false` turned every miss into a 404. Any address
   at the root that `lib/booking.ts` does not list is a 404 all the
   same, from `notFound()` below. */
export function generateStaticParams() {
  return BOOKING_PAGES.map((p) => ({ service: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/[service]">,
): Promise<Metadata> {
  const { service } = await props.params;
  const page = bookingPage(service);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: bookingHref(page) },
    ...shareOg(page.name, `${page.name} with Julian Gigola in the San Francisco Bay Area. ${page.rate}.`),
  };
}

export default async function BookingPage(props: PageProps<"/[service]">) {
  const { service } = await props.params;
  const page = bookingPage(service);
  if (!page) notFound();

  /* The cover's frames: each tile's photograph, opening what the
     tile opens (the gallery, or a project). Headshot 09 stays in the
     gallery, not on the cover. */
  const work = page.tiles
    .filter((t) => !t.frame.src.endsWith("/headshots/09.jpg"))
    .flatMap((t) => {
      const project = getProject(t.href.split("/").pop() ?? "");
      return project ? [{ ...project, cover: t.frame }] : [];
    });
  /* A session carries its gallery as a screen of its own: the frames
     chosen for it where the gallery is large (`picks`,
     `lib/booking.ts`), all of it where it fits in four rows of five,
     and otherwise fourteen, taken in turn from each of the
     discipline's projects or spread through the one gallery. */
  const slug = page.gallery.href.split("/").pop() ?? "";
  const one = getProject(slug);
  const sets = (one ? [one] : projectsIn(slug)).map((p) => p.images);
  const total = sets.reduce((n, s) => n + s.length, 0);
  const all = sets.flat();
  const sheet = !page.session
    ? undefined
    : page.picks
      ? /* A pick may come from any set (Portraits). */
        page.picks.flatMap((src) => [...all, ...LINKABLE.flatMap((p) => p.images)].filter((f) => f.src === src).slice(0, 1))
      : total <= 19
      ? all
      : sets.length === 1
        ? Array.from({ length: 14 }, (_, i) => sets[0][Math.floor((i * total) / 14)])
        : Array.from({ length: Math.max(...sets.map((s) => s.length)) }, (_, k) =>
            sets.flatMap((s) => (s[k] ? [s[k]] : [])),
          )
            .flat()
            .slice(0, 14);
  const graph = (
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
  );

  /* JG V3 (leftovers card A). */
  return (
    <>
      {graph}
      <V3Service page={page} frames={sheet ?? work.map((p) => p.cover)} />
    </>
  );
}
