import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { shareOg } from "@/lib/share";
import { LdJson } from "@/components/local-screens";
import { V3Foot } from "@/components/v3/chrome";
import { CAMPUS_GUIDES, campusGuide, campusHref } from "@/lib/campus-guides";
import { getProject } from "@/lib/work";
import { SITE } from "@/lib/seo";

/* ── a campus guide ───────────────────────────────────────────────
 * Where I shoot grad photos on one campus, under the graduation
 * booking page. The booking page's layout (`components/v3/service.tsx`):
 * the title, the spots' photographs, the spots and questions as rows.
 * The words are in `lib/campus-guides.ts`.
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
  /* The guide's photo row, each captioned with its spot. */
  const shown = c.photos.flatMap((src) => {
    const f = images.find((x) => x.src === src);
    const spot = c.spots.find((s) => s.frames.includes(src));
    return f && spot ? [{ spot: spot.name, f }] : [];
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
          <div className="a-seq sv-seq">
            {shown.map(({ spot, f }) => (
              <figure key={f.src}>
                <div className="ph">
                  <Image src={f.src} alt={f.alt || `Graduation photo at ${spot} by Julian Gigola`} fill sizes="(max-width: 700px) 50vw, 30vw" style={{ objectFit: "cover", background: f.color }} />
                </div>
                <figcaption className="lbl mute">{spot}</figcaption>
              </figure>
            ))}
          </div>
          <div className="sv-info" id="spots">
            {c.spots.map((s, i) => (
              <section className="sv-row" key={s.name}>
                <h2 className="lbl mute">{String(i + 1).padStart(2, "0")} · {s.name}</h2>
                <p>{s.note}</p>
              </section>
            ))}
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
          <V3Foot />
        </section>
      </div>
    </>
  );
}
