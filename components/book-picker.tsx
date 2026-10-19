"use client";

import * as React from "react";
import Link from "next/link";
import { DialRoot, useDialKit } from "dialkit";
import { CalEmbed } from "@/components/cal-embed";
import { DialCopyAll } from "@/components/dial-copy-all";
import { InquireWall } from "@/components/inquire-wall";
import type { WallTile } from "@/lib/wall-tile";
import { useDialKitStyles } from "@/lib/dialkit-styles";

export type Bookable = {
  slug: string;
  name: string;
  blurb: string;
  rate: string;
  length: string;
  /** Its Cal.com event. */
  cal: string;
  /** The photographs behind it while it is the one picked. */
  wall: WallTile[];
};

/* The sessions down the left, the chosen one's calendar beside them:
   Cal.com's booking page, in the site's frame. The
   choice is kept in the address (`?session=`), so a link can open on one. */
export function BookPicker({ sessions, start }: { sessions: Bookable[]; start?: string }) {
  const [on, setOn] = React.useState(() => Math.max(0, sessions.findIndex((s) => s.slug === start)));
  /* Stacked (a phone, an upright iPad) the card opens under the session
     picked, not under the whole list, and the page glides down to it
     (Julian, 2026-10-15). Side by side from lg it stays beside the list. */
  const [stacked, setStacked] = React.useState(false);
  React.useEffect(() => {
    const mq = matchMedia("(max-width: 63.99rem)");
    const set = () => setStacked(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  const under = React.useRef<HTMLDivElement>(null);
  const glide = React.useRef(false);
  React.useEffect(() => {
    if (!glide.current) return;
    glide.current = false;
    // After the old card has gone and the new one is laid out.
    requestAnimationFrame(() => under.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  }, [on]);
  const pick = (i: number) => {
    glide.current = stacked && i !== on;
    setOn(i);
    // The rest of the address kept (`?dense`, `?cal`): the picker reads it.
    const q = new URLSearchParams(location.search);
    q.set("session", sessions[i].slug);
    history.replaceState(null, "", `?${q}`);
  };
  const current = sessions[on];
  /* Julian: dials for the booking card and the time picker in it. They
     reach both as variables on this section, whose classes keep the same
     values as fallbacks. Panels on the dev server only, as the hero's. */
  useDialKitStyles();
  const card = useDialKit(
    "Booking card",
    { width: [2.2, 1, 4, 0.05], height: [47, 30, 80, 0.5], radius: [12, 0, 32, 1] },
    { id: "book-card" },
  );
  const tp = useDialKit(
    "Time picker",
    { top: [2.5, 1, 10, 0.25], day: [2.25, 1, 5, 0.05], dayGap: [0.15, -0.6, 1, 0.05], time: [9, 4, 14, 0.25], gap: [2, 0, 5, 0.25], slot: [0.75, 0.25, 1.5, 0.05], radius: [6, 0, 24, 1], tint: [55, 0, 100, 1] },
    { id: "book-time" },
  );
  const dials = {
    "--card-w": `${card.width}fr`,
    "--card-h": `${card.height}rem`,
    "--card-r": `${card.radius}px`,
    "--tp-top": `${tp.top}rem`,
    "--tp-day": `${tp.day}rem`,
    "--tp-day-gap": `${tp.dayGap}em`,
    "--tp-time": `${tp.time}rem`,
    "--tp-gap": `${tp.gap}rem`,
    "--tp-slot": `${tp.slot}rem`,
    "--tp-r": `${tp.radius}px`,
    "--tp-tint": `${tp.tint}%`,
  } as React.CSSProperties;
  const cardOf = () => (
    <div className="min-h-[75svh] overflow-hidden lg:min-h-0 rounded-[var(--card-r,12px)] border-[0.5px] border-border lg:h-full lg:max-h-[var(--card-h,47rem)] max-sm:[container:card/inline-size] max-sm:-mx-[calc(1.5rem_-_3px)]">
      {/* A fresh picker per session: the last one's time may not be open in this one. */}
      <CalEmbed key={current.cal} path={current.cal} title={`Pick a time for ${current.name}`} className="booking-embed block h-full w-full border-0" />
    </div>
  );
  return (
    <section
      style={dials}
      /* One window, no vertical scroll: the footer's single line and
         the page held to the screen, as the portfolio is
         (`[data-quiet-footer]`, globals.css). */
      data-quiet-footer
      className="book-page relative isolate mx-auto grid w-full max-w-[110rem] gap-8 px-6 pb-16 pt-28 sm:px-10 lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)] lg:items-center lg:pb-6 lg:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,var(--card-w,2.2fr))] lg:gap-[clamp(2rem,4vw,5rem)]"
    >
      {/* The picked session's wall behind the page, as its own booking
          page has it (`/book/[slug]`); it changes with the pick. */}
      <div inert className="enquiry-backdrop questions-wall fixed inset-0 -z-10 overflow-hidden bg-background max-sm:hidden">
        {current.wall.length ? <InquireWall key={current.slug} items={current.wall} /> : null}
      </div>
      <div className="@container flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="label text-muted-foreground">Bay Area, studio or location</p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,5rem)] uppercase leading-[0.92]">Book a session</h1>
          <p className="max-w-[36rem] text-sm normal-case leading-relaxed text-muted-foreground">
            Pick a session, then a time that suits you. You&rsquo;ll get a confirmation by email, and I&rsquo;ll be in touch about the details before the day.
          </p>
        </div>
        <ul className="border-t border-border">
          {sessions.map((s, i) => (
            /* They rise one after another as the page arrives
               (`.strip-cell`'s rise, `globals.css`). */
            <li
              key={s.slug}
              style={{ animation: "jg-fade-up 640ms var(--ease-out-strong) both", animationDelay: `${200 + i * 80}ms` }}
              className="border-b border-border motion-reduce:[animation:none]"
            >
              <button
                type="button"
                aria-pressed={i === on}
                onClick={() => pick(i)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-4 text-left lg:py-3"
              >
                <span
                  className={`font-display text-[clamp(1.5rem,2.4vw,2.25rem)] uppercase leading-none transition-[color,translate] duration-300 ease-[var(--ease-out-strong)] ${i === on ? "translate-x-2 text-foreground" : "text-muted-foreground group-hover:translate-x-2 group-hover:text-foreground"}`}
                >
                  {s.name}
                </span>
                {/* The length over the price, both at any width (Julian,
                    2026-10-18), on the name's line so the column fits
                    the window. */}
                <span className="label flex flex-col items-end gap-0.5 text-right text-muted-foreground">
                  <span>{s.length}</span>
                  <span>{s.rate}</span>
                </span>
                {/* The chosen one's words unfold under it, the rest fold
                    away: the row's height eases, not jumps. */}
                <span
                  className={`col-span-2 grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease-out-strong)] ${i === on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <span className="overflow-hidden">
                    <span className="block pt-2 text-sm normal-case leading-relaxed text-muted-foreground">{s.blurb}</span>
                  </span>
                </span>
              </button>
              {stacked && i === on ? (
                <div ref={under} className="scroll-mt-24 pb-5">{cardOf()}</div>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="label text-muted-foreground">
          Something else?{" "}
          <Link prefetch={false} href="/#contact" className="text-foreground underline decoration-border underline-offset-4 hoverable:hover:decoration-current">
            Inquire
          </Link>
        </p>
      </div>
      {/* As tall as the calendar is, and no taller, in what the window
          leaves it: only a short one makes it scroll. */}
      {stacked ? null : cardOf()}
      <DialRoot position="top-right" defaultOpen={false} />
      <DialCopyAll />
    </section>
  );
}
