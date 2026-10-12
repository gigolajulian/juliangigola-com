"use client";

import * as React from "react";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalEmbed } from "@/components/cal-embed";
import { ContactForm } from "@/components/contact-form";
import { SESSION_TYPES } from "@/lib/sessions";
import type { MenuItem } from "@/lib/booking";
import type { Frame } from "@/lib/work-types";
import { cn } from "@/lib/utils";

/* ── book here ────────────────────────────────────────────────────
 * The Sessions screen as a booking menu, behind `?bookhere` (Julian):
 * the ways to book on the right, no prices; on the left a photograph.
 * Picking one flips the photograph over in 3D, and its back is the
 * booking card, the whole width of the space: a session's
 * calendar, or for a commission a call or the form. Nothing else moves.
 * The open one's name is set large, fitted to its column, its words
 * justified to the name's width.
 * ─────────────────────────────────────────────────────────────── */

const SESSIONS = SESSION_TYPES.map((s) => s.name);

/* The photograph on the front: 3:4, as tall as the space, in the middle
   of it. The card on the back is the whole space. Both are as tall, so
   the change of width happens edge-on, where neither shows. Only the
   turn animates, a transform the GPU runs on its own. */
const PHOTO_W = "min(100cqw, 75cqh)";
const FLIP = { duration: 800, easing: "cubic-bezier(0.65, 0, 0.35, 1)" };
/* Going back is quicker than coming, and a row folds faster than it opens. */
const UNFLIP = { ...FLIP, duration: 640 };
const FOLD = { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The open name, as large as its column allows up to its size. */
function FitName({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    const li = el?.closest("li");
    if (!el || !li) return;
    const fit = () => {
      el.style.fontSize = "";
      const max = parseFloat(getComputedStyle(el).fontSize);
      // Fitted to the column, then a third smaller (Julian).
      el.style.fontSize = `${(Math.min(max, (max * el.clientWidth) / el.scrollWidth) * 2) / 3}px`;
      // The words under it take the name's width, never under 15rem.
      li.style.setProperty("--namew", `max(15rem, ${el.scrollWidth}px)`);
    };
    fit();
    const runs: Animation[] = [];
    /* Grown out of the row's own size, and the row opened with it: from
       a closed row's height, the next or the last one. */
    if (!still()) {
      const from = parseFloat(getComputedStyle(li).fontSize) / parseFloat(el.style.fontSize);
      const shut = (li.nextElementSibling ?? li.previousElementSibling) as HTMLElement | null;
      const grow = { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
      runs.push(el.animate([{ transform: `scale(${from})` }, { transform: "scale(1)" }], grow));
      if (shut) runs.push(li.animate([{ height: `${shut.offsetHeight}px`, overflow: "clip" }, { height: `${li.offsetHeight}px`, overflow: "clip" }], grow));
    }
    const ro = new ResizeObserver(fit);
    ro.observe(li);
    return () => {
      ro.disconnect();
      // Let go, so a second run (React's dev double effect) measures the row open.
      runs.forEach((a) => a.cancel());
    };
  }, []);
  return (
    <span ref={ref} data-name className="font-display block origin-bottom-left overflow-hidden whitespace-nowrap text-[clamp(2.8rem,4.8vw,4.8rem)] leading-[0.88] tracking-[-0.02em] text-foreground">
      {children}
    </span>
  );
}

export function BookHere({ items, photos = {} }: { items: MenuItem[]; photos?: Record<string, Frame | null> }) {
  const [open, setOpen] = React.useState<number | null>(null);
  const [tab, setTab] = React.useState<"call" | "form">("call");
  /* The photograph on the front: the session pointed at, or the last one
     that has a photograph. */
  const [peek, setPeek] = React.useState(() => items.find((s) => photos[s.slug])?.slug);
  /* The card pointed at is built on the back before the click, so the
     turn shows a finished card rather than one still building. */
  const [pre, setPre] = React.useState<number | null>(null);
  /* Built once the pointer rests (150ms), not for every row it crosses:
     each build asks Cal.com for its times. */
  const intent = React.useRef(0);
  const look = (i: number) => {
    // Not while a card turns: rows folding under a still pointer would
    // swap the card on its way out.
    if (turning.current) return;
    if (photos[items[i].slug]) setPeek(items[i].slug);
    window.clearTimeout(intent.current);
    intent.current = window.setTimeout(() => setPre(i), 150);
  };

  const flipper = React.useRef<HTMLDivElement>(null);
  const turning = React.useRef(false);
  const back = React.useRef<HTMLDivElement>(null);
  /* Over to the card (1) or back to the photograph (-1). It sinks a
     little as it turns and comes back up on the far side, like a thing
     held and turned over rather than a page spun in place. Reduced motion
     gets the faces swapped under a short fade. */
  const turn = (to: 1 | -1) => {
    const f = flipper.current;
    if (!f) return Promise.resolve();
    if (still()) return f.animate([{ opacity: 0 }, { opacity: 1 }], 200).finished.then(() => {}, () => {});
    const k = [
      { transform: "rotateY(0deg) scale(1)" },
      { transform: "rotateY(90deg) scale(0.93)" },
      { transform: "rotateY(180deg) scale(1)" },
    ];
    return f.animate(to === 1 ? k : k.reverse(), to === 1 ? FLIP : UNFLIP).finished.then(() => {}, () => {});
  };

  /* The open row folds back to a plain row rather than snapping: its
     height and its name's size are kept the moment before it closes. */
  const list = React.useRef<HTMLDivElement>(null);
  const shut = React.useRef<{ i: number; h: number; px: number } | null>(null);
  const keep = () => {
    const li = open === null ? null : list.current?.querySelector<HTMLElement>(`li[data-i="${open}"]`);
    const name = li?.querySelector<HTMLElement>("[data-name]");
    if (!li || !name) return;
    // As drawn, mid-animation included.
    const px = parseFloat(getComputedStyle(name).fontSize) * (name.getBoundingClientRect().width / name.offsetWidth);
    shut.current = { i: open!, h: li.getBoundingClientRect().height, px };
  };
  React.useLayoutEffect(() => {
    const s = shut.current;
    shut.current = null;
    if (!s || s.i === open || still()) return;
    const li = list.current?.querySelector<HTMLElement>(`li[data-i="${s.i}"]`);
    const name = li?.querySelector<HTMLElement>("[data-name]");
    if (!li || !name) return;
    li.animate([{ height: `${s.h}px`, overflow: "clip" }, { height: `${li.offsetHeight}px`, overflow: "clip" }], FOLD);
    name.animate([{ transform: `scale(${s.px / parseFloat(getComputedStyle(name).fontSize)})` }, { transform: "scale(1)" }], FOLD);
  }, [open]);
  /** `keys`: opened from the keyboard, so the focus goes into the card. */
  const go = (i: number | null, keys = false) => {
    if (turning.current) return;
    window.clearTimeout(intent.current);
    const enter = () => keys && back.current?.focus();
    if (open === null && i !== null) {
      look(i);
      window.clearTimeout(intent.current);
      setPre(i);
      setTab("call");
      setOpen(i);
      turning.current = true;
      turn(1).then(() => {
        turning.current = false;
        enter();
      });
    } else if (open !== null && i === null) {
      // The row folds as the card turns back; the card stays on the back
      // until it is out of sight.
      keep();
      // Focus in the card goes back to its row before the card turns
      // inert, or it falls to the page (QA, #118).
      if (back.current?.contains(document.activeElement))
        list.current?.querySelector<HTMLElement>(`li[data-i="${open}"] > button`)?.focus({ preventScroll: true });
      setHold(null);
      setPre(open);
      setOpen(null);
      turning.current = true;
      turn(-1).then(() => {
        turning.current = false;
        setTab("call");
      });
    } else {
      keep();
      // The first card held stays held through quick switches.
      const was = items[open!];
      setHold((h) => h ?? { card: was, mode: was.cal ? tab : "form" });
      setTab("call");
      setOpen(i);
      enter();
    }
  };
  /* Switching while open, the old card stays a beat so the list moves
     first: building the next calendar holds the main thread, and the
     rows' fold and growth run on it. */
  const [hold, setHold] = React.useState<{ card: MenuItem; mode: "call" | "form" } | null>(null);
  React.useEffect(() => {
    if (!hold) return;
    const t = setTimeout(() => setHold(null), 540);
    return () => clearTimeout(t);
  }, [hold]);
  React.useEffect(() => {
    if (open === null) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && go(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  /* On a phone the card opens under the list: take the page to it. */
  React.useEffect(() => {
    if (open !== null && matchMedia("(max-width: 39.99rem)").matches)
      document.getElementById("book-card")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [open]);

  const item = open === null ? null : items[open];
  // On the back: the open card, or the one pointed at, built ahead.
  const live = item ?? (pre === null ? null : items[pre]);
  const card = hold?.card ?? live;
  const mode = hold?.mode ?? (card?.cal ? tab : "form");
  const groups = [
    { label: "Book a time", group: "time" },
    { label: "Commissions", group: "commission" },
  ] as const;

  return (
    <div className="grid h-full w-full grid-cols-1 content-start gap-6 px-6 py-12 sm:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] sm:grid-rows-[auto_minmax(0,1fr)] sm:gap-x-[clamp(2rem,4vw,4rem)] sm:max-lg:portrait:grid-cols-1 sm:max-lg:portrait:grid-rows-[auto_auto_minmax(0,1fr)] sm:px-10 sm:pb-8 sm:pt-20 short:pb-4">
      {/* Docked, as the portfolio's title is. */}
      <div className="flex flex-col items-center gap-0.5 text-center sm:col-span-2 sm:max-lg:portrait:col-span-1 sm:mt-6">
        <h2 className="font-display text-[clamp(1.5rem,2vw,2rem)] uppercase leading-none">Sessions</h2>
        <span key={item?.slug ?? "all"} className="label text-muted-foreground motion-safe:animate-[jg-fade-up_320ms_var(--ease-out-strong)_both]">
          {/* Nothing when shut, but the line kept so nothing moves on open. */}
          {item ? item.name : " "}
        </span>
      </div>

      <div ref={list} className="title-rest flex w-full flex-col gap-6 sm:col-start-2 sm:row-start-2 sm:max-lg:portrait:col-start-1 sm:max-lg:portrait:grid sm:max-lg:portrait:grid-cols-2 sm:max-lg:portrait:items-start sm:max-lg:portrait:gap-x-8 short:gap-4">
        {groups.map(({ label, group }) => (
          <div key={group} className="flex flex-col gap-2">
            <span id={`bh-${group}`} className="label text-muted-foreground">{label}</span>
            <ul aria-labelledby={`bh-${group}`} className="border-t border-border">
              {items.map((s, i) => {
                if (s.group !== group) return null;
                const on = i === open;
                return (
                  <li
                    key={s.slug}
                    data-i={i}
                    style={{ "--i": i } as React.CSSProperties}
                    className="session-step grid grid-cols-[2.4em_minmax(0,1fr)] border-b border-border text-[clamp(1.15rem,1.7vw,1.6rem)] short:text-[clamp(1rem,1.5vw,1.35rem)]"
                  >
                    <button
                      type="button"
                      aria-expanded={on}
                      aria-controls={on ? "book-card" : undefined}
                      onClick={(e) => !on && go(i, e.detail === 0)}
                      onPointerEnter={() => open === null && look(i)}
                      onFocus={() => open === null && look(i)}
                      className="group col-span-2 grid grid-cols-subgrid items-baseline py-[0.4em] text-left max-sm:py-[0.7em]"
                    >
                      <span className={cn("font-display tabular-nums leading-none transition-colors duration-300", on ? "text-foreground" : "text-muted-foreground/75")}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {on ? (
                        <FitName>{s.name}</FitName>
                      ) : (
                        <span data-name className="font-display inline-block origin-bottom-left leading-none text-muted-foreground transition-colors duration-300 hoverable:group-hover:text-foreground">{s.name}</span>
                      )}
                    </button>
                    {on ? (
                      <div className="col-start-2 flex flex-col gap-3 pb-4 pt-1 motion-safe:animate-[jg-fade-up_520ms_120ms_var(--ease-out-strong)_both]">
                        <p lang="en" className="max-w-full text-justify text-sm normal-case leading-[1.4] text-muted-foreground hyphens-auto" style={{ width: "var(--namew)" }}>
                          {s.blurb}
                        </p>
                        {s.page ? (
                          <Link href={s.page} className="tap-44 label self-start py-1 text-muted-foreground hoverable:hover:text-foreground">
                            More on {s.name.toLowerCase()}&nbsp;<span aria-hidden>&rarr;</span>
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* The photograph, and on its back the card. A phone has no room
          for the photograph and gets the card alone, under the list. */}
      <div className={cn("title-rest relative min-h-0 sm:col-start-1 sm:row-start-2 sm:max-lg:portrait:row-start-3 [container-type:size] [perspective:1800px] max-sm:h-[80svh]", !item && "max-sm:hidden")}>
        <div ref={flipper} className="relative h-full w-full [transform-style:preserve-3d]" style={{ transform: item ? "rotateY(180deg)" : undefined }}>
          <div
            aria-hidden={!!item}
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 overflow-hidden rounded-[4px] bg-card [backface-visibility:hidden]"
            style={{ width: PHOTO_W }}
          >
            {Object.entries(photos).map(([slug, f]) =>
              f ? (
                <Image
                  key={slug}
                  src={f.src}
                  alt={f.alt || ""}
                  fill
                  sizes="60vw"
                  className={cn("object-cover object-[50%_25%] transition-opacity duration-700 ease-[var(--ease-out-strong)]", slug === peek ? "opacity-100" : "opacity-0")}
                  style={{ backgroundColor: f.color }}
                />
              ) : null,
            )}
          </div>
          <div
            ref={back}
            id="book-card"
            tabIndex={-1}
            role="region"
            aria-label={item ? `Book ${item.name}` : undefined}
            inert={!item}
            className="absolute inset-0 flex flex-col overflow-hidden rounded-[12px] border-[0.5px] border-border bg-card outline-none [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            {card ? (
              <>
                {/* Close in the corner, over the picker's own top line, so a
                    session's calendar keeps the card's whole height. On a
                    phone the calendar scrolls, so Close takes a line of its
                    own above it rather than having the days run under it
                    (QA, #118). A commission's two ways in get a line too. */}
                <button type="button" onClick={() => go(null)} className="tap-44 label absolute right-5 top-3 z-20 rounded-[4px] bg-card/90 px-1.5 text-muted-foreground hoverable:hover:text-foreground max-sm:relative max-sm:right-auto max-sm:top-auto max-sm:mr-5 max-sm:mt-3 max-sm:self-end sm:right-10 sm:top-4">
                  Close <span aria-hidden>&times;</span>
                </button>
                {card.cal && card.form ? (
                  <div className="flex gap-5 px-5 pt-5 sm:px-10 sm:pt-6" role="group" aria-label="How to reach me">
                    {(["call", "form"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={mode === t}
                        onClick={() => setTab(t)}
                        className={cn("label border-b pb-1 transition-colors duration-200", mode === t ? "border-current text-foreground" : "border-transparent text-muted-foreground hoverable:hover:text-foreground")}
                      >
                        {t === "call" ? "Book a call" : "Send details"}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div key={`${card.slug}-${mode}`} className="min-h-0 flex-1 motion-safe:animate-[jg-fade-up_420ms_var(--ease-out-strong)_both]">
                  {mode === "call" && card.cal ? (
                    <CalEmbed path={card.cal} title={`Pick a time for ${card.name}`} className="booking-embed block h-full w-full border-0 [&>.sticky]:bg-card/80 max-sm:overflow-y-auto max-sm:overscroll-contain" />
                  ) : (
                    /* One reading width in the middle of the card; its
                       rhythm is set by the card (`.book-form`, contact.css). */
                    <div data-scroll className="h-full overflow-y-auto overscroll-contain px-6 pb-6 pt-12 sm:px-12">
                      <div className="book-form mx-auto flex min-h-full max-w-[40rem] flex-col justify-center sm:[&_textarea]:h-[3.75rem]">
                        <Suspense fallback={null}>
                          <ContactForm defaults={card.form} sessions={SESSIONS} />
                        </Suspense>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── the card alone ───────────────────────────────────────────────
 * The booking card by itself, for the Sessions screen as it was with the
 * card on its left (Julian, 2026-10-11): a session's calendar, or for a
 * commission a call or the form. Its own size container, so the form
 * keeps its fit (`.book-form`, contact.css).
 * ─────────────────────────────────────────────────────────────── */
export function BookCard({ item, onClose, className }: { item: MenuItem; onClose: () => void; className?: string }) {
  const [tab, setTab] = React.useState<"call" | "form">("call");
  const mode = item.cal ? tab : "form";
  return (
    <div
      id="book-card"
      role="region"
      aria-label={`Book ${item.name}`}
      tabIndex={-1}
      className={cn("relative flex flex-col overflow-hidden rounded-[12px] border-[0.5px] border-border bg-card outline-none [--card-x:1.25rem] [container-type:size] sm:[--card-x:2.5rem]", className)}
    >
      {/* The card's own top line: the ways to reach me on the left where
          there are two, Close on the right. Nothing scrolls under it
          (Julian, 2026-10-11: room up top for Close). */}
      <div className="flex shrink-0 items-center justify-between gap-5 px-[var(--card-x)] pt-3 sm:pt-4">
      {item.cal && item.form ? (
        <div className="flex gap-5" role="group" aria-label="How to reach me">
          {(["call", "form"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={mode === t}
              onClick={() => setTab(t)}
              className={cn("label border-b pb-1 transition-colors duration-200", mode === t ? "border-current text-foreground" : "border-transparent text-muted-foreground hoverable:hover:text-foreground")}
            >
              {t === "call" ? "Book a call" : "Send details"}
            </button>
          ))}
        </div>
      ) : <span />}
        <button type="button" onClick={onClose} className="tap-44 label text-muted-foreground hoverable:hover:text-foreground">
          Close <span aria-hidden>&times;</span>
        </button>
      </div>
      <div key={`${item.slug}-${mode}`} className="min-h-0 flex-1 motion-safe:animate-[jg-fade-up_420ms_var(--ease-out-strong)_both]">
        {mode === "call" && item.cal ? (
          <CalEmbed path={item.cal} title={`Pick a time for ${item.name}`} className="booking-embed block h-full w-full border-0 [&>.sticky]:bg-card/80 overflow-y-auto overscroll-contain" />
        ) : (
          <div data-scroll className="h-full overflow-y-auto overscroll-contain px-[var(--card-x)] pb-6 pt-5">
            <div className="book-form flex flex-col gap-[clamp(1.25rem,4cqh,2.5rem)] sm:[&_textarea]:h-[3.75rem]">
              {/* The promise in the labels' voice over a hairline, so the
                  card opens as a conversation. */}
              <div className="border-b-[0.5px] border-foreground/30 pb-[clamp(1.25rem,4cqh,2rem)]">
                <p className="label max-w-[48ch] leading-relaxed text-muted-foreground">Tell me what you have in mind. I reply within 24 hours with an approach and a quote.</p>
              </div>
              <Suspense fallback={null}>
                <ContactForm defaults={item.form} sessions={SESSIONS} />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
