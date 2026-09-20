import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, TitleCell } from "@/components/strip-page";
import { EnquiryCell } from "@/components/enquiry-cell";
import { Testimonials } from "@/components/testimonials";
import { SESSION_TYPES, formatPrice } from "@/lib/sessions";
import { BOOKING_URL } from "@/lib/site";
import { CONTACT, projectsIn, coverOf } from "@/lib/work";

/* ── sessions ─────────────────────────────────────────────────────
 * The consumer half of the site, and the half the old one served worst.
 *
 * Someone pricing a graduation shoot wants three things before they will
 * write an email: what it costs, what they get, and when they get it. The old
 * site made all three unfindable — the rates page was never written. So each
 * session type leads with those three facts, and the sample work is pulled
 * live from the archive so it can never go stale.
 *
 * Sideways, like the rest of the site: each session is a photograph and the
 * card beside it, so the four run past in one row and the
 * comparison is a wheel rather than a scroll and a memory. The words scroll
 * inside their own column when a screen is too short for them — that is the
 * `data-scroll` box, and the strip yields the wheel to it.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Sessions",
  description:
    "Graduation, headshots, studio digitals, and weddings in the San Francisco Bay Area. What each session includes and how long it takes.",
  alternates: { canonical: "/sessions" },
};

export default function SessionsPage() {
  return (
    <StripPage
      head={
        <StripHead
          crumb={
            <Link
              prefetch={false}
              href="/work"
              className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
            >
              &larr; The work
            </Link>
          }
          title="Sessions"
          live
          aside={`${SESSION_TYPES.length} session types`}
        />
      }
    >
      <Strip
        label={`Sessions: ${SESSION_TYPES.length} session types, left and right`}
        next={CONTACT}
        className="mt-4 flex-1"
      >
        {[
          <TitleCell key="title" title="Sessions" hash="sessions">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Studio and location sessions across the San Francisco Bay Area.
              Everything here is booked directly, with no packages to decode.
            </p>
          </TitleCell>,

          ...SESSION_TYPES.flatMap((session, i) => {
            const sample = projectsIn(session.slug)[0];
            const cover = sample ? coverOf(sample) : null;

            return [
              cover && sample ? (
                <Link
                  key={`${session.slug}-cover`}
                  prefetch={false}
                  href={`/work/${sample.slug}`}
                  data-tick
                  /* Julian: `View more`, not `View project`. The frame is
                     a sample of the session and not the project it happens
                     to come from, so the word points at more of this kind
                     of work rather than naming a project the visitor never
                     asked about. */
                  data-ring="View more"
                  aria-label={`${session.name}: see ${sample.name}`}
                  /* One ratio for all four, not each frame's own: a row of
                     photographs that each set their own height is not a row.
                     4:5 upright, which is what most of the archive is shot
                     at, so the crop is slight. */
                  className="group strip-cell relative block aspect-[4/5] w-full shrink-0 overflow-hidden sm:h-full sm:w-auto"
                  style={
                    {
                      backgroundColor: cover.color,
                      "--i": i,
                    } as React.CSSProperties
                  }
                >
                  <Image
                    src={cover.src}
                    alt={cover.alt || sample.name}
                    fill
                    // 4:5 and as tall as the strip: see `cover-cell.tsx`.
                    sizes="(min-width: 640px) and (min-resolution: 2.5dppx) calc((100vh - 10rem) * 0.534), (min-width: 640px) calc((100vh - 10rem) * 0.8), 100vw"
                    // The first is the one on screen when the page opens.
                    priority={i === 0}
                    loading={i === 0 ? undefined : "lazy"}
                    data-fade={i === 0 ? undefined : ""}
                    className="strip-frame object-cover object-[50%_25%]"
                  />
                </Link>
              ) : null,

              <div
                key={session.slug}
                data-tick
                data-label={session.name}
                data-hash={session.slug}
                className="flex w-full shrink-0 flex-col justify-center gap-8 py-8 sm:h-full sm:w-[min(22rem,60vw)] sm:py-0"
              >
                {/* The words take the height they need and scroll inside
                    themselves when the window is shorter than they are,
                    rather than pushing the button for booking off the
                    bottom of a laptop screen. */}
                <div
                  data-scroll
                  className="flex min-h-0 flex-col gap-8 overflow-y-auto overscroll-contain pr-2"
                >
                  <h2 className="font-display text-2xl uppercase leading-none tracking-[0] sm:text-3xl">
                    {session.name}
                  </h2>

                  <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
                    <div>
                      <dt className="label text-muted-foreground">Rate</dt>
                      <dd className="mt-1.5 text-sm">
                        {formatPrice(session.from)}
                      </dd>
                    </div>
                    <div>
                      <dt className="label text-muted-foreground">
                        Turnaround
                      </dt>
                      <dd className="mt-1.5 text-sm">{session.turnaround}</dd>
                    </div>
                  </dl>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {session.blurb}
                  </p>

                  <div>
                    <h3 className="label text-muted-foreground">Includes</h3>
                    <ul className="mt-4 flex flex-col gap-3">
                      {session.includes.map((item) => (
                        <li
                          key={item}
                          className="text-sm text-muted-foreground"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Once a booking calendar exists, a session client can take
                    a slot without waiting on a reply — which is the whole
                    point for this audience. Until then the enquiry form is
                    the path. */}
                {/* Julian: to the right. The cell is a narrow column of
                    label and value read down the left; the one thing to
                    press is put at the other end of the rule under it, so
                    it is not a seventh line of the list. */}
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-6">
                  {BOOKING_URL ? (
                    <a
                      href={BOOKING_URL}
                      target="_blank"
                      rel="noreferrer"
                      data-ring="Book"
                      className="label action px-5 py-3 press active:scale-[0.97]"
                    >
                      Check availability
                    </a>
                  ) : null}
                  <Link
                    href={`/contact?type=session&session=${session.slug}`}
                    data-ring="Book"
                    className="label action-quiet inline-flex items-center gap-2 px-5 py-3 press active:scale-[0.97]"
                  >
                    Enquire
                  </Link>
                </div>
              </div>,
            ];
          }),

          <Testimonials key="testimonials" cells />,

          <EnquiryCell
            key="enquire"
            title="Book a session"
            body="Tell me roughly when and what for, and I'll confirm the date and the exact rate."
            type="session"
            next={CONTACT}
          />,
        ]}
      </Strip>
    </StripPage>
  );
}
