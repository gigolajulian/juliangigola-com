"use client";

import * as React from "react";

/* Cover art and Motion share this (spec 3.7, 3.8): a held block that names
   the current item and one sideways row. Static form: a native scroll row
   with snap, which is also its touch and reduced-motion form. The current
   item follows the row's own scroll (snap step), `data-cur` on the section.
   The motion pass drives `--p` on the section and transforms `.mt-track`. */
/** Held (desktop, motion on) the row does not scroll itself, the page does, so left and right did nothing there.
    They step the page one item's share of the hold. Elsewhere the row is a native scroller and takes the keys itself. */
export function rowKeys(e: React.KeyboardEvent<HTMLElement>) {
  if ((e.key !== "ArrowRight" && e.key !== "ArrowLeft") || !document.documentElement.hasAttribute("data-mt-held")) return;
  const sec = e.currentTarget.closest<HTMLElement>("section");
  const n = sec?.querySelectorAll(".mt-item").length;
  if (!sec || !n) return;
  e.preventDefault();
  scrollBy({ top: ((sec.offsetHeight - innerHeight) / n) * (e.key === "ArrowRight" ? 1 : -1), behavior: "smooth" });
}

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
        <div className="mt-row" ref={row} role="group" tabIndex={0} aria-label={label} onKeyDown={rowKeys}>
          <div className="mt-track">{children}</div>
        </div>
        {foot?.(cur)}
      </div>
    </section>
  );
}
