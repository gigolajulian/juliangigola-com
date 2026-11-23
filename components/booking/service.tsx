import Image from "next/image";
import Link from "next/link";
import { PageFoot } from "@/components/site/chrome";
import { V3BookFlow } from "@/components/booking/book";
import { Run } from "@/components/booking/flow";
import { Doors } from "@/components/site/doors";
import { ServiceBar } from "@/components/booking/service-bar";
import { BOOKING_PAGES, bookingHref, type BookingPage } from "@/lib/booking/service-pages";
import { CAMPUS_GUIDES, campusHref } from "@/lib/graduation/campus-guides";
import { SESSIONS, type SessionSlug } from "@/lib/photos-and-sessions";
import type { Frame } from "@/lib/work/work-types";

/* JG V3 service page (leftovers sheet, card A): the title on the left with
   the rate and includes as a run and the two buttons, the frames in the
   home's three-column sequence, the details and questions as rows, then
   the two doors. The words are `lib/booking/service-pages.ts`'s, unchanged. */

export function V3Service({ page, frames }: { page: BookingPage; frames: Frame[] }) {
  /* Its booking on the V3 stepper: the same slug, or the session that books the same event. */
  const s = SESSIONS[page.slug as SessionSlug] ?? Object.values(SESSIONS).find((x) => x.cal === page.book.cal);
  const includes = page.blocks.find((b) => b.heading === "What's included")?.items ?? [];
  /* Six frames, two a column (Julian); the gallery holds the rest. */
  const cols = [0, 1, 2].map((c) => frames.slice(0, 6).filter((_, i) => i % 3 === c));
  const others = BOOKING_PAGES.filter((p) => p !== page);
  /* Julian's picks: one frame beside the title; on portraits gilt 03 (his) and shattered-mercury 04 (the red one), 2026-11-10. */
  const hero = (page.slug === "portraits" ? [frames[0], frames[4]] : [frames[0]]).filter(Boolean);
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-service">
        <div className="sv-hero">
        <header className="sv-top">
          <p className="lbl mute">{page.kicker}</p>
          <h1 className="pg-t">{page.h1.replace(/San (Francisco|Jose)/g, "San $1")}</h1>
          <p className="sv-lead">{page.lead}</p>
          <Run className="inc lbl" items={[page.rate, ...includes, ...(page.turnaround ? [`Ready in ${page.turnaround}`] : [])]} />
          <div className="ctas">
            <Link className="btn fill" href={s ? "#book" : "/contact/form"}>{page.book.title}</Link>
            <Link className="btn" href="#work">See the work</Link>
          </div>
        </header>
        {/* The empty side of the title, filled with this session's own frames at their own shape. */}
        <div className="sv-pics" data-n={hero.length} aria-hidden="true">
          {hero.map((f) => (
            <Image key={f.src} src={f.src} alt="" width={f.width} height={f.height} sizes="(max-width: 1023px) 1px, 40vw" loading="eager" style={{ background: f.color }} />
          ))}
        </div>
        </div>
        <div className="b-head seq-head" id="work">
          <h2>{page.gallery.label}</h2>
          {/* Headshots and Graduation show their whole gallery right here: the old address redirects back to this screen (next.config.ts), so a button would loop. */}
          {!/#work$|^\/portfolio\/headshots$/.test(page.gallery.href) && <Link className="btn" href={page.gallery.href}>See the gallery</Link>}
        </div>
        <div className="a-seq sv-seq">
          {cols.map((c, k) => (
            <div className="col" key={k}>
              {c.map((f) => (
                <figure key={f.src}>
                  <div className="ph">
                    <Image src={f.src} alt={f.alt || `${page.name} by Julian Gigola`} fill sizes="(max-width: 700px) 50vw, 30vw" style={{ objectFit: "cover", background: f.color }} />
                  </div>
                </figure>
              ))}
            </div>
          ))}
        </div>
        {s ? (
          <section className="sv-book" id="book">
            <V3BookFlow slug={s.slug} tabs={false} />
          </section>
        ) : null}
        <div className="sv-info">
          {page.blocks.map((b) => (
            <section className={b.items ? "sv-row sv-v4" : "sv-row"} key={b.heading}>
              <h2 className="lbl mute">{b.heading}</h2>
              {b.items ? (
                <ul>{b.items.map((x) => <li key={x}>{x}</li>)}</ul>
              ) : (
                <p>{b.body}</p>
              )}
            </section>
          ))}
          {page.slug === "graduation-photos" ? (
            <section className="sv-row">
              <h2 className="lbl mute">Campus guides</h2>
              <ul>
                {CAMPUS_GUIDES.map((c) => (
                  <li key={c.slug}><Link href={campusHref(c)}>{c.h1}<span aria-hidden>→</span></Link></li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="sv-row">
            <h2 className="lbl mute">Where</h2>
            <ul>
              {page.where.map((w) => (
                <li key={w.name}><b>{w.name}</b><span className="mute">{w.note}</span></li>
              ))}
            </ul>
          </section>
          <section className="sv-row">
            <h2 className="lbl mute">Questions</h2>
            <div>
              {page.faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>
                    {f.link ? (
                      <>
                        {f.a.split(f.link.label)[0]}
                        <Link href={f.link.href}>{f.link.label}</Link>
                        {f.a.split(f.link.label)[1]}
                      </>
                    ) : (
                      f.a
                    )}
                  </p>
                </details>
              ))}
            </div>
          </section>
          <section className="sv-row">
            <h2 className="lbl mute">Also booking</h2>
            <ul>
              {others.map((p) => (
                <li key={p.slug}><Link href={bookingHref(p)}>{p.h1.replace(/\b(?!in\b)\w/g, (c) => c.toUpperCase())}<span aria-hidden>→</span></Link></li>
              ))}
            </ul>
          </section>
        </div>
        {/* s1: where the last screen starts, and the phone book bar that hides there. */}
        <span data-sv-end />
        <Doors />
        <PageFoot />
        <ServiceBar name={page.name} rate={page.rate} label={page.book.title} href={s ? "#book" : "/contact/form"} />
      </section>
    </div>
  );
}
