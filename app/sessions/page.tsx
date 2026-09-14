import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CallToAction } from "@/components/call-to-action";
import { Testimonials } from "@/components/testimonials";
import { SESSION_TYPES, formatPrice } from "@/lib/sessions";
import { BOOKING_URL } from "@/lib/site";
import { projectsIn, coverOf } from "@/lib/work";

/* ── sessions ─────────────────────────────────────────────────────
 * The consumer half of the site, and the half the old one served worst.
 *
 * Someone pricing a graduation shoot wants three things before they will
 * write an email: what it costs, what they get, and when they get it. The old
 * site made all three unfindable — the rates page was never written. So each
 * session type leads with those three facts, and the sample work is pulled
 * live from the archive so it can never go stale.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Sessions",
  description:
    "Graduation, headshots, studio digitals, and weddings in the San Francisco Bay Area. What each session includes and how long it takes.",
  alternates: { canonical: "/sessions" },
};

export default function SessionsPage() {
  return (
    <>
      <div className="pb-16 pt-24 sm:pt-28">
        <header className="mx-auto max-w-[100rem] px-6 sm:px-10">
          <h1 className="title">Sessions</h1>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Studio and location sessions across the San Francisco Bay Area.
            Everything below is booked directly, with no packages to decode.
          </p>
        </header>

        {/* The four of them across the page rather than down it: one
            column each, the photograph on top, the three facts that decide
            it under, and the enquiry at the foot. Julian asked for the
            sessions more horizontal, and they are four comparable things —
            a row is how you compare four of anything, where a stack of
            full-width bands makes you scroll and remember.

            Four across from `xl`, two from `sm`, one on a phone. */}
        <div className="mx-auto mt-10 max-w-[100rem] px-6 sm:mt-12 sm:px-10">
          <ul className="grid gap-8 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            {SESSION_TYPES.map((session) => {
              const sample = projectsIn(session.slug)[0];
              const cover = sample ? coverOf(sample) : null;

              return (
                /* `flex flex-col` on the card and `mt-auto` on the button,
                   so the four buttons line up across the row however much
                   the lists above them differ. */
                <li key={session.slug} className="flex flex-col">
                  {cover && sample ? (
                    <Link
                      href={`/work/${sample.slug}`}
                      /* One ratio for all four, not each frame's own: a row
                         of four photographs that each set their own height
                         is not a row. 4:5 upright from `sm`, which is what
                         most of the archive is shot at, so the crop is
                         slight. On a phone the four cards are a column and
                         four upright frames is 1700px of photograph to
                         scroll, so there it crops to 3:2. */
                      className="group relative block aspect-[3/2] overflow-hidden sm:aspect-[4/5]"
                      style={{ backgroundColor: cover.color }}
                    >
                      <Image
                        src={cover.src}
                        alt={cover.alt || sample.name}
                        width={cover.width}
                        height={cover.height}
                        sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="h-full w-full object-cover object-[50%_25%] transition-transform duration-500 ease-[var(--ease-out-strong)] hoverable:group-hover:scale-[1.02] motion-reduce:transition-none"
                      />
                    </Link>
                  ) : null}

                  <h2 className="mt-5 font-display text-2xl leading-tight sm:text-3xl">
                    {session.name}
                  </h2>
                  <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4">
                    <div>
                      <dt className="label text-muted-foreground">Rate</dt>
                      <dd className="mt-1.5 text-sm">
                        {formatPrice(session.from)}
                      </dd>
                    </div>
                    <div>
                      <dt className="label text-muted-foreground">Turnaround</dt>
                      <dd className="mt-1.5 text-sm">{session.turnaround}</dd>
                    </div>
                  </dl>

                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {session.blurb}
                  </p>

                  <h3 className="label mt-4 text-muted-foreground">Includes</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {session.includes.map((item) => (
                      <li key={item} className="text-sm text-muted-foreground">
                        {item}
                      </li>
                    ))}
                  </ul>

                  {/* Once a booking calendar exists, a session client can
                      take a slot without waiting on a reply — which is the
                      whole point for this audience. Until then the enquiry
                      form is the path. */}
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                    {BOOKING_URL ? (
                      <a
                        href={BOOKING_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="label glass-prominent rounded-full px-5 py-3 press active:scale-[0.97]"
                      >
                        Check availability
                      </a>
                    ) : null}
                    <Link
                      href={`/contact?type=session&session=${session.slug}`}
                      className="label glass inline-flex items-center gap-2 rounded-full px-5 py-3 press active:scale-[0.97]"
                    >
                      Enquire
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Testimonials />

      <CallToAction
        title="Check a date"
        body="Tell me roughly when and what for, and I'll confirm availability and the exact rate."
        type="session"
      />
    </>
  );
}
