"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Liquid } from "@/components/liquid";
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
  /* The edge of the row the pointer came in by, which the ink fills
     from, and the one it left by, which it drains to (Julian,
     2026-10-03): over the top it pours down, in from the side it runs
     across. Between rows it only slides. */
  const col = useRef<HTMLDivElement>(null);
  type Edge = "top" | "bottom" | "left" | "right";
  const [edge, setEdge] = useState<Edge>("top");
  const [pinch, setPinch] = useState(false);
  const flick = useRef(0);
  const nearest = (e: React.PointerEvent, li: Element | null): Edge => {
    if (!li) return edge;
    const r = li.getBoundingClientRect();
    const d = {
      top: e.clientY - r.top,
      bottom: r.bottom - e.clientY,
      left: e.clientX - r.left,
      right: r.right - e.clientX,
    };
    return (Object.keys(d) as Edge[]).reduce((m, k) => (d[k] < d[m] ? k : m));
  };
  const go = (i: number) => {
    if (i === open) return;
    setOpen(i);
  };
  /* Julian (2026-10-03): the ink in liquid, the filter bar's. One drop
     under the open row that runs to the next one as a liquid would, and
     drains to a line when the pointer leaves. Read off the row every
     frame the list is in use, because the rows open and shut under it. */
  const [drop, setDrop] = useState({ y: 0, h: 0 });
  useEffect(() => {
    if (!hot) return;
    let raf = 0;
    const read = () => {
      const li = col.current?.querySelector("ul")?.children[open] as HTMLElement | undefined;
      const c = col.current?.getBoundingClientRect();
      if (li && c) {
        const r = li.getBoundingClientRect();
        /* Whole pixels: a row opening moves by fractions every frame,
           and the liquid chased each one. */
        const y = Math.round(r.top - c.top);
        const h = Math.round(r.height);
        setDrop((d) => (d.y === y && d.h === h ? d : { y, h }));
      }
      raf = requestAnimationFrame(read);
    };
    read();
    return () => cancelAnimationFrame(raf);
  }, [hot, open]);
  const current = sessions[open];

  return (
    <section
      data-tick
      data-label="Sessions"
      data-hash="sessions"
      className="screen-measure relative grid w-full shrink-0 grid-cols-1 items-center gap-10 sessions-screen px-6 py-12 sm:h-full sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-x-[clamp(2rem,3.5vw,4rem)] sm:px-10 sm:pb-8 sm:pt-20 short:pb-4 sm:[container-type:size] xl:grid-cols-[auto_auto_minmax(0,1fr)]"
    >
      {/* Julian (2026-09-29, red boxes): with three columns the photograph
          sits further right (its margin, from about 1600px wide) and larger
          (to 56rem tall); the list keeps the plain gap after it, half the
          space it had. Below 1600 a laptop keeps its spacing, or the names
          run into the rates. On a
          short laptop (1280x800) the content starts below the header
          rather than under it, and the names are set a touch smaller so the
          open session fits. Critique (2026-10-03): below the header at
          every height, and centred only while it fits — at 1440x840 the
          open list ran up under the bar. */}
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
        <p className="title-rest max-w-full text-left xl:w-[46ch] text-sm normal-case leading-relaxed text-muted-foreground">
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

      <div ref={col} className="session-col title-rest relative flex min-w-0 flex-col">
        <ul
          className="session-list border-t border-border"
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            const li = (e.target as HTMLElement).closest("li");
            if (li) setOpen([...e.currentTarget.children].indexOf(li));
            /* Laid shut along that edge at once, then filled from it. */
            setEdge(nearest(e, li));
            setPinch(true);
            window.clearTimeout(flick.current);
            flick.current = window.setTimeout(() => setPinch(false), 60);
            setHot(true);
          }}
          onPointerLeave={(e) => {
            setEdge(nearest(e, e.currentTarget.children[open]));
            setHot(false);
          }}
          onFocus={(e) => e.target.matches(":focus-visible") && setHot(true)}
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
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
                // Julian (2026-10-03): the rows appear in order as Sessions
                // arrives, as About's steps do (`.session-step`, globals.css).
                style={{ "--i": i } as React.CSSProperties}
                onPointerMove={() => go(i)}
                /* Julian (2026-10-02): anywhere in the row goes to the
                   booking page, bar its own links: a click on the row is a
                   click on its name, the link a keyboard and a reader get,
                   so it goes the way every link on the site goes. */
                onClick={(e) => {
                  if (s.page && !(e.target as HTMLElement).closest("a, button"))
                    e.currentTarget.querySelector("a")?.click();
                }}
                className={`session-step relative flex flex-col border-b border-border py-1.5 ${s.page ? "cursor-pointer" : ""}`}
              >
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
        {/* The ink: white, laid over the list in `difference`, so each
            letter under it turns as the liquid reaches it, over a drop
            of the page's ground, the same shape, for it to turn against
            (`.session-col`, `globals.css`). */}
        {/* Mounted at rest, a line of no width, so the first time in
            starts from the pointer like every other. */}
        {(["session-ground"] as const).map((k) => (
              <div key={k} aria-hidden className={`${k} pointer-events-none absolute inset-y-0 -inset-x-5`}>
                <Liquid
                  blur={5}
                  contrast={18}
                  fill="var(--session-hover)"
                  className="h-full w-full"
                >
                  <Liquid.Item effect="move" move={{ springiness: 0.92, wobble: 0, stretch: 0.04, trail: 0 }}>
                    <div
                      className="absolute left-0 top-0 rounded-[4px]"
                      style={{
                        ...(hot && !pinch
                          ? { left: 0, width: "100%", height: drop.h, transform: `translateY(${drop.y}px)` }
                          : {
                              /* Shut, as a line along the edge. */
                              left: edge === "right" ? "100%" : 0,
                              width: edge === "left" || edge === "right" ? 0 : "100%",
                              height: edge === "top" || edge === "bottom" ? 0 : drop.h,
                              transform: `translateY(${edge === "bottom" ? drop.y + drop.h : drop.y}px)`,
                            }),
                        transition: pinch
                          ? "none"
                          : ["left", "width", "height", "transform"]
                              .map((k) => `${k} ${hot ? 340 : 240}ms var(--ease-out-strong)`)
                              .join(", "),
                      }}
                    />
                  </Liquid.Item>
                </Liquid>
              </div>
            ))}

        {/* On a short laptop (1280x800) the heading and its button share
            the line, or the button wraps under it and under the rail. */}
        <div className="flex flex-wrap items-center justify-between gap-6 pt-6 short:gap-4 short:pt-5">
          <div className="flex flex-col gap-2.5">
            {/* The button says Book a session; said beside it as well, the
                pair read as a stutter (critique, 2026-10-03). Julian's
                words in its place. */}
            <span className="font-display text-[2rem] leading-none short:text-[1.625rem]">
              Commissions open
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
            className="sessions-book label action px-7 py-4 press active:scale-[0.97] short:px-5 short:py-2.5"
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
