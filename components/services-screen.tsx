"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Liquid, useQuiet } from "@/components/liquid";
import { RisingTitle } from "@/components/strip-page";
import type { Frame } from "@/lib/work-types";
import { matches } from "@/lib/device";

/** One frame on the light table: a project's picture and where it opens. */
export type Shot = { src: string; color?: string; width: number; height: number; title: string; href: string };

export type ServiceRow = {
  slug: string;
  name: string;
  href: string;
  /** What the discipline is, one line under its name. */
  about: string;
  cover: Frame;
  /** Up to twelve frames of the discipline's projects, for the light table. */
  shots: Shot[];
};

/* ── services ─────────────────────────────────────────────────────
 * Julian (2026-10-03): a preview of the portfolio, not the whole of it.
 * The disciplines as an index a third wide; the other two thirds a table
 * of the one the pointer is on, its frames whole (he: "dont crop the
 * images"), each opening its project. The way on to the whole portfolio
 * under the list. Under a finger each row carries its own small picture.
 * ─────────────────────────────────────────────────────────────── */

/* Justified rows: the frames in order, split into whichever number of
   rows gives the largest pictures that still fit the table. A row that
   would overflow the height scales down, narrower than the table, and
   sits centred. */
const GAP = 6;
function justify(shots: Shot[], w: number, h: number) {
  const ar = shots.map((s) => s.width / s.height);
  const total = ar.reduce((a, b) => a + b, 0);
  let best = { rows: [] as number[][], heights: [] as number[], area: -1 };
  for (let n = 1; n <= Math.min(6, shots.length); n++) {
    // Greedy: close a row once the next frame would sit mostly past its
    // share of the total aspect. Testing the sum alone left nine films a
    // hair under three apiece, so they ran 4, 4 and one huge (Julian:
    // clean on the bottom).
    const rows: number[][] = [[]];
    let sum = 0;
    ar.forEach((a, i) => {
      if (rows[rows.length - 1].length && sum + a / 2 > total / n && rows.length < n) {
        rows.push([]);
        sum = 0;
      }
      rows[rows.length - 1].push(i);
      sum += a;
    });
    const sums = rows.map((r) => r.reduce((a, i) => a + ar[i], 0));
    const full = rows.map((r, i) => (w - GAP * (r.length - 1)) / sums[i]);
    const k = Math.min(1, (h - GAP * (rows.length - 1)) / full.reduce((a, b) => a + b, 0));
    const heights = full.map((x) => x * k);
    const area = heights.reduce((a, x, i) => a + sums[i] * x * x, 0);
    if (area > best.area) best = { rows, heights, area };
  }
  return best;
}

