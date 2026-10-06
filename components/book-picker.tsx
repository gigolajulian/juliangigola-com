"use client";

import * as React from "react";
import Link from "next/link";

export type Bookable = {
  slug: string;
  name: string;
  blurb: string;
  rate: string;
  length: string;
  /** The Google Calendar appointment schedule's id. */
  calendar: string;
};

/* The sessions down the left, the chosen one's calendar beside them:
   Google's own booking page, in the site's frame. On the dark theme it is
   turned over to sit on the page (`.booking-embed`, globals.css). The
   choice is kept in the address (`?session=`), so a link can open on one. */
export function BookPicker({ sessions, start }: { sessions: Bookable[]; start?: string }) {
  const [on, setOn] = React.useState(() => Math.max(0, sessions.findIndex((s) => s.slug === start)));
  const pick = (i: number) => {
    setOn(i);
    history.replaceState(null, "", `?session=${sessions[i].slug}`);
  };
  const current = sessions[on];
  return (
    <section
      /* One window, no vertical scroll (Julian, 2026-10-04): the footer's
         single line and the page held to the screen, as the portfolio is
         (`[data-quiet-footer]`, globals.css). */
      data-quiet-footer
      className="book-page mx-auto grid w-full max-w-[110rem] gap-8 px-6 pb-16 pt-28 sm:px-10 lg:h-full lg:min-h-0 lg:items-center lg:pb-6 lg:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] lg:gap-[clamp(2rem,4vw,5rem)]"
    >
      <div className="flex min-w-0 flex-col gap-6">
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
                  {s.length} &middot; {s.rate}
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
      {/* As tall as Google's page is, and no taller (Julian, 2026-10-04:
          shorter, then a bit longer so it never scrolls inside itself), in
          what the window leaves it: only a short one makes it scroll. */}
      <div className="h-[75svh] overflow-hidden rounded-[12px] border border-border bg-card lg:h-full lg:max-h-[53rem]">
        <iframe
          key={current.calendar}
          src={`https://calendar.google.com/calendar/appointments/schedules/${current.calendar}?gv=true`}
          title={`Pick a time for ${current.name}`}
          className="booking-embed block h-full w-full border-0"
        />
      </div>
    </section>
  );
}
