import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { shareOg } from "@/lib/og/share";
import { LdJson } from "@/components/site/ld-json";
import { PageFoot } from "@/components/site/foot";
import { CampusSpots } from "@/components/booking/campus-spots";
import { CAMPUS_GUIDES, campusGuide, campusHref } from "@/lib/graduation/campus-guides";
import { getProject } from "@/lib/work/work";
import { SITE } from "@/lib/og/seo";

/* ── a campus guide ───────────────────────────────────────────────
 * Where I shoot grad photos on one campus, under the graduation
 * booking page. The booking page's layout (`components/booking/service.tsx`):
 * the title, the spots' photographs, the spots and questions as rows.
 * The words are in `lib/graduation/campus-guides.ts`.
 * ─────────────────────────────────────────────────────────────── */

export function generateStaticParams() {
  return CAMPUS_GUIDES.map((c) => ({ campus: c.slug }));
}

export async function generateMetadata(
  props: PageProps<"/graduation-photos/[campus]">,
): Promise<Metadata> {
  const { campus } = await props.params;
  const c = campusGuide(campus);
  if (!c) return {};
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: campusHref(c) },
    ...shareOg(c.title, c.description),
  };
}

export default async function CampusPage(props: PageProps<"/graduation-photos/[campus]">) {
  const { campus } = await props.params;
  const c = campusGuide(campus);
  if (!c) notFound();

  const images = getProject("graduation")?.images ?? [];
  /* The spots that have a photograph, each with its first frame from the guide's photos (s4). */
  const held = c.spots.flatMap((s) => {
    const f = images.find((x) => x.src === c.photos.find((p) => s.frames.includes(p)));
    return f ? [{ name: s.name, note: s.note, src: f.src, alt: f.alt || `Graduation photo at ${s.name} by Julian Gigola`, color: f.color }] : [];
  });
  const url = `${SITE}${campusHref(c)}`;

  return (
    <>
      <LdJson
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "FAQPage",
              "@id": `${url}#questions`,
              mainEntity: c.faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Julian Gigola", item: SITE },
                { "@type": "ListItem", position: 2, name: "Graduation", item: `${SITE}/graduation-photos` },
                { "@type": "ListItem", position: 3, name: c.name, item: url },
              ],
            },
          ],
        }}
      />
      <div className="v3 contents">
        <section className="v3page" id="p-campus">
          <header className="sv-top">
            <p className="lbl mute">{c.kicker}</p>
            <h1 className="pg-t">{c.h1}</h1>
            <p className="sv-lead">{c.lead}</p>
            <div className="ctas">
              <Link className="btn fill" href="/graduation-photos#book">Book a graduation session</Link>
              <Link className="btn" href="#spots">See the spots</Link>
            </div>
          </header>
          <div className="sv-info" id="spots">
            <CampusSpots spots={held} />
            <section className="sv-row">
              <h2 className="lbl mute">How I plan the session</h2>
              <p>{c.plan}</p>
            </section>
            <section className="sv-row">
              <h2 className="lbl mute">Questions</h2>
              <div>
                {c.faqs.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
            <section className="sv-row">
              <h2 className="lbl mute">Book</h2>
              <ul>
                <li><Link href="/graduation-photos">Graduation photos in San Jose & San Francisco<span aria-hidden>→</span></Link></li>
              </ul>
            </section>
          </div>
          <PageFoot />
        </section>
      </div>
    </>
  );
}
