"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RisingTitle } from "@/components/strip-page";
import type { Frame } from "@/lib/work-types";

/* ── sessions ─────────────────────────────────────────────────────
 * A screen of the homepage, from Julian's design (Sessions Preview v2,
 * 2026-09-29), and the only place sessions live since /sessions went
 * (it redirects here). Three columns (Julian): the title and the words,
 * a photograph, and the sessions, one open at a time. Pointing at a
 * session opens it and turns the photograph to its sample; the open one
 * stays open when the pointer leaves.
 */

export type SessionItem = {
  slug: string;
  name: string;
  rate: string;
  turnaround: string;
  blurb: string;
  includes: string[];
  cover: Frame | null;
  /** The session's booking page (`lib/booking.ts`), where it has one. */
  page?: string;
  /** That page's heading, the words its link carries (search reads link
      text as what the page is about). */
  pageTitle?: string;
};

function where(title: string) {
  const k = title.lastIndexOf(" in ");
  const arrow = <span aria-hidden>&rarr;</span>;
  if (k < 0) return <>{title}&nbsp;{arrow}</>;
  return (
    <>
      {title.slice(0, k)}{" "}
      <span className="whitespace-nowrap">{title.slice(k + 1)}&nbsp;{arrow}</span>
    </>
  );
}

