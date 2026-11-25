"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Duo } from "@/components/site/duo";
import { SESSIONS } from "@/lib/booking/catalog";
import { matches } from "@/lib/device";
import { BOOK_ROWS, type BookRow } from "@/lib/home/data";
import { warmGsap } from "@/lib/motion/gsap-lazy";
import { useNextOpen } from "./next-open";
import { CardsCtx } from "./ctx";

/* Book online: four sessions, one line each. A row is picked by hover (fine
   pointers), focus or tap, and the photo follows it. Booking finishes here:
   the list gives way to the LIVE flow (`BookFlow`: its own picker, the site's
   events, Stripe deposit and copy, untouched) and the photo stays. */

/* The live flow (pickers, deposit, the orb: about 100KB) is not in the home page's first load (audit). It is
   fetched once the Sessions block nears the screen, on a row's hover or focus, and after the page has loaded and gone
   idle (for a footer link that opens a booking straight away), so the first tap never waits on it. Not React.lazy:
   a Suspense reveal is held about 300ms even when the module is already here. */
type Flow = typeof import("@/components/booking/book").BookFlow;
let Flow: Flow | undefined;
let flow: Promise<unknown> | undefined;
const warmFlow = () =>
  (flow ??= import("@/components/booking/book").then(
    (m) => (Flow = m.BookFlow),
    () => (flow = undefined),
  ));

function RowPhoto({ r, on, sizes }: { r: BookRow; on: boolean; sizes: string }) {
  const p = SESSIONS[r.slug].photo;
  return (
    <span className={on ? "duo on" : "duo"} aria-hidden={on ? undefined : true} style={{ "--at": r.pos } as React.CSSProperties}>
      <Duo dark={p.d} light={p.l} alt={`${r.name} sample`} sizes={sizes} />
    </span>
  );
}

