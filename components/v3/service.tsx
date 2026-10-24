import Image from "next/image";
import Link from "next/link";
import { V3Foot } from "@/components/v3/chrome";
import { Run } from "@/components/v3/flow";
import { Doors } from "@/components/v3/home";
import { BOOKING_PAGES, bookingHref, type BookingPage } from "@/lib/booking";
import { SESSIONS, type SessionSlug } from "@/lib/v3";
import type { Frame } from "@/lib/work-types";

/* JG V3 service page (leftovers sheet, card A): the title on the left with
   the rate and includes as a run and the two buttons, the frames in the
   home's three-column sequence, the details and questions as rows, then
   the two doors. The words are `lib/booking.ts`'s, unchanged. */

export function V3Service({ page, frames }: { page: BookingPage; frames: Frame[] }) {
  const s = SESSIONS[page.slug as SessionSlug];
  const cols = [0, 1, 2].map((c) => frames.filter((_, i) => i % 3 === c));
  const others = BOOKING_PAGES.filter((p) => p !== page);
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-service">
        <header className="sv-top">
          <p className="lbl mute">{page.kicker}</p>
          <h1 className="pg-t">{page.h1.replace(/San (Francisco|Jose)/g, "San $1")}</h1>
          <p className="sv-lead">{page.lead}</p>
          <Run className="inc lbl" items={[page.rate, ...(s?.includes ?? []), ...(page.turnaround ? [`Ready in ${page.turnaround}`] : [])]} />
          <div className="ctas">
            <Link className="btn fill" href={s ? `/book/${s.slug}` : "/contact/form"}>{page.book.title}</Link>
            <Link className="btn" href="#work">See the work</Link>
          </div>
        </header>
        <div className="b-head seq-head" id="work">
          <h2>{page.gallery.label}</h2>
          <Link className="btn" href={page.gallery.href}>See the gallery</Link>
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
        <div className="sv-info">
          {page.blocks.map((b) => (
            <section className="sv-row" key={b.heading}>
              <h2 className="lbl mute">{b.heading}</h2>
              {b.items ? (
                <ul>{b.items.map((x) => <li key={x}>{x}</li>)}</ul>
              ) : (
                <p>{b.body}</p>
              )}
            </section>
          ))}
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
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
          <section className="sv-row">
            <h2 className="lbl mute">Also booking</h2>
            <ul>
              {others.map((p) => (
                <li key={p.slug}><Link href={bookingHref(p)}>{p.h1}<span aria-hidden>→</span></Link></li>
              ))}
            </ul>
          </section>
        </div>
        <Doors />
        <V3Foot />
      </section>
    </div>
  );
}
