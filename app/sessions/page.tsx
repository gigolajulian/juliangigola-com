import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
      <div className="pb-16 pt-24 sm:pt-28">
        <header className="mx-auto max-w-[100rem] px-6 sm:px-10">
          <h1 className="title">Sessions</h1>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Studio and location sessions across the San Francisco Bay Area.
            Everything below is booked directly, with no packages to decode.
          </p>
        </header>

        <div className="mx-auto mt-10 max-w-[100rem] px-6 sm:mt-12 sm:px-10">
          <ul className="flex flex-col gap-12 sm:gap-16">
            {SESSION_TYPES.map((session, i) => {
              const samples = projectsIn(session.slug).slice(0, 2);

              return (
                <li key={session.slug}>
                  <Reveal>
                    <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
                      {/* Facts first, image second — on a phone the price
                        should not be below a full-height photograph. */}
                      <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
                        <h2 className="font-display text-3xl leading-tight sm:text-4xl">
                          {session.name}
                        </h2>
                        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
                          {session.blurb}
                        </p>

                        <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-5">
                          <div>
                            <dt className="label text-muted-foreground">
                              Rate
                            </dt>
                            <dd className="mt-2 text-sm">
                              {formatPrice(session.from)}
                            </dd>
                          </div>
                          <div>
                            <dt className="label text-muted-foreground">
                              Turnaround
                            </dt>
                            <dd className="mt-2 text-sm">
                              {session.turnaround}
                            </dd>
                          </div>
                        </dl>

                        <h3 className="label mt-6 text-muted-foreground">
                          Includes
                        </h3>
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {session.includes.map((item) => (
                            <li
                              key={item}
                              className="text-sm text-muted-foreground"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>

                        {/* Once a booking calendar exists, a session client can
                          take a slot without waiting on a reply — which is the
                          whole point for this audience. Until then the enquiry
                          form is the path. */}
                        <div className="mt-8 flex flex-wrap items-center gap-3">
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
                            className="label inline-flex items-center gap-2 glass rounded-full px-5 py-3 press active:scale-[0.97]"
                          >
                            Enquire about {session.name.toLowerCase()}
                          </Link>
                        </div>
                      </div>

                      <div
                        className={cn(
                          /* From `lg` the photographs take the height of the
                             facts beside them and no more: the column is the
                             grid row's height and the samples fill it, cropped
                             with object-cover. Julian wanted the page more
                             compact, and a full portrait beside four lines of
                             facts was where its height went. Under `lg` they
                             keep their own shape. */
                          "relative lg:min-h-[22rem]",
                          i % 2 === 1 && "lg:order-1",
                        )}
                      >
                        {/* Most session categories are a single gallery, so a hard
                          two-column grid would render one sample at half width
                          against empty space. */}
                        {samples.length ? (
                          <div
                            className={cn(
                              "grid lg:absolute lg:inset-0",
                              samples.length === 2
                                ? "grid-cols-2 gap-4"
                                : "grid-cols-1",
                            )}
                          >
                            {samples.map((project) => {
                              const cover = coverOf(project);
                              return (
                                <Link
                                  key={project.slug}
                                  href={`/work/${project.slug}`}
                                  // `aspect-auto!` because the ratio is inline, and from `lg` the height is the row and the width the column.
                                  className="group relative block overflow-hidden lg:aspect-auto! lg:h-full lg:w-full"
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
                                    // Cropped from a little above centre, so a face stays in the frame.
                                    className="h-full w-full object-cover lg:object-[50%_25%] transition-transform duration-500 ease-[var(--ease-out-strong)] hoverable:group-hover:scale-[1.02] motion-reduce:transition-none"
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
