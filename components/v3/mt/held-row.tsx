"use client";

import * as React from "react";

/* Cover art and Motion share this (spec 3.7, 3.8): a held block that names
   the current item and one sideways row. Static form: a native scroll row
   with snap, which is also its touch and reduced-motion form. The current
   item follows the row's own scroll (snap step), `data-cur` on the section.
   The motion pass drives `--p` on the section and transforms `.mt-track`. */
export function HeldRow({
  name,
  hold,
  label,
  count,
  head,
  foot,
  children,
}: {
  name: string;
  hold: number;
  label: string;
  count: number;
  head?: (cur: number) => React.ReactNode;
  foot?: (cur: number) => React.ReactNode;
  children: React.ReactNode;
}) {
  const row = React.useRef<HTMLDivElement>(null);
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    const el = row.current!;
    let raf = 0;
    const read = () => {
      raf = 0;
      const items = el.querySelectorAll<HTMLElement>(".mt-item");
      if (items.length < 2) return;
      const step = items[1].offsetLeft - items[0].offsetLeft;
      setCur(Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / step))));
    };
    const on = () => (raf ||= requestAnimationFrame(read));
    el.addEventListener("scroll", on, { passive: true });
    return () => {
      el.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  React.useEffect(() => {
    row.current!.querySelectorAll(".mt-item").forEach((it, i) => it.toggleAttribute("data-on", i === cur));
  }, [cur]);
  return (
    <section className={`mt-held mt-${name}`} data-mt={name} data-hold={hold} data-cur={cur} style={{ "--n": count } as React.CSSProperties}>
      <div className="mt-stage">
        {head?.(cur)}
        <div className="mt-row" ref={row} tabIndex={0} aria-label={label}>
          <div className="mt-track">{children}</div>
        </div>
        {foot?.(cur)}
      </div>
    </section>
  );
}
