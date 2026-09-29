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
};

export function SessionsScreen({ sessions }: { sessions: SessionItem[] }) {
  const [open, setOpen] = useState(0);
  const current = sessions[open];

  return (
    <section
      data-tick
      data-label="Sessions"
      data-hash="sessions"
      className="relative grid w-full shrink-0 grid-cols-1 items-center gap-10 px-6 py-12 sm:h-full sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-x-[clamp(2rem,3.5vw,4rem)] sm:px-10 sm:py-8 sm:[container-type:size] xl:grid-cols-[auto_auto_minmax(0,1fr)]"
    >
      <div className="flex w-fit max-w-full flex-col gap-5 self-center">
        <span className="label text-muted-foreground">
          Sessions
          <span className="ml-2 text-foreground">
            {String(sessions.length).padStart(2, "0")}
          </span>
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
      <div className="title-rest relative aspect-[3/4] w-full overflow-hidden rounded-[4px] bg-card sm:h-[min(48rem,calc(100cqh-8rem),max(34.5vw,calc(100vw-75rem)))] sm:w-auto sm:justify-self-center sm:max-xl:hidden">
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
        <ul className="border-t border-border">
          {sessions.map((s, i) => {
            const on = i === open;
            return (
              /* On a move, not on entering: a row sliding under a still
                 pointer as another closes must not open itself and set
                 the next one closing. */
              <li
                key={s.slug}
                onPointerMove={() => open !== i && setOpen(i)}
                className="flex flex-col border-b border-border py-2 short:py-1.5"
              >
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => setOpen(i)}
                  onFocus={() => setOpen(i)}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-baseline gap-4 py-2 text-left short:py-1.5"
                >
                  <span
                    className={`font-display text-[clamp(1.5rem,2.4vw,2.5rem)] leading-none tabular-nums transition-colors duration-300 ${on ? "text-foreground" : "text-muted-foreground/40"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-[clamp(1.5rem,2.4vw,2.5rem)] leading-none">
                    {s.name}
                  </span>
                  <span className="label text-muted-foreground max-sm:hidden">
                    {s.rate}
                  </span>
                  <span
                    aria-hidden
                    className={`text-lg transition-[opacity,transform] duration-300 ${on ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"}`}
                  >
                    &rarr;
                  </span>
                </button>
                {/* Julian: smoother. The open one slides open and the last
                    one slides shut, rather than jumping. */}
                <div
                  inert={!on}
                  className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="min-h-0 overflow-hidden">
                  <div className="flex max-w-[32.5rem] flex-col gap-3 pl-[clamp(0rem,4vw,4rem)] pt-4">
                    <p className="text-left text-sm leading-relaxed text-muted-foreground">
                      {s.blurb}
                    </p>
                    {/* What the /sessions page used to say about each. */}
                    <p className="label text-left text-muted-foreground">
                      {s.includes.join(" · ")} · Ready in {s.turnaround}
                    </p>
                    <Link
                      href={`/?type=session&session=${encodeURIComponent(s.name)}#contact`}
                      className="label flex gap-2.5 self-start py-2"
                    >
                      Inquire <span aria-hidden>&rarr;</span>
                    </Link>
                  </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-6 pt-8 short:pt-5">
          <div className="flex flex-col gap-2.5">
            <span className="font-display text-[2rem] leading-none">
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
            className="label action px-7 py-4 press active:scale-[0.97] short:py-2.5"
          >
            Inquire
          </Link>
        </div>
      </div>
    </section>
  );
}
