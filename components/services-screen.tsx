"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RisingTitle } from "@/components/strip-page";
import type { Frame } from "@/lib/work-types";

/** One frame on the light table: a project's picture and where it opens. */
export type Shot = { src: string; color?: string; width: number; height: number; title: string; href: string };

export type ServiceRow = {
  slug: string;
  name: string;
  href: string;
  medium: string;
  count: number;
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
    // Greedy: close a row once it holds its share of the total aspect.
    const rows: number[][] = [[]];
    let sum = 0;
    ar.forEach((a, i) => {
      if (sum >= total / n && rows.length < n) {
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


  return (
    <section
      data-tick
      data-label="Commissions"
      data-hash="work"
      aria-label={`Commissions, ${rows.length} disciplines`}
      className="relative flex w-full shrink-0 flex-col sm:h-full"
    >
      <div className="services-screen screen-measure grid min-h-0 flex-1 grid-cols-1 items-center gap-10 px-6 py-12 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-x-[clamp(2rem,4vw,5rem)] sm:px-10 sm:pb-6 sm:pt-20 sm:[container-type:size]">
        <div className="flex min-w-0 flex-col gap-6">
          <RisingTitle text="Commissions" />
          <ul className="border-t border-border">
            {rows.map((r, i) => (
              <li
                key={r.slug}
                style={{ "--i": i } as React.CSSProperties}
                className="services-step border-b border-border"
              >
                <Link
                  prefetch={false}
                  href={r.href}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setOn(i)}
                  onFocus={() => setOn(i)}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 max-sm:items-center py-[clamp(0.375rem,1.1cqh,0.75rem)] max-sm:grid-cols-[auto_minmax(0,1fr)_3.5rem] max-sm:py-2"
                >
                  <span
                    className={`font-display text-[clamp(1.25rem,2.2vw,2.25rem)] leading-none tabular-nums transition-colors duration-300 ${i === on ? "text-foreground" : "text-muted-foreground/60"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* The medium beside the name while it fits, under it when not. */}
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span
                      className={`font-display text-[clamp(1.25rem,2.2vw,2.25rem)] leading-none transition-[color,translate] duration-300 ease-[var(--ease-out-strong)] ${i === on ? "translate-x-2 text-foreground" : "text-muted-foreground max-sm:text-foreground"}`}
                    >
                      {r.name}
                    </span>
                    <span className="label text-muted-foreground max-sm:hidden short:hidden">
                      {r.medium} &middot; {r.count}
                    </span>
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
            <span className="label ml-3 text-muted-foreground">{total} projects</span>
          </div>
        </div>

        {/* The table: the frames whole, in justified rows. */}
        <div
          ref={field}
          className="light-table flex w-full flex-col items-center justify-center max-sm:hidden sm:h-[min(44rem,calc(100cqh-6rem))]"
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
                    className="light-cell relative block overflow-hidden rounded-[3px]"
                  >
                    <Image
                      src={s.src}
                      alt={s.title}
                      fill
                      sizes={`${Math.ceil((ht * s.width) / s.height)}px`}
                      style={{ backgroundColor: s.color }}
                    />
                    <span aria-hidden className="light-name label truncate">
                      {s.title}
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
