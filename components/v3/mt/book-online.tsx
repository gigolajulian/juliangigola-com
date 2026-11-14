"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Duo } from "@/components/v3/duo";
import { V3BookFlow } from "@/components/v3/book";
import { SESSIONS } from "@/lib/v3";
import { BOOK_ROWS, gradYear, type BookRow } from "./data";
import { useNextOpen } from "./next-open";

/* Book online: five sessions, one line each. A row is picked by hover (fine
   pointers), focus or tap, and the photo follows it. Booking finishes here:
   the list gives way to the LIVE flow (`V3BookFlow`: its own picker, Cal.com
   events, Stripe deposit and copy, untouched) and the photo stays. */
const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

export const detailOf = (r: BookRow) => r.detail.replace("{year}", String(gradYear()));

export function RowPhoto({ r, on, sizes }: { r: BookRow; on: boolean; sizes: string }) {
  const style = { objectPosition: r.at } as React.CSSProperties;
  const cls = on ? "on" : undefined;
  if (!r.slug) return <Image src={r.photo} alt={`${r.name} sample`} fill sizes={sizes} className={cls} style={style} />;
  const p = SESSIONS[r.slug].photo;
  return (
    <span className={on ? "duo on" : "duo"} style={{ "--at": r.at } as React.CSSProperties}>
      <Duo d={p.d} l={p.l} alt={`${r.name} sample`} sizes={sizes} />
    </span>
  );
}

/* Week first: the live picker opens on Month (use-picker.tsx), so this presses its Week once per session. */
function useWeekFirst(box: React.RefObject<HTMLDivElement | null>, key: string | null) {
  React.useEffect(() => {
    if (!key) return;
    let done = false;
    let mo: MutationObserver | null = null;
    const press = () => {
      const el = box.current;
      const wk = el?.querySelector<HTMLButtonElement>('.cal-top .seg button[aria-pressed="false"]:first-child');
      if (!el || done) return;
      if (el.querySelector(".cal.week")) done = true;
      else if (wk) {
        wk.click();
        done = true;
      }
      if (done) mo?.disconnect();
    };
    const t = setTimeout(() => {
      mo = new MutationObserver(press);
      if (box.current) mo.observe(box.current, { childList: true, subtree: true });
      press();
    }, 0);
    return () => {
      clearTimeout(t);
      mo?.disconnect();
    };
  }, [box, key]);
}

export function MtBookOnline({ open, onOpen, onClose }: { open: BookRow["key"] | null; onOpen: (k: BookRow["key"]) => void; onClose: () => void }) {
  const [on, setOn] = React.useState(0);
  const at = open ? Math.max(0, BOOK_ROWS.findIndex((x) => x.key === open)) : on;
  const r = BOOK_ROWS[at];
  const sec = React.useRef<HTMLElement>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const head = React.useRef<HTMLHeadingElement>(null);
  const rows = React.useRef<(HTMLButtonElement | null)[]>([]);
  const isOpen = React.useRef(false);
  useWeekFirst(box, open);

  // phones: scroll walks through the rows (motion/steps.ts); never while a booking is open, it would drop the chosen time
  React.useEffect(() => {
    const el = sec.current!;
    const step = (e: Event) => !isOpen.current && setOn(Math.min(BOOK_ROWS.length - 1, (e as CustomEvent<number>).detail));
    el.addEventListener("mt-step", step);
    return () => el.removeEventListener("mt-step", step);
  }, []);

  // opening or closing puts the block back at the top of the screen and moves focus with it
  React.useEffect(() => {
    if (!!open === isOpen.current) return;
    isOpen.current = !!open;
    // by hand, not scrollIntoView: the page keeps a scroll padding for anchors that would leave a gap here; the offset is the block's own scroll-margin (the fixed header on phones)
    const el = sec.current;
    if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) });
    if (open) head.current?.focus({ preventScroll: true });
    else rows.current[at]?.focus({ preventScroll: true });
  }, [open, at]);

  const next = useNextOpen(r.slug);
  const pick = (i: number) => {
    setOn(i);
    onOpen(BOOK_ROWS[i].key);
  };
  return (
    <section className="mt-book" data-mt="book" data-on={r.key} data-open={open ? "" : undefined} ref={sec}>
      <div className="mt-frame">
        <p className="lbl mute mt-label">Book online</p>
        <div className="mt-book-col">
          {open && r.slug ? (
            <div className="mt-bin" onKeyDown={(e) => e.key === "Escape" && onClose()}>
              <div className="mt-bin-top">
                <button type="button" className="mt-link" onClick={onClose}>Back</button>
                <Link className="mt-link" href={`/book/${r.slug}`}>Open full page</Link>
              </div>
              <h3 className="mt-bin-t" tabIndex={-1} ref={head}>{r.name}</h3>
              <p className="lbl mt-bin-m">{r.len} <i>|</i> {r.price}</p>
              <div className="mt-bin-flow" ref={box}>
                <V3BookFlow key={r.slug} slug={r.slug} tabs={false} />
              </div>
            </div>
          ) : (
            <>
              <div className="mt-brs">
                {BOOK_ROWS.map((x, i) => (
                  <div key={x.key} className="mt-brw" data-on={i === on || undefined}>
                    {/* a mouse picks by hover and books by click; a finger picks first, then books */}
                    <button
                      type="button"
                      className="mt-br"
                      ref={(el) => void (rows.current[i] = el)}
                      aria-pressed={i === on}
                      onPointerEnter={() => fine() && setOn(i)}
                      onFocus={() => setOn(i)}
                      onClick={() => (fine() || i === on ? pick(i) : setOn(i))}
                    >
                      <b>{x.name}</b>
                      <span className="lbl">{x.len} <i>|</i> {x.price}</span>
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-act">
                <button type="button" className="btn fill mt-big" onClick={() => pick(on)}>{r.btn}</button>
                <Link className="mt-link" href="/book">All sessions</Link>
              </div>
              <p className="lbl mute mt-dep">$100 secures your date and goes toward your balance.</p>
            </>
          )}
        </div>
        <figure className="mt-photo" aria-live="off">
          {BOOK_ROWS.map((x, i) => <RowPhoto key={x.key} r={x} on={i === at} sizes="(max-width: 1023px) 100vw, 42vw" />)}
        </figure>
      </div>
      {/* Phone, tablet and on its side: the held bar while the screen is up. */}
      <div className="mt-bar">
        <p className="lbl mute">{next ? <>Next open<br />{next}</> : null}</p>
        <button type="button" className="btn fill" onClick={() => pick(on)}>{r.btn}</button>
      </div>
    </section>
  );
}
