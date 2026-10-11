"use client";

import * as React from "react";
import Link from "next/link";
import { DialRoot, useDialKit } from "dialkit";
import { CalEmbed } from "@/components/cal-embed";
import { DialCopyAll } from "@/components/dial-copy-all";
import { useDialKitStyles } from "@/lib/dialkit-styles";

export type Bookable = {
  slug: string;
  name: string;
  blurb: string;
  rate: string;
  length: string;
  /** Its Cal.com event. */
  cal: string;
};

/* The sessions down the left, the chosen one's calendar beside them:
   Cal.com's booking page, in the site's frame. The
   choice is kept in the address (`?session=`), so a link can open on one. */
export function BookPicker({ sessions, start }: { sessions: Bookable[]; start?: string }) {
  const [on, setOn] = React.useState(() => Math.max(0, sessions.findIndex((s) => s.slug === start)));
  const pick = (i: number) => {
    setOn(i);
    history.replaceState(null, "", `?session=${sessions[i].slug}`);
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
  return (
    <section
      style={dials}
      /* One window, no vertical scroll: the footer's single line and
         the page held to the screen, as the portfolio is
         (`[data-quiet-footer]`, globals.css). */
      data-quiet-footer
      className="book-page mx-auto grid w-full max-w-[110rem] gap-8 px-6 pb-16 pt-28 sm:px-10 lg:h-full lg:min-h-0 lg:items-center lg:pb-6 lg:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,var(--card-w,2.2fr))] lg:gap-[clamp(2rem,4vw,5rem)]"
    >
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
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-4 text-left"
              >
                <span
                  className={`font-display text-[clamp(1.5rem,2.4vw,2.25rem)] uppercase leading-none transition-[color,translate] duration-300 ease-[var(--ease-out-strong)] ${i === on ? "translate-x-2 text-foreground" : "text-muted-foreground group-hover:translate-x-2 group-hover:text-foreground"}`}
                >
                  {s.name}
                </span>
                <span className="label text-muted-foreground">
                  {/* Julian: no price when the column is squeezed. */}
                  {s.length}<span className="@max-md:hidden"> &middot; {s.rate}</span>
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
            </li>
          ))}
        </ul>
        <p className="label text-muted-foreground">
          A wedding, or something else?{" "}
          <Link prefetch={false} href="/#contact" className="text-foreground underline decoration-border underline-offset-4 hoverable:hover:decoration-current">
            Inquire
          </Link>
        </p>
      </div>
      {/* As tall as the calendar is, and no taller, in what the window
          leaves it: only a short one makes it scroll. */}
      <div className="min-h-[75svh] overflow-hidden lg:min-h-0 rounded-[var(--card-r,12px)] border-[0.5px] border-border lg:h-full lg:max-h-[var(--card-h,47rem)]">
        {/* A fresh picker per session: the last one's time may not be open in this one. */}
        <CalEmbed key={current.cal} path={current.cal} title={`Pick a time for ${current.name}`} className="booking-embed block h-full w-full border-0" />
      </div>
      <DialRoot position="top-right" defaultOpen={false} />
      <DialCopyAll />
    </section>
  );
}