export function ServicesScreen({
  rows,
  total,
  children,
}: {
  rows: ServiceRow[];
  /** How many projects the portfolio holds, for the way on. */
  total: number;
  /** The press marks, under it all. */
  children?: React.ReactNode;
}) {
  const [on, setOn] = useState(0);
  const quiet = useQuiet();
  const field = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<[number, number]>([0, 0]);
  const shots = rows[on]?.shots ?? [];

  useEffect(() => {
    const el = field.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox([el.clientWidth, el.clientHeight]));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const laid = box[0] ? justify(shots, box[0], box[1]) : null;

  /* On the way to the table (Julian, 2026-10-04: a film opened the wrong
     part of the portfolio). Heading right, across other rows toward the
     photographs, a row only takes over once the hand has stayed on it a
     moment; otherwise the table swapped under the hand on the way and the
     press landed on another discipline's frame. Straight up and down the
     list it changes at once, as before. */
  const aim = useRef({ x: 0, t: 0 });
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") aim.current.x = e.movementX;
  };
  const enter = (e: React.PointerEvent, i: number) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(aim.current.t);
    if (aim.current.x > 1) aim.current.t = window.setTimeout(() => setOn(i), 160);
    else setOn(i);
  };

  /* A finger has no hover (Julian, 2026-10-08, iPad sideways): the first
     tap on a row puts its frames on the table, a second one opens it. A
     phone has no table, its rows open at once. */
  const touched = useRef(false);
  const tap = (e: React.MouseEvent, i: number) => {
    if (!touched.current || i === on || !matches("wide")) return;
    e.preventDefault();
    setOn(i);
  };

  /* Julian (2026-10-04): the drop stands proud of its row, the text
     unchanged: 8px over and under (with the ground's own -inset-y-2). */
  const PAD = 8;
  /* Julian (2026-10-03): the rows' hover in liquid, as Sessions has it.
     One drop under the row the pointer is on: it fills from the edge the
     pointer came in by, runs to the next row, drains to a line on leave. */
  const col = useRef<HTMLDivElement>(null);
  type Edge = "top" | "bottom" | "left" | "right";
  const [hot, setHot] = useState(false);
  const [edge, setEdge] = useState<Edge>("top");
  const [pinch, setPinch] = useState(false);
  const flick = useRef(0);
  const [drop, setDrop] = useState({ y: 0, h: 0 });
  const nearest = (e: React.PointerEvent, li: Element | null): Edge => {
    if (!li) return edge;
    const r = li.getBoundingClientRect();
    const d = { top: e.clientY - r.top, bottom: r.bottom - e.clientY, left: e.clientX - r.left, right: r.right - e.clientX };
    return (Object.keys(d) as Edge[]).reduce((m, k) => (d[k] < d[m] ? k : m));
  };
  useEffect(() => {
    const li = col.current?.querySelector("ul")?.children[on] as HTMLElement | undefined;
    const c = col.current?.getBoundingClientRect();
    if (!li || !c) return;
    const r = li.getBoundingClientRect();
    setDrop({ y: Math.round(r.top - c.top), h: Math.round(r.height) + PAD * 2 });
  }, [on, hot]);


  return (
    <section
      data-tick
      data-label="Commissions"
      data-hash="work"
      aria-label={`Commissions, ${rows.length} disciplines`}
      className="relative flex w-full shrink-0 flex-col sm:h-full"
    >
      <div className="services-screen screen-measure grid min-h-0 flex-1 grid-cols-1 items-center gap-10 px-6 py-12 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-x-[clamp(2rem,4vw,5rem)] sm:px-10 sm:pb-6 sm:pt-20 sm:[container-type:size]">
        <div className="flex min-w-0 flex-col gap-5">
          <RisingTitle text="Commissions" />
          {/* A pitch, not a list heading (Julian, 2026-10-03: less of a menu). */}
          <p className="title-rest -mt-2 whitespace-nowrap text-left text-sm leading-relaxed text-muted-foreground short:hidden">
            From concept to final frame.
          </p>
          {/* Under a finger (Julian, 2026-10-04: the names and the pictures
              too small in a list): the disciplines as frames, two across,
              the picture leading and the name on its slate, as the
              portfolio's own cards are. */}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:hidden">
            {rows.map((r, i) => (
              <li key={r.slug} style={{ "--i": i } as React.CSSProperties} className="services-step min-w-0">
                <Link prefetch={false} href={r.href} className="group block press active:scale-[0.98]">
                  <span className="relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-photo)] bg-card">
                    <Image
                      src={r.cover.src}
                      alt=""
                      fill
                      sizes="50vw"
                      className="object-cover"
                      style={{ backgroundColor: r.cover.color }}
                    />
                    {/* The number in full white over a deeper fall of shade:
                        at 75% over 35% it measured 2.1:1 on a bright frame
                        (plan 5.1). */}
                    <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pb-3 pt-12">
                      <span className="label tabular-nums leading-none text-white">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display line-clamp-2 text-[1.375rem] uppercase leading-[0.9] text-white">
                        {r.name}
                      </span>
                    </span>
                  </span>
                  {r.about ? (
                    <span className="label mt-2 line-clamp-2 block text-muted-foreground">{r.about}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <div ref={col} className="services-col relative isolate max-sm:hidden">
          <div aria-hidden className="services-ground pointer-events-none absolute -inset-y-2 -inset-x-6 -z-10 max-sm:hidden">
            {quiet ? (
            <Liquid blur={5} contrast={18} fill="var(--services-hover)" className="h-full w-full">
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
            ) : null}
          </div>
          <ul
            className="border-t border-border/40"
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              /* Laid shut along that edge at once, then filled from it. */
              setEdge(nearest(e, (e.target as HTMLElement).closest("li")));
              setPinch(true);
              window.clearTimeout(flick.current);
              flick.current = window.setTimeout(() => setPinch(false), 60);
              setHot(true);
            }}
            onPointerLeave={(e) => {
              setEdge(nearest(e, e.currentTarget.children[on]));
              setHot(false);
            }}
          >
            {rows.map((r, i) => (
              <li
                key={r.slug}
                style={{ "--i": i } as React.CSSProperties}
                className="services-step border-b border-border/40"
              >
                {/* Julian: the pointer snaps to the rows. Held along the
                    row's middle (`pointer-mark.tsx`), so it slides with the
                    hand and steps to the next row on the way down. */}
                <Link
                  prefetch={false}
                  href={r.href}
                  data-stick="row"
                  onPointerEnter={(e) => enter(e, i)}
                  onPointerDown={(e) => (touched.current = e.pointerType !== "mouse")}
                  onKeyDown={() => (touched.current = false)}
                  onClick={(e) => tap(e, i)}
                  onPointerMove={onMove}
                  onPointerLeave={() => window.clearTimeout(aim.current.t)}
                  // A finger's press focuses the row before its click: lit
                  // then, the first tap would already be the second.
                  onFocus={() => !touched.current && setOn(i)}
                  className="group grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 max-sm:items-center py-[clamp(0.25rem,0.7cqh,0.5rem)] max-sm:grid-cols-[auto_minmax(0,1fr)_3.5rem] max-sm:py-2"
                >
                  <span
                    className={`label tabular-nums transition-colors duration-300 ${i === on ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* The name, and under it what it is. */}
                  {/* The row whose frames are on the table sits a size up. */}
                  <span
                    className={`flex min-w-0 origin-left flex-col gap-1 transition-[scale] duration-300 ease-[var(--ease-out-strong)] motion-reduce:transition-none ${i === on ? "sm:[scale:1.06]" : ""}`}
                  >
                    <span
                      className={`font-display text-[clamp(1.25rem,min(2.2vw,4.2cqh),2.25rem)] leading-none transition-[color,translate] duration-300 ease-[var(--ease-out-strong)] motion-reduce:transition-colors ${i === on ? "translate-x-2 text-foreground" : "text-muted-foreground group-hover:translate-x-2 group-hover:text-foreground max-sm:text-foreground"}`}
                    >
                      {r.name}
                    </span>
                    {r.about ? (
                      <span className="label text-muted-foreground short:hidden sm:truncate">
                        {r.about}
                      </span>
                    ) : null}
                  </span>
                  {/* Under a finger: its own picture, in place of the table. */}
                  <span className="relative aspect-square overflow-hidden rounded-[4px] bg-card sm:hidden">
                    <Image
                      src={r.cover.src}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                      style={{ backgroundColor: r.cover.color }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          </div>
          {/* The art director's verb first (critique, 2026-10-03: it was
              nowhere before About), the whole portfolio beside it. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <Link
              prefetch={false}
              href="/#contact"
              className="services-book label action px-7 py-4 press active:scale-[0.97] sm:py-[clamp(0.625rem,1.8cqh,1rem)]"
            >
              Inquire
            </Link>
            <Link
              prefetch={false}
              href="/portfolio"
              className="label action-quiet px-7 py-4 press active:scale-[0.97] sm:py-[clamp(0.625rem,1.8cqh,1rem)]"
            >
              See the portfolio
            </Link>
            {/* Not under a finger, where it sat against the buttons (Julian,
                2026-10-04). */}
            <span className="label ml-3 text-muted-foreground max-sm:hidden">{total} projects</span>
          </div>
        </div>

        {/* The table: the frames whole, in justified rows. */}
        <div
          ref={field}
          className="light-table flex w-full flex-col items-center justify-center max-sm:hidden sm:h-[min(44rem,calc(100cqh-6rem))] 2xl:h-[calc(100cqh-4rem)]"
          style={{ gap: GAP }}
        >
          {laid?.rows.map((r, ri) => (
            <div key={ri} className="light-sheet flex" style={{ gap: GAP }}>
              {r.map((si) => {
                const s = shots[si];
                const ht = laid.heights[ri];
                return (
                  <Link
                    prefetch={false}
                    key={`${rows[on].slug}-${s.src}`}
                    href={s.href}
                    style={{ "--i": si, width: (ht * s.width) / s.height, height: ht } as React.CSSProperties}
                    className="light-cell relative block overflow-hidden rounded-[3px] [container-type:inline-size]"
                  >
                    <Image
                      src={s.src}
                      alt={/^\d+$/.test(s.title) ? `${rows[on].name}, ${s.title}` : s.title}
                      fill
                      sizes={`${Math.ceil((ht * s.width) / s.height)}px`}
                      className="object-cover"
                      style={{ backgroundColor: s.color }}
                    />
                    {/* The slate (`cover-cell.tsx`), on hover: a film's
                        "Title - Artist" splits into credit over title. */}
                    <span aria-hidden className="light-name flex flex-col items-start gap-1 bg-gradient-to-t from-black/80 via-black/35 to-transparent">
                      {s.title.includes(" - ") ? (
                        <span className="label max-w-full truncate text-[0.625rem] leading-none text-white/75">
                          {s.title.split(" - ").slice(1).join(" - ")}
                        </span>
                      ) : null}
                      <span className="font-display line-clamp-2 max-w-full text-[clamp(0.8125rem,9cqw,1.75rem)] uppercase leading-[0.9] text-white">
                        {s.title.split(" - ")[0]}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}