export function BookOnline({
  open,
  opener,
  onClose,
  samples,
}: {
  open: BookRow["slug"] | null;
  opener?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  /** More frames per session, after its main photo (lib/home/server.ts). */
  samples: Record<string, string[]>;
}) {
  const cards = React.useContext(CardsCtx);
  const [sel, setSel] = React.useState(0);
  const shownIdx = open
    ? Math.max(
        0,
        BOOK_ROWS.findIndex((x) => x.slug === open),
      )
    : sel;
  const r = BOOK_ROWS[shownIdx];
  // One frame, the picked session's photos through it: the main one, then its samples, as the photo crosses the screen.
  // Not during a booking, and not for visitors who asked for less motion: then it stays on the main photo.
  const more = samples[r.slug] ?? [];
  const fig = React.useRef<HTMLElement>(null);
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (matches("calm")) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = fig.current;
      if (!el) return;
      const t = (innerHeight * 0.8 - el.getBoundingClientRect().top) / (innerHeight * 0.75);
      setStep(Math.min(2, Math.max(0, Math.floor(t * 3))));
    };
    const on = () => (raf ||= requestAnimationFrame(read));
    addEventListener("scroll", on, { passive: true });
    read();
    return () => (removeEventListener("scroll", on), cancelAnimationFrame(raf));
  }, []);
  const shot = open ? 0 : Math.min(step, more.length);
  const sec = React.useRef<HTMLElement>(null);
  const head = React.useRef<HTMLHeadingElement>(null);
  const rows = React.useRef<(HTMLButtonElement | null)[]>([]);
  const isOpen = React.useRef(false);
  // the booking flow's gsap, fetched on idle so its first step slides on the tap's frame
  React.useEffect(warmGsap, []);
  const [, flowIn] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (open && !Flow) void warmFlow().then(flowIn);
  }, [open]);
  React.useEffect(() => {
    const el = sec.current;
    const io =
      el && window.IntersectionObserver
        ? new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (warmFlow(), io?.disconnect()), { rootMargin: "100% 0px" })
        : null;
    if (el) io?.observe(el);
    const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(warmFlow, { timeout: 3000 }) : setTimeout(warmFlow, 1500));
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
    return () => {
      io?.disconnect();
      removeEventListener("load", idle);
    };
  }, []);

  // opening or closing puts the block back at the top of the screen and moves focus with it
  React.useEffect(() => {
    if (!!open === isOpen.current) return;
    isOpen.current = !!open;
    // opened from a footer link: closing goes back to that link, where the visitor started
    const back = !open && opener?.current;
    if (back) return back.focus();
    // by hand, not scrollIntoView: the page keeps a scroll padding for anchors that would leave a gap here; the offset is the block's own scroll-margin (the fixed header on phones)
    const el = sec.current;
    if (el)
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) });
    if (open) head.current?.focus({ preventScroll: true });
    else rows.current[shownIdx]?.focus({ preventScroll: true });
  }, [open, shownIdx, opener]);

  const next = useNextOpen(r.slug);
  const pick = (i: number) => {
    setSel(i);
    cards.book(BOOK_ROWS[i].slug);
  };
  return (
    <section
      id="sessions"
      className="mt-book"
      aria-label="Book online"
      data-mt="book"
      data-on={r.slug}
      data-open={open ? "" : undefined}
      ref={sec}
    >
      <div className="mt-frame">
        <h2 className="mt-bq-h">
          Sessions <span className="lbl mute">Book online</span>
        </h2>
        <div className="mt-book-col">
          {open ? (
            <div className="mt-bin" onKeyDown={(e) => e.key === "Escape" && onClose()}>
              <div className="mt-bin-top">
                <button type="button" className="mt-link" onClick={onClose}>
                  Back
                </button>
                <Link className="mt-link" href={`/book/${r.slug}`}>
                  More about this session
                </Link>
              </div>
              <h3 className="mt-bin-t" tabIndex={-1} ref={head}>
                {r.name}
              </h3>
              <p className="lbl mt-bin-m">
                {r.len} <i aria-hidden>|</i> {r.price}
              </p>
              <div className="mt-bin-flow">
                {/* the live picker opens on Month; here it opens on the week */}
                {/* on a slow line the slot keeps the flow's first height until it lands, so By quote below never jumps */}
                {Flow ? (
                  <Flow key={r.slug} slug={r.slug} tabs={false} startView="week" />
                ) : (
                  <div className="mt-bin-wait" aria-busy="true">
                    <p className="lbl mute" role="status">
                      Loading times
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-brs">
                {BOOK_ROWS.map((x, i) => (
                  <div key={x.slug} className="mt-brw" data-on={i === sel || undefined}>
                    {/* a mouse picks by hover and books by click; a finger picks first, then books */}
                    <button
                      type="button"
                      className="mt-br"
                      ref={(el) => void (rows.current[i] = el)}
                      aria-pressed={i === sel}
                      onPointerEnter={() => (warmFlow(), matches("fine") && setSel(i))}
                      onFocus={(e) => (warmFlow(), e.currentTarget.matches(":focus-visible") && setSel(i))}
                      onClick={() => (matches("fine") || i === sel ? pick(i) : setSel(i))}
                    >
                      <b>{x.name}</b>
                      <span className="lbl">
                        {x.len} <i aria-hidden>|</i> {x.price}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-act">
                <button type="button" className="btn fill mt-big" onClick={() => pick(sel)}>
                  {r.btn}
                </button>
                {next ? (
                  <p className="lbl mt-next">
                    <span className="mute">Next open</span> {next}
                  </p>
                ) : null}
                <Link className="mt-link" href="/book">
                  All sessions
                </Link>
              </div>
              <p className="lbl mute mt-dep">{r.dep} deposit secures your date and goes toward your balance.</p>
            </>
          )}
        </div>
        <figure className="mt-photo" ref={fig}>
          {BOOK_ROWS.map((x, i) => (
            <RowPhoto key={x.slug} r={x} on={i === shownIdx && shot === 0} sizes="(max-width: 1023px) 100vw, 42vw" />
          ))}
          {/* every session's frames are mounted, so picking another row never shows an empty frame while its photo loads */}
          {BOOK_ROWS.flatMap((x, i) =>
            (samples[x.slug] ?? []).map((src, k) => (
              <Image
                key={src}
                src={src}
                alt={i === shownIdx && shot === k + 1 ? `${x.name} sample ${k + 2}` : ""}
                aria-hidden={i === shownIdx && shot === k + 1 ? undefined : true}
                fill
                sizes="(max-width: 1023px) 100vw, 42vw"
                className={i === shownIdx && shot === k + 1 ? "qp on" : "qp"}
              />
            )),
          )}
          {more.length && !open ? (
            <figcaption className="lbl mt-photo-n" aria-hidden>
              {shot + 1} / {more.length + 1}
            </figcaption>
          ) : null}
        </figure>
      </div>
      {/* Phone, tablet and on its side: the held bar while the screen is up. */}
      <div className="mt-bar">
        <p className="lbl mute">
          {next ? (
            <>
              Next open
              <br />
              {next}
            </>
          ) : null}
        </p>
        <button type="button" className="btn fill" onClick={() => pick(sel)}>
          {r.btn}
        </button>
      </div>
    </section>
  );
}
