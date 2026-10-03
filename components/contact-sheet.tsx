"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { RisingTitle } from "@/components/strip-page";
import type { Frame } from "@/lib/work-types";

/* ── the work, on a session's booking page ────────────────────────
 * Julian (overdrive, 2026-10-03): the session's gallery as a screen of
 * the page that books it, so the work, the questions and the booking
 * are one page. A contact sheet: five across, the last cell the way to
 * book. Where the gallery fits it is all here and its old address
 * redirects to it (`next.config.ts`); where it does not, the sheet is a
 * selection and says how many more the gallery holds.
 *
 * Under a mouse it racks focus (`.contact-sheet`, `globals.css`): every
 * frame sharp until one is pointed at, which comes up while the rest
 * fall back, soft and low. The same lens as the questions' wall. A tap
 * or a click opens the frame large.
 * ─────────────────────────────────────────────────────────────── */

const two = (n: number) => String(n).padStart(2, "0");

/* The white-backdrop headshots are framed from the waist, the black from
   the shoulders, and side by side the first read as zoomed out (Julian,
   2026-10-03). With `even`, a frame whose ground is white is drawn
   closer, onto the face, so every face in the sheet is about one size. */
const light = (hex: string) =>
  [1, 3, 5].every((k) => parseInt(hex.slice(k, k + 2), 16) > 0xe0);

export function ContactSheet({
  frames,
  name,
  book,
  gallery,
  total,
  even,
}: {
  frames: Frame[];
  /** The session, for the count: "14 Headshots". */
  name: string;
  /** The booking screen's title, on the last cell. */
  book: string;
  /** The whole gallery, linked where the sheet is a selection of it. */
  gallery: string;
  /** How many frames the gallery holds. */
  total: number;
  even?: boolean;
}) {
  const lightbox = useLightbox(frames);
  /* Five across, or four where that fills the last row and five does
     not (fifteen frames and the way to book are four rows of four). */
  const cells = frames.length + 1;
  const cols = cells % 5 && !(cells % 4) ? 4 : 5;
  const rows = Math.ceil(cells / cols);

  return (
    <section
      data-tick
      data-label="Work"
      data-hash="work"
      className="relative grid w-full shrink-0 grid-cols-1 content-center gap-8 border-l border-border px-6 pb-12 pt-24 sm:h-full lg:grid-cols-[minmax(max-content,0.55fr)_auto] sm:items-center sm:gap-x-[clamp(2rem,4vw,5rem)] sm:px-10 sm:pb-8 sm:[container-type:size] short:pt-20"
    >
      <div className="flex flex-col gap-5">
        <span className="label text-muted-foreground">
          <span className="mr-2 text-foreground">{two(total)}</span>
          {name}
        </span>
        <RisingTitle text="The work" className="whitespace-nowrap" />
        <p className="title-rest max-w-[34ch] text-left text-sm leading-relaxed text-muted-foreground">
          {total > frames.length
            ? `${frames.length} of ${total} here. Open any frame to see it whole.`
            : "Open any frame to see it whole."}
        </p>
        {total > frames.length ? (
          <Link href={gallery} className="title-rest label w-fit text-foreground">
            All {total}&nbsp;<span aria-hidden>&rarr;</span>
          </Link>
        ) : null}
      </div>

      {/* Beside the words from a laptop up; under them on an upright
          tablet, where side by side left the sheet a postage stamp (the
          live QA, iPad, 2026-10-03). */}
      <ul
        data-ring="Zoom"
        className="contact-sheet title-rest grid grid-cols-4 gap-1.5 sm:w-[min(100%,calc((100cqh-16rem)/var(--rows)*var(--cols)))] lg:w-[min(calc(100cqw-30rem),calc((100cqh-8rem)/var(--rows)*var(--cols)))] sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))] sm:gap-2"
        style={{ "--rows": rows, "--cols": cols } as CSSProperties}
      >
        {frames.map((f, i) => (
          <li key={f.src}>
            <button
              type="button"
              aria-label={`Open frame ${two(i + 1)} of ${two(frames.length)}`}
              onClick={(e) => lightbox.show(i, e.currentTarget.querySelector("img"))}
              className="relative block aspect-square w-full overflow-hidden rounded-[4px] press active:scale-[0.98]"
              style={{ backgroundColor: f.color }}
            >
              <Image
                src={f.src}
                alt={f.alt || `${name} ${two(i + 1)}`}
                fill
                sizes="(min-width: 640px) 14vw, 25vw"
                loading="lazy"
                className="object-cover object-[50%_30%]"
                style={even && light(f.color) ? { transform: "scale(1.6)", transformOrigin: "50% 26%" } : undefined}
              />
            </button>
          </li>
        ))}
        {/* The cell left over: the way to book, where the sheet ends. */}
        <li className={frames.length % 4 === 2 ? "col-span-2 sm:col-span-1" : undefined}>
          <Link
            href="#book"
            className="label flex aspect-square h-full w-full items-end justify-between rounded-[4px] border border-border p-3 text-foreground transition-colors duration-200 hoverable:hover:border-foreground/40 max-sm:aspect-auto"
          >
            {book}
            <span aria-hidden>&rarr;</span>
          </Link>
        </li>
      </ul>

      <Lightbox frames={frames} name={name} {...lightbox} />
    </section>
  );
}
