"use client";

import Link from "next/link";
import { Duo } from "@/components/site/duo";
import { DOORS } from "@/lib/photos";
import { INDEX_ORDER, SESSIONS } from "@/lib/booking/catalog";

/** The two ways in, commissions and sessions: closes the home page and the booking pages. */
export function Doors() {
  return (
    <div className="doors">
      <div className="door">
        <Duo dark={DOORS.commissions.d} light={DOORS.commissions.l} alt="" sizes="(max-width: 800px) 100vw, 50vw" />
        <span className="lbl mute">For art directors and artists</span>
        <h3>Have something in mind?</h3>
        <p>
          Campaigns, editorial, cover art and presskits. Tell me what you have in mind and I&apos;ll come back with an approach and a quote.
        </p>
        <div>
          <Link className="btn fill" href="/contact/form">
            Inquire
          </Link>
        </div>
      </div>
      <div className="door">
        <Duo dark={DOORS.book.d} light={DOORS.book.l} alt="" sizes="(max-width: 800px) 100vw, 50vw" />
        <span className="lbl mute">For private clients</span>
        <h3>Book a session</h3>
        <ul className="lbl">
          {INDEX_ORDER.map((slug) => (
            <li key={slug}>
              <Link href={`/book/${slug}`}>
                {SESSIONS[slug].name}
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
