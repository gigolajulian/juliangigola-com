import Image from "next/image";
import Link from "next/link";
import { RisingTitle } from "@/components/strip-page";
import { LiquidPair } from "@/components/liquid-pair";
import type { Block, Tile } from "@/lib/locations";
import type { Frame } from "@/lib/work-types";
import { ldJson } from "@/lib/seo";

/* ── the booking pages' screens ───────────────────────────────────
 * Julian (2026-10-02): booking pages for each service in San Jose, and
 * "no vertical pages". So a booking page is a deck like the homepage, a
 * screen at a time, sideways, from the same parts: the cover (what it is,
 * what it costs, a photograph), the work, the details, the questions,
 * and the form. Each screen is a cell of the strip (`strip.tsx`), with
 * its word on the rail and its own address, so "Book" is `#book`.
 *
 * The words come from `lib/locations.ts`. Every one of them is in the
 * prerendered page, the answers to the questions included, because that
 * text is what a search engine and an AI answer read.
 * ─────────────────────────────────────────────────────────────── */

const two = (n: number) => String(n).padStart(2, "0");

/** The cover: who and what on the left, a photograph on the right. The
    sessions screen's first two columns, with the page's own `h1`. */
export function LocalCover({
  crumb,
  kicker,
  title,
  lead,
  facts,
  actions,
  frame,
  alt,
  label,
}: {
  crumb?: { href: string; label: string };
  kicker: string;
  title: string;
  lead: string;
  facts: string[];
  actions: { href: string; label: string; quiet?: boolean }[];
  frame?: Frame;
  alt: string;
  label: string;
}) {
  return (
    <section
      data-tick
      data-label={label}
      data-hash="top"
      className="relative grid w-full shrink-0 grid-cols-1 items-center gap-10 px-6 pb-12 pt-24 sm:h-full sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-[clamp(2rem,5vw,6rem)] sm:px-10 sm:pb-8 sm:[container-type:size] short:pt-20"
    >
      <div className="flex min-w-0 flex-col gap-6 self-center sm:max-w-[44rem] short:gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          {crumb ? (
            <Link
              href={crumb.href}
              className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
            >
              &larr; {crumb.label}
            </Link>
          ) : null}
          <span className="label text-muted-foreground">{kicker}</span>
        </div>
        <RisingTitle as="h1" text={title} className="sm:max-lg:text-5xl" />
        <p className="title-rest max-w-[52ch] text-left text-sm leading-relaxed text-muted-foreground">
          {lead}
        </p>
        <p className="title-rest label text-foreground">{facts.join(" · ")}</p>
        <LiquidPair className="title-rest flex flex-wrap items-center gap-3">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`label ${a.quiet ? "action-quiet" : "action"} px-6 py-4 press active:scale-[0.97] short:py-2.5`}
            >
              {a.label}
            </Link>
          ))}
        </LiquidPair>
      </div>

      {frame ? (
        <div className="title-rest relative aspect-[3/4] w-full overflow-hidden rounded-[4px] bg-card sm:h-[min(52rem,calc(100cqh-9rem))] sm:w-auto">
          <Image
            src={frame.src}
            alt={alt}
            fill
            priority
            sizes="(min-width: 640px) 40vw, 100vw"
            className="object-cover object-[50%_25%]"
            style={{ backgroundColor: frame.color }}
          />
        </div>
      ) : null}
    </section>
  );
}

