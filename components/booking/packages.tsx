import Image from "next/image";
import Link from "next/link";
import { PageFoot } from "@/components/site/foot";
import { LENGTH, SESSIONS, TAB_ORDER, priceLabel, type SessionSlug } from "@/lib/booking/catalog";
import { depositFor } from "@/lib/leads/deposit-terms";
import { pad } from "@/lib/utils";

/* /book's first step: the sessions that book online as package cards, cheapest
   first (Julian's mock, 2026-11-25). A card opens that session's calendar
   (/book/<slug>), whose rail counts this screen as step 01. Every word and
   figure is the catalog's. `data-step` on a link: the page moves right to left
   on that trip where `?slide` is on (lib/flags/slide-flag.ts). */

/** The sessions with a price and a deposit: the ones a card can sell. */
const CARDS = TAB_ORDER.map((x) => SESSIONS[x])
  .filter((s) => s.paid && s.from != null)
  .sort((a, b) => a.from! - b.from!);
/** A card's own photograph where the calendar's is not the one (Julian's pick). */
const PHOTO: Partial<Record<SessionSlug, string>> = { portraits: "/work/azure-bloom/08.jpg" };
/** The paid flow's steps after this one (`stepsCopy`, components/booking/picker/steps.tsx). */
const STEPS = ["Session", "Time", "You", "Deposit", "Booked"];
const MORE: [string, string, string][] = [
  [SESSIONS["model-test"].name, priceLabel(SESSIONS["model-test"]), "/book/model-test"],
  [SESSIONS.weddings.name, priceLabel(SESSIONS.weddings), "/book/weddings"],
  ["Not sure what you need?", "Book a 15 min call", "/book/consultation"],
  ["Commission or campaign?", "Inquire", "/contact/form"],
];

export function Packages() {
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-pk">
        <div className="pk">
          <ol className="rail lbl" aria-label="Steps">
            {STEPS.map((n, i) => (
              <li key={n} className={i ? undefined : "cur"} aria-current={i ? undefined : "step"}>
                {pad(i + 1)} <span className="nm">{n}</span>
              </li>
            ))}
          </ol>
          <div className="f-head">
            <h1>Book a session</h1>
          </div>
          <ul className="pk-row">
            {CARDS.map((s, k) => {
              const href = `/book/${s.slug}`;
              return (
                <li className="pk-c" key={s.slug}>
                  {/* the button under it is the link a keyboard and a screen reader get */}
                  <Link className="pk-ph" href={href} data-step tabIndex={-1} aria-hidden="true">
                    <Image
                      src={PHOTO[s.slug] ?? s.photo.d}
                      alt=""
                      fill
                      sizes="(max-width: 1023px) 84vw, 25vw"
                      loading={k < 2 ? "eager" : "lazy"}
                    />
                  </Link>
                  <h2>
                    {s.name} <span>{priceLabel(s)}</span>
                  </h2>
                  <ul className="pk-in">
                    {s.includes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                  <dl className="pk-dl lbl">
                    <div>
                      <dt>Length</dt>
                      <dd>{LENGTH[s.slug]} min</dd>
                    </div>
                    <div>
                      <dt>Deposit</dt>
                      <dd>${depositFor(s.cal?.split("/")[1] ?? "")}</dd>
                    </div>
                    {s.turnaround ? (
                      <div>
                        <dt>Delivery</dt>
                        <dd>{s.turnaround}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <Link className={k ? "btn" : "btn fill"} href={href} data-step>
                    Book {s.name.toLowerCase()}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="pk-more lbl">
            {MORE.map(([q, a, href]) => (
              <Link key={href} href={href} prefetch={false} data-step={href.startsWith("/book/") ? "" : undefined}>
                <span>{q}</span>
                <b>
                  {a} <i aria-hidden="true">&rarr;</i>
                </b>
              </Link>
            ))}
          </p>
        </div>
      </section>
      <PageFoot bare />
    </div>
  );
}
