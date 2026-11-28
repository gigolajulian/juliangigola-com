import { DsFaq } from "@/components/booking/ds-faq";
import { DsNextOpen } from "@/components/booking/ds-next-open";
import Image from "next/image";
import Link from "next/link";
import { PageFoot } from "@/components/site/foot";
import { BookFlow } from "@/components/booking/book";
import { DotList } from "@/components/booking/flow";
import { Doors } from "@/components/site/doors";
import { ServiceBar } from "@/components/booking/service-bar";
import { BOOKING_PAGES, CITY_PAGES, bookingHref, type BookingPage, type GuidePage } from "@/lib/booking/service-pages";
import { CAMPUS_GUIDES, campusHref } from "@/lib/graduation/campus-guides";
import { SESSIONS, type SessionSlug } from "@/lib/booking/catalog";
import type { Frame } from "@/lib/work/work-types";

/* JG V3 service page (leftovers sheet, card A): the title on the left with
   the rate and includes as a run and the two buttons, the frames in the
   home's three-column sequence, the details and questions as rows, then
   the two doors. The words are `lib/booking/service-pages.ts`'s, unchanged. */

/** Words of a text that are a link, the rest plain. */
const linked = (text: string, link?: { href: string; label: string }) =>
  link ? (
    <>
      {text.split(link.label)[0]}
      <Link href={link.href}>{link.label}</Link>
      {text.split(link.label)[1]}
    </>
  ) : (
    text
  );

export function ServiceBook({ page, frames }: { page: BookingPage | GuidePage; frames: Frame[] }) {
  /* Its booking on the V3 stepper: the same slug, or the session that books the same event. */
  const s =
    SESSIONS[page.slug as SessionSlug] ?? (page.book.cal ? Object.values(SESSIONS).find((x) => x.cal === page.book.cal) : undefined);
  const ask = s ? "#book" : (page.book.href ?? "/contact/form");
  const includes = page.blocks.find((b) => b.heading === "What's included")?.items ?? [];
  /* Six frames, two a column (Julian); the gallery holds the rest. A frame set beside the title is not repeated. */
  const seq = page.hero ? frames.filter((f) => f.src !== page.hero) : frames;
  const n = ("n" in page && page.n) || 6;
  const cols = [0, 1, 2].map((c) => seq.slice(0, n).filter((_, i) => i % 3 === c));
  const others = BOOKING_PAGES.filter((p) => p !== page);
  const here = `/${page.slug}`;
  /* Julian's picks: one frame beside the title; on portraits gilt 03 (his) and shattered-mercury 04 (the red one). */
  const hero = (
    page.slug === "portraits" ? [frames[0], frames[4]] : [frames.find((f) => f.src === page.hero) ?? frames[0]]
  ).filter(Boolean);
  const h1 = page.h1.replace(/San (Francisco|Jose)/g, "San $1");
  /* Event photography: the words before " in " on one line, scaled to fit (app/styles/v3.css). */
  const cut = page.h1One ? h1.indexOf(" in ") : -1;
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-service">
        <div className="sv-hero">
          <header className="sv-top">
            {page.kicker ? <p className="lbl mute">{page.kicker}</p> : null}
            <h1 className="pg-t">
              {cut > 0 ? (
                <>
                  <span className="one">{h1.slice(0, cut)}</span>
                  {h1.slice(cut).replace(" in ", " in ")}
                </>
              ) : (
                h1
              )}
            </h1>
            <p className="sv-lead">{page.lead}</p>
            <DotList className="inc lbl" items={[page.rate, ...includes, ...(page.turnaround ? [`Ready in ${page.turnaround}`] : [])]} />
            <div className="ctas">
              <Link className="btn fill" href={ask}>
                {page.book.title}
              </Link>
              <Link className="btn" href="#work">
                See the work
              </Link>
            </div>
            {s ? <DsNextOpen slug={s.slug} /> : null}
          </header>
          {/* The empty side of the title, filled with this session's own frames at their own shape. */}
          <div className="sv-pics" data-n={hero.length} aria-hidden="true">
            {hero.map((f) => (
              <Image
                key={f.src}
                src={f.src}
                alt=""
                width={f.width}
                height={f.height}
                sizes="(max-width: 1023px) 1px, 40vw"
                loading="eager"
                style={{ background: f.color }}
              />
            ))}
          </div>
        </div>
        <div className="b-head seq-head" id="work">
          <h2>{page.gallery.label}</h2>
          {/* Headshots and Graduation show their whole gallery right here: the old address redirects back to this screen (next.config.ts), so a button would loop. */}
          {!/#work$|^\/portfolio\/headshots$/.test(page.gallery.href) && (
            <Link className="btn" href={page.gallery.href}>
              See the gallery
            </Link>
          )}
        </div>
        <div className="a-seq sv-seq">
          {cols.map((c, k) => (
            <div className="col" key={k}>
              {c.map((f) => (
                <figure key={f.src}>
                  <div className="ph">
                    <Image
                      src={f.src}
                      alt={f.alt || `${page.name} by Julian Gigola`}
                      fill
                      sizes="(max-width: 700px) 50vw, 30vw"
                      style={{ objectFit: "cover", background: f.color }}
                    />
                  </div>
                </figure>
              ))}
            </div>
          ))}
        </div>
        {s ? (
          <section className="sv-book" id="book">
            <BookFlow slug={s.slug} tabs={false} />
          </section>
        ) : null}
        <div className="sv-info">
          {page.blocks.map((b) => (
            <section className={b.items ? "sv-row sv-v4" : "sv-row"} key={b.heading}>
              <h2 className="lbl mute">{b.heading}</h2>
              {b.items ? (
                <ul>
                  {b.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p>{linked(b.body ?? "", b.link)}</p>
              )}
            </section>
          ))}
          {page.slug === "graduation-photos" ? (
            <section className="sv-row">
              <h2 className="lbl mute">Campus guides</h2>
              <ul>
                {CAMPUS_GUIDES.map((c) => (
                  <li key={c.slug}>
                    <Link href={campusHref(c)}>
                      {c.h1}
                      <span aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="sv-row">
            <h2 className="lbl mute">Where</h2>
            <ul>
              {page.where.map((w) => (
                <li key={w.name}>
                  <b>{CITY_PAGES[w.name] && CITY_PAGES[w.name] !== here ? <Link href={CITY_PAGES[w.name]}>{w.name}</Link> : w.name}</b>
                  {w.note ? <span className="mute">{w.note}</span> : null}
                </li>
              ))}
            </ul>
          </section>
          <section className="sv-row">
            <h2 className="lbl mute">Questions</h2>
            <DsFaq />
            <div>
              {page.faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{linked(f.a, f.link)}</p>
                </details>
              ))}
            </div>
          </section>
          <section className="sv-row">
            <h2 className="lbl mute">Also booking</h2>
            <ul>
              {others.map((p) => (
                <li key={p.slug}>
                  <Link href={bookingHref(p)}>
                    {p.h1.replace(/\b(?!in\b)\w/g, (c) => c.toUpperCase())}
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
        {/* s1: where the last screen starts, and the phone book bar that hides there. */}
        <span data-sv-end />
        <Doors />
        <PageFoot />
        <ServiceBar name={page.name} rate={page.rate} label={page.book.title} href={ask} />
      </section>
    </div>
  );
}
