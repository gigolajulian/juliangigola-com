"use client";

import * as React from "react";
import { useCards, useLatest } from "@/components/hero-dials";

/**
 * The line under the name: the job title, until a frame in the ring is
 * pointed at, and then that frame's discipline for as long as it is. Julian
 * asked: hover a picture and it names what kind of work it is.
 *
 * Every word is mounted at once and stacked in one cell, so the swap is a
 * transition between two nodes that already exist and the line never
 * changes height. The frames say which discipline they are with
 * `data-discipline`; one delegated listener on the cover reads it.
 */
export function CoverRole({
  role,
  disciplines,
}: {
  role: string;
  disciplines: string[];
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [on, setOn] = React.useState<string | null>(null);
  /* The frames' waits, from the "Photo hover" panel. */
  const waits = useLatest(useCards().delays);

  React.useEffect(() => {
    const cover = ref.current?.closest(".cover-float");
    if (!cover) return;
    /* The same beats the frames keep (`--focus-wait` and `--release-wait`
       in `globals.css`), so the word and the picture answer together, and
       crossing the gap between two frames goes straight from one word to
       the next without the job title flickering between. */
    let wait = 0;
    const set = (frame: HTMLElement | null) => {
      clearTimeout(wait);
      wait = window.setTimeout(
        () => setOn(frame?.dataset.discipline ?? null),
        frame ? waits.current.comeForward : waits.current.letGo,
      );
    };
    const over = (e: Event) =>
      set((e.target as Element).closest<HTMLElement>("[data-discipline]"));
    const out = () => set(null);
    cover.addEventListener("pointerover", over);
    cover.addEventListener("pointerleave", out);
    return () => {
      clearTimeout(wait);
      cover.removeEventListener("pointerover", over);
      cover.removeEventListener("pointerleave", out);
    };
  }, [waits]);

  return (
    <span ref={ref} className="cover-role grid">
      <span className="cover-role-word" data-on={on === null || undefined}>
        {role}
      </span>
      {disciplines.map((d) => (
        <span
          key={d}
          aria-hidden
          className="cover-role-word"
          data-on={on === d || undefined}
        >
          {d}
        </span>
      ))}
    </span>
  );
}