export function SessionsScreen({ sessions }: { sessions: SessionItem[] }) {
  const [open, setOpen] = useState(0);
  /* Whether a mouse or the keyboard is in the list: the open row is
     inked only then (`.session-dev`, `globals.css`). A finger opens a row
     by going to its page, so it never sees it. */
  const [hot, setHot] = useState(false);
  /* The edge the ink comes in from, and the row it is leaving: going
     down the list it is handed down, going up, handed up. */
  const [from, setFrom] = useState<"top" | "bottom">("top");
  const [gone, setGone] = useState<number | null>(null);
  const go = (i: number) => {
    if (i === open) return;
    setFrom(i > open ? "top" : "bottom");
    setGone(open);
    setOpen(i);
  };
  /* Which half of a row the pointer crossed. */
  const half = (e: React.PointerEvent) => {
    const li = (e.target as HTMLElement).closest("li");
    if (!li) return null;
    const r = li.getBoundingClientRect();
    return { li, top: e.clientY < r.top + r.height / 2 };
  };
  const current = sessions[open];

  return (
    <section
      data-tick
      data-label="Sessions"
      data-hash="sessions"
      className="screen-measure relative grid w-full shrink-0 grid-cols-1 items-center gap-10 px-6 py-12 sm:h-full sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-x-[clamp(2rem,3.5vw,4rem)] sm:px-10 sm:py-8 short:pb-4 short:pt-20 sm:[container-type:size] xl:grid-cols-[auto_auto_minmax(0,1fr)]"
    >
      {/* Julian (2026-09-29, red boxes): with three columns the photograph
          sits further right (its margin, from about 1600px wide) and larger
          (to 56rem tall); the list keeps the plain gap after it, half the
          space it had. Below 1600 a laptop keeps its spacing, or the names
          run into the rates. On a
          short laptop (1280x800) the content starts below the header
          rather than under it, and the names are set a touch smaller so the
          open session fits. */}
      <div className="flex w-fit max-w-full flex-col gap-5 self-center">
        {/* Julian (2026-09-29): says what the count is, not the title again. */}
        <span className="label text-muted-foreground">
          <span className="mr-2 text-foreground">
            {String(sessions.length).padStart(2, "0")}
          </span>
          Ways to book
        </span>
        {/* Smaller where its column is narrow (a tablet upright). */}
        <RisingTitle text="Sessions" className="sm:max-lg:text-4xl" />
        {/* Julian: three lines, whatever the size (44ch is the least), where
            the three columns are. */}
        <p className="title-rest max-w-full text-left xl:w-[46ch] text-sm leading-relaxed text-muted-foreground">
          Studio and location sessions across the San Francisco Bay Area.
          Everything here is booked directly, with no packages to decode.
        </p>
      </div>

      {/* As tall as the screen allows, to 48rem (Julian: smaller, then
          larger). On a laptop no wider than a quarter of the screen, so the
          words keep three lines and the names one. Under 1280 there is no
          room for three columns and it is left out: the words and the
          list. */}
      <div className="sessions-photo title-rest relative aspect-[3/4] w-full overflow-hidden rounded-[4px] bg-card sm:h-[min(48rem,calc(100cqh-8rem),max(34.5vw,calc(100vw-75rem)))] sm:w-auto sm:justify-self-center sm:max-xl:hidden xl:ml-[max(0rem,min(4.25rem,16.5vw-16.5rem))] xl:h-[min(56rem,calc(100cqh-8rem),max(34.5vw,calc(100vw-75rem)))]">
        {sessions.map((s, i) =>
          s.cover ? (
            <Image
              key={s.slug}
              src={s.cover.src}
              alt={s.cover.alt || s.name}
              fill
              sizes="(min-width: 640px) 30vw, 100vw"
              loading="lazy"
              className={`object-cover object-[50%_25%] transition-[opacity,transform] duration-[700ms,1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${i === open ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"}`}
              style={{ backgroundColor: s.cover.color }}
            />
          ) : null,
        )}
        {/* The photograph is a way in too, to the open session's page. */}
        {current.page ? (
          <Link
            href={current.page}
            data-ring="Open"
            aria-label={`More on ${current.name}`}
            className="absolute inset-0 z-10"
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-3 bg-background/80 p-4 backdrop-blur-sm">
          <div className="flex items-baseline gap-3">
            <span className="label text-muted-foreground">
              {String(open + 1).padStart(2, "0")}
            </span>
            <span className="font-display text-xl leading-none">
              {current.name}
            </span>
          </div>
          <span className="label text-muted-foreground">{current.rate}</span>
        </div>
      </div>

      <div className="title-rest flex min-w-0 flex-col">
        <ul
          className="session-list border-t border-border"
          data-from={from}
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            const h = half(e);
            if (h) {
              setFrom(h.top ? "top" : "bottom");
              setGone(null);
              setOpen([...e.currentTarget.children].indexOf(h.li));
            }
            setHot(true);
          }}
          onPointerLeave={(e) => {
            const h = half(e);
            if (h) setFrom(h.top ? "bottom" : "top");
            setGone(open);
            setHot(false);
          }}
          onFocus={(e) => e.target.matches(":focus-visible") && setHot(true)}
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setGone(open);
            setHot(false);
          }}
        >
          {sessions.map((s, i) => {
            const on = i === open;
            const head = (
              <>
                <span
                  className={`font-display text-[clamp(1.5rem,2.4vw,2.5rem)] leading-none short:text-[clamp(1.25rem,2vw,2rem)] tabular-nums transition-colors duration-300 ${on ? "text-foreground" : "text-muted-foreground/75"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-[clamp(1.5rem,2.4vw,2.5rem)] leading-none short:text-[clamp(1.25rem,2vw,2rem)]">
                  {s.name}
                </span>
                <span className="label text-muted-foreground max-sm:hidden">
                  {s.rate}
                </span>
              </>
            );
            return (
              /* On a move, not on entering: a row sliding under a still
                 pointer as another closes must not open itself and set
                 the next one closing. */
              <li
                key={s.slug}
                onPointerMove={() => go(i)}
                /* Julian (2026-10-02): anywhere in the row goes to the
                   booking page, bar its own links: a click on the row is a
                   click on its name, the link a keyboard and a reader get,
                   so it goes the way every link on the site goes. */
                onClick={(e) => {
                  if (s.page && !(e.target as HTMLElement).closest("a, button"))
                    e.currentTarget.querySelector("a")?.click();
                }}
                data-dev={on && hot ? "" : undefined}
                data-gone={!(on && hot) && gone === i ? "" : undefined}
                className={`relative flex flex-col border-b border-border py-1.5 ${s.page ? "cursor-pointer" : ""}`}
              >
                {/* Julian: the row under the pointer inverted, the ink
                    wiping in from the edge the pointer came from. */}
                <span aria-hidden className="session-dev" />
                {/* Julian (2026-10-02): a session with a booking page goes
                    there on a click; pointing still opens it here. */}
                {s.page ? (
                  <Link
                    href={s.page}
                    onFocus={() => go(i)}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-4 py-2 text-left short:py-1.5"
                  >
                    {head}
                  </Link>
                ) : (
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => setOpen(i)}
                  onFocus={() => go(i)}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-4 py-2 text-left short:py-1.5"
                >
                  {head}
                </button>
                )}
                {/* Julian: smoother. The open one slides open and the last
                    one slides shut, rather than jumping. */}
                <div
                  inert={!on}
                  className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="min-h-0 overflow-hidden">
                  <div className="session-more flex flex-col gap-4 pl-[clamp(0rem,4vw,4rem)] pt-5 short:gap-2.5 short:pt-3">
                    {/* Julian (2026-10-02): friendlier. The words in their
                        own case, not the page's capitals, and more air
                        between them; what is a label stays one. */}
                    <p className="max-w-[32.5rem] text-left text-sm normal-case leading-[1.7] text-muted-foreground text-pretty short:leading-relaxed">
                      {s.blurb}
                    </p>
                    {/* What the /sessions page used to say about each. */}
                    <p className="max-w-[32.5rem] text-left text-[0.8125rem] normal-case leading-relaxed text-muted-foreground text-balance">
                      {/* Each item whole on its line, and the dot held to the
                          item before it, so no line starts with one. */}
                      {s.includes.map((x, k) => (
                        <span key={x}>
                          <span className="whitespace-nowrap">{x}</span>
                          {k < s.includes.length - 1 ? " · " : null}
                        </span>
                      ))}
                      {/* When it is ready, what they ask next: the end of
                          this line, or under a finger a line of its own
                          with the rate. */}
                      <span className="max-sm:hidden">{" · "}</span>
                      {/* The rate first under a finger, where the row has no
                          room for it: the price is what a private client
                          came for. */}
                      <span className="label whitespace-nowrap text-foreground max-sm:mt-4 max-sm:block">
                        <span className="sm:hidden">{s.rate} · </span>
                        <span className="font-medium">Ready in {s.turnaround}</span>
                      </span>
                    </p>
                    {/* Julian (2026-10-02): Book a session at the card's
                        bottom right, the page's link on the left; under it
                        where the column is too narrow for both, still at
                        the right. The arrows held to their last word. */}
                    <div className="flex flex-wrap items-baseline gap-x-8 pointer-coarse:gap-y-4">
                      {/* The whole of it, where it has a page: the work,
                          where, and the questions asked before booking. */}
                      {s.page ? (
                        <Link
                          href={s.page}
                          className="label block py-2 leading-[1.7] text-muted-foreground short:py-1"
                        >
                          {/* Where it is ("in San Jose & San Francisco") kept
                              whole, so a line breaks before it and never
                              inside a city's name. */}
                          {where(s.pageTitle ?? `More on ${s.name}`)}
                        </Link>
                      ) : null}
                      <Link
                        href={
                          s.page
                            ? `${s.page}#book`
                            : `/?type=session&session=${encodeURIComponent(s.name)}#contact`
                        }
                        className="label ml-auto block whitespace-nowrap py-2 font-bold short:py-1"
                      >
                        Book a session&nbsp;<span aria-hidden>&rarr;</span>
                      </Link>
                    </div>
                  </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* On a short laptop (1280x800) the heading and its button share
            the line, or the button wraps under it and under the rail. */}
        <div className="flex flex-wrap items-center justify-between gap-6 pt-6 short:gap-4 short:pt-5">
          <div className="flex flex-col gap-2.5">
            <span className="font-display text-[2rem] leading-none short:text-[1.625rem]">
              Book a session
            </span>
            <a
              href="mailto:hello@juliangigola.com"
              className="label text-muted-foreground"
            >
              hello@juliangigola.com
            </a>
          </div>
          <Link
            href="/?type=session#contact"
            className="label action px-7 py-4 press active:scale-[0.97] short:px-5 short:py-2.5"
          >
            {/* The private client's verb, not the art director's (Julian,
                2026-10-01). */}
            Book a session
          </Link>
        </div>
      </div>
    </section>
  );
}
