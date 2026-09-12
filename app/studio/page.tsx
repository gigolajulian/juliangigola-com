import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import Image from "next/image";
import { PRESS, FEATURED, coverOf } from "@/lib/work";

/* ── studio ───────────────────────────────────────────────────────
 * The old site split this across /about (real, and decent) and /rates
 * (never written — it still shipped the Format demo's biography, about a
 * New-Zealand-born photographer in New York represented by an agency that is
 * not his). One page, his own words only.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Studio",
  description:
    "Julian Gigola is a Bay Area creative director and photographer working in editorial, commercial, and artist imagery. Published in WIRED.",
  alternates: { canonical: "/studio" },
};

export default function StudioPage() {
  const portrait = FEATURED[0] ? coverOf(FEATURED[0]) : null;

  return (
    <div className="pb-24 pt-28 sm:pt-36">
      <div className="mx-auto max-w-[100rem] px-6 sm:px-10">
        <h1 className="max-w-[20ch] title">
          Bay Area creative director and photographer.
        </h1>

        {/* No `stagger` here. The four sections are stacked down a long
            column and cross the fold minutes apart in reading time, so they
            already arrive one at a time — a stepped delay would only add lag
            to something that is never seen simultaneously. */}
        <div className="mt-16 grid gap-16 lg:mt-24 lg:grid-cols-[1fr_0.8fr] lg:gap-24">
          <div className="max-w-prose">
            <Reveal variant="calm">
              <section>
                <h2 className="label text-muted-foreground">Biography</h2>
                <p className="mt-6 text-base leading-relaxed">
                  Bay Area based creative director and photographer,
                  specializing in editorial, commercial, and artist imagery. My
                  work blends creativity with a keen eye for detail, focusing on
                  everything from studio portraits to location shoots.
                  Photography allows me to explore the world through a unique
                  lens and I&rsquo;m dedicated to bringing out the beauty in
                  every subject I work with. Whether it&rsquo;s a personal
                  project or a collaboration, I strive to create images that
                  resonate and leave a lasting impression.
                </p>
              </section>
            </Reveal>

            <Reveal variant="calm">
              <section className="mt-16">
                <h2 className="label text-muted-foreground">Vision</h2>
                <p className="mt-6 text-base leading-relaxed">
                  My vision is to create captivating visual stories that go
                  beyond the surface. As one person behind the lens, I am
                  dedicated to capturing the unique essence of each subject with
                  authenticity, creativity, and a commitment to integrity,
                  crafting images that resonate and inspire.
                </p>
              </section>
            </Reveal>

            <Reveal variant="calm">
              <section className="mt-16">
                <h2 className="label text-muted-foreground">
                  Selected clients &amp; press
                </h2>
                <ul className="mt-6 flex flex-col divide-y divide-border border-y border-border">
                  {PRESS.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/work/${p.slug}`}
                        className="group flex items-baseline justify-between gap-6 py-4 transition-colors duration-200"
                      >
                        <span className="font-display text-xl uppercase tracking-[0.04em]">
                          {p.name}
                        </span>
                        <span
                          aria-hidden
                          className="label text-muted-foreground transition-transform duration-200 ease-[var(--ease-out-strong)] hoverable:group-hover:translate-x-1 motion-reduce:transition-none"
                        >
                          View &rarr;
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>

            <Reveal variant="calm">
              <section className="mt-16">
                <h2 className="label text-muted-foreground">
                  How a commission runs
                </h2>
                <ol className="mt-6 flex flex-col gap-6">
                  {[
                    {
                      step: "Brief",
                      body: "References, usage, deliverables, and dates. A deck is welcome but not required.",
                    },
                    {
                      step: "Treatment",
                      body: "A lighting and location approach, a shot list, and a quote covering crew and licensing.",
                    },
                    {
                      step: "Shoot",
                      body: "Studio or location, Bay Area or travelling. Art direction on request.",
                    },
                    {
                      step: "Delivery",
                      body: "Selects for approval, then final retouched files in the crops and colour spaces you need.",
                    },
                  ].map((phase, i) => (
                    <li key={phase.step} className="flex gap-6">
                      <span className="label shrink-0 pt-1 text-muted-foreground tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="text-sm font-medium">{phase.step}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {phase.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </Reveal>
          </div>

          {portrait ? (
            <div className="lg:sticky lg:top-28 lg:self-start">
              <div
                className="relative overflow-hidden"
                style={{
                  backgroundColor: portrait.color,
                  aspectRatio: `${portrait.width} / ${portrait.height}`,
                }}
              >
                <Image
                  src={portrait.src}
                  alt={portrait.alt || "Frame from a recent commission"}
                  width={portrait.width}
                  height={portrait.height}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="label mt-4 text-muted-foreground">
                {FEATURED[0]?.name} &middot; recent
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