/** The work: six photographs, each a way into its gallery or project. */
export function LocalWork({
  tiles,
  gallery,
}: {
  tiles: Tile[];
  gallery: { href: string; label: string };
}) {
  if (!tiles.length) return null;
  return (
    <section
      data-tick
      data-label="Work"
      data-hash="work"
      className="relative flex w-full shrink-0 flex-col gap-6 border-l border-border px-6 pb-12 pt-24 sm:h-full sm:px-10 sm:pb-8 short:gap-4 short:pt-20"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <RisingTitle text="The work" className="sm:max-lg:text-5xl" />
        <Link
          href={gallery.href}
          className="label inline-flex items-center gap-2 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
        >
          {gallery.label} <span aria-hidden>&rarr;</span>
        </Link>
      </div>
      <ul className="title-rest grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 sm:grid-rows-2">
        {tiles.slice(0, 6).map((t) => (
          <li key={t.frame.src} className="relative min-h-0 max-sm:aspect-[3/4]">
            <Link
              href={t.href}
              data-ring="Open"
              className="group relative block h-full overflow-hidden rounded-[4px] bg-card"
            >
              <Image
                src={t.frame.src}
                alt={t.frame.alt || `${t.caption}, photographed by Julian Gigola`}
                fill
                loading="lazy"
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover object-[50%_25%] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hoverable:group-hover:scale-[1.03]"
                style={{ backgroundColor: t.frame.color }}
              />
              <span className="label absolute inset-x-0 bottom-0 bg-background/80 px-3 py-2 text-foreground backdrop-blur-sm">
                {t.caption}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The details: what is included, where, when, and the way on to the
    other pages in the city. Columns, ruled like the sessions list. */
export function LocalDetails({
  blocks,
  more,
}: {
  blocks: Block[];
  more?: { heading: string; links: { href: string; label: string }[] };
}) {
  const all = more ? blocks.length + 1 : blocks.length;
  return (
    <section
      data-tick
      data-label="Details"
      data-hash="details"
      className="relative flex w-full shrink-0 flex-col gap-8 border-l border-border px-6 pb-12 pt-24 sm:h-full sm:px-10 sm:pb-8 short:gap-5 short:pt-20"
    >
      <RisingTitle text="The details" className="sm:max-lg:text-5xl" />
      <div
        data-scroll
        className={`title-rest grid min-h-0 grid-cols-1 gap-x-10 gap-y-10 sm:overflow-y-auto sm:overscroll-contain ${all > 2 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}
      >
        {blocks.map((b, i) => (
          <div key={b.heading} className="flex min-w-0 flex-col gap-4">
            <h2 className="label flex items-baseline gap-3 text-muted-foreground">
              <span className="text-foreground">{two(i + 1)}</span>
              {b.heading}
            </h2>
            {b.items ? (
              <ul className="border-t border-border">
                {b.items.map((item) => (
                  <li
                    key={item}
                    className="border-b border-border py-3 text-sm leading-relaxed"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            {b.body ? (
              <p className="border-t border-border pt-3 text-left text-sm leading-relaxed text-muted-foreground">
                {b.body}
              </p>
            ) : null}
          </div>
        ))}
        {more ? (
          <nav aria-label={more.heading} className="flex min-w-0 flex-col gap-4">
            <h2 className="label flex items-baseline gap-3 text-muted-foreground">
              <span className="text-foreground">{two(blocks.length + 1)}</span>
              {more.heading}
            </h2>
            <ul className="border-t border-border">
              {more.links.map((l) => (
                <li key={l.href} className="border-b border-border">
                  <Link
                    href={l.href}
                    className="group flex items-baseline justify-between gap-4 py-3 text-sm"
                  >
                    {l.label}
                    <span
                      aria-hidden
                      className="transition-transform duration-300 hoverable:group-hover:translate-x-1"
                    >
                      &rarr;
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </section>
  );
}

/** The city's services as a list of doors, for the city's own page: the
    sessions list's rows, each leading to its booking page. */
export function LocalServices({
  city,
  items,
}: {
  city: string;
  items: { href: string; name: string; rate: string; lead: string }[];
}) {
  return (
    <section
      data-tick
      data-label="Services"
      data-hash="services"
      className="relative grid w-full shrink-0 grid-cols-1 gap-10 border-l border-border px-6 pb-12 pt-24 sm:h-full sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] sm:items-center sm:gap-x-[clamp(2rem,4vw,5rem)] sm:px-10 sm:pb-8 short:pt-20"
    >
      <div className="flex flex-col gap-5">
        <span className="label text-muted-foreground">
          <span className="mr-2 text-foreground">{two(items.length)}</span>
          Ways to book in {city}
        </span>
        <RisingTitle text="Services" className="sm:max-lg:text-5xl" />
      </div>
      <ul data-scroll className="title-rest min-h-0 border-t border-border sm:max-h-full sm:overflow-y-auto sm:overscroll-contain">
        {items.map((s, i) => (
          <li key={s.href} className="border-b border-border">
            <Link
              href={s.href}
              className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2 py-4 short:py-2.5"
            >
              <span className="font-display text-[clamp(1.5rem,2.4vw,2.5rem)] leading-none tabular-nums text-muted-foreground/40 transition-colors duration-300 hoverable:group-hover:text-foreground">
                {two(i + 1)}
              </span>
              <span className="font-display text-[clamp(1.5rem,2.4vw,2.5rem)] leading-none">
                {s.name}
              </span>
              <span className="label flex items-baseline gap-3 text-muted-foreground">
                <span className="max-sm:hidden">{s.rate}</span>
                <span
                  aria-hidden
                  className="text-foreground transition-transform duration-300 hoverable:group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </span>
              {/* One line a row from `sm`, where the six have to share a
                  screen; the whole of it is on the page it leads to. */}
              <span className="col-start-2 col-end-4 max-w-[60ch] text-left text-sm leading-relaxed text-muted-foreground sm:line-clamp-1 short:hidden">
                {s.lead}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A JSON-LD graph, inlined (`ldJson` escapes it). */
export function LdJson({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: ldJson(data) }}
    />
  );
}
