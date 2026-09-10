import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Reveal } from "@/components/reveal";
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
    <div className="pb-24 pt-28 sm:pt-36">
      <header className="mx-auto max-w-[100rem] px-6 sm:px-10">
        <h1 className="title">
          Sessions
        </h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Studio and location sessions across the San Francisco Bay Area. Everything below is
          booked directly &mdash; no packages to decode.
        </p>
      </header>

      <div className="mx-auto mt-16 max-w-[100rem] px-6 sm:mt-24 sm:px-10">
        <ul className="flex flex-col gap-20 sm:gap-32">
          {SESSION_TYPES.map((session, i) => {
            const samples = projectsIn(session.slug).slice(0, 2);

            return (
              <li key={session.slug}>
                <Reveal>
                  <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
                    {/* Facts first, image second — on a phone the price
                        should not be below a full-height photograph. */}
                    <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
                      <h2 className="font-display text-3xl leading-tight sm:text-4xl">
                        {session.name}
                      </h2>
                      <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
                        {session.blurb}
                      </p>

                      <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-6">
                        <div>
                          <dt className="label text-muted-foreground">Rate</dt>
                          <dd className="mt-2 text-sm">{formatPrice(session.from)}</dd>
                        </div>
                        <div>
                          <dt className="label text-muted-foreground">Turnaround</dt>
                          <dd className="mt-2 text-sm">{session.turnaround}</dd>
                        </div>
                      </dl>

                      <h3 className="label mt-8 text-muted-foreground">Includes</h3>
                      <ul className="mt-3 flex flex-col gap-2">
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
                      <div className="mt-10 flex flex-wrap items-center gap-3">
                        {BOOKING_URL ? (
                          <a
                            href={BOOKING_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="label border border-foreground bg-foreground px-5 py-3 text-background transition-[opacity,transform] duration-150 ease-out hoverable:hover:opacity-90 active:scale-[0.98]"
                          >
                            Check availability
                          </a>
                        ) : null}
                        <Link
                          href={`/contact?type=session&session=${session.slug}`}
                          className="label inline-flex items-center gap-2 border border-border px-5 py-3 transition-[background-color,transform] duration-150 ease-out hoverable:hover:bg-card active:scale-[0.98]"
                        >
                          Enquire about {session.name.toLowerCase()}
                        </Link>
                      </div>
                    </div>

                    <div className={i % 2 === 1 ? "lg:order-1" : undefined}>
                      {/* Most session categories are a single gallery, so a hard
                          two-column grid would render one sample at half width
                          against empty space. */}
                      {samples.length ? (
                        <div
                          className={
                            samples.length === 2 ? "grid grid-cols-2 gap-4" : "grid grid-cols-1"
                          }
                        >
                          {samples.map((project) => {
                            const cover = coverOf(project);
                            return (
                              <Link
                                key={project.slug}
                                href={`/work/${project.slug}`}
                                className="group relative block overflow-hidden"
                                style={{
                                  backgroundColor: cover.color,
                                  aspectRatio: `${cover.width} / ${cover.height}`,
                                }}
                              >
                                <Image
                                  src={cover.src}
                                  alt={cover.alt || project.name}
                                  width={cover.width}
                                  height={cover.height}
                                  sizes={
                                    samples.length === 2
                                      ? "(min-width: 1024px) 25vw, 50vw"
                                      : "(min-width: 1024px) 50vw, 100vw"
                                  }
                                  className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-out-strong)] hoverable:group-hover:scale-[1.02] motion-reduce:transition-none"
                                />
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Reveal>
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
