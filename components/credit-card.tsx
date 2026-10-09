"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Liquid } from "@/components/liquid";

/* ── who that is ──────────────────────────────────────────────────
 * A credit on a project page is a person's name and a link that takes the
 * visitor off the site. Held for a beat it says who they are first: their
 * face, their handle set large, and the way out under it.
 *
 * Julian (2026-10-02, overdrive): the card is poured out of the name. A
 * drop of ink wells up under the word, which turns to the ground's colour
 * inside it, and the card is drawn out of that drop, necking and letting
 * go. Then: the card covered the credits under it, so the list opens to
 * make room for it; and going from one name to the next, the drop slides
 * across as the portfolio's filter bar does (`effect="move"`, wobble
 * 0.25), the card going with it, rather than one card draining and
 * another pouring. The pointer's dot sticks to the name as it does to a
 * filter chip (`data-stick`, `pointer-mark.tsx`), so the mouse runs into
 * the tag.
 *
 * One liquid for the whole list (`CreditList`), mounted only while a card
 * is open: a group that is not there measures nothing, so the credits cost
 * no frames while scrolling (audit, 2026-10-02).
 *
 * The photograph is ours, kept in `public/people` and written by /admin
 * when the person was added. Instagram is asked nothing at all from here:
 * its picture addresses are signed and expire within days, and fetching
 * one would send every visitor who hovers a name to Instagram's servers.
 * With no picture on file the circle is simply not there.
 *
 * The card is the pointer's and the keyboard's, never a reader's: the name
 * it comes out of is the same link with the same words, so the card is
 * hidden from assistive technology and its own link is out of the tab
 * order. A phone never sees it (`HOVERS`).
 * ─────────────────────────────────────────────────────────────── */
const HOVERS = "(hover: hover) and (pointer: fine)";
const subscribeHover = (onChange: () => void) => {
  const mq = window.matchMedia(HOVERS);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/* The beat a name is held for before it pours, and the grace a pointer has
   to cross the gap from the word into the card. */
const OPEN_DELAY = 200;
const CLOSE_DELAY = 140;
/* The card, the room between it and the word, and the slack round the
   liquid's box for the goo to spread into. */
const W = 272;
const GAP = 14;
const SLACK = 48;

/* A spring as a `linear()` easing: settles with one small overshoot, the
   wobble 0.25 Julian set on the filter bar's liquid. */
const SPRING = (() => {
  const pts: string[] = [];
  const w = 2 * Math.PI * 1.35, z = 0.62;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const v = 1 - Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t);
    pts.push((i === 40 ? 1 : v).toFixed(4));
  }
  /* A close cubic-bezier where `linear()` is not understood: a style
     with an easing it cannot read is dropped whole, and the card would
     jump. Fitted to the samples (worst gap 0.01). */
  const curve = `linear(${pts.join(", ")})`;
  return typeof CSS !== "undefined" && !CSS.supports("transition-timing-function", curve)
    ? "cubic-bezier(0.3, 1.75, 0.3, 0.87)"
    : curve;
})();
const IN = "cubic-bezier(0.23, 1, 0.32, 1)";
const FALL = "cubic-bezier(0.55, 0, 0.75, 0.2)";

/* The goo, with its edge where the shape's edge is: the library's own
   threshold sits a little outside, and round a shape as thin as a line of
   type that showed as a wavy rim (Julian, live). Alpha at one half. */
const GOO = `<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" /><feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -12" result="goo" /><feComposite in="SourceGraphic" in2="goo" operator="atop" result="shape" />`;

type Person = { handle: string; name: string; role: string; avatar?: string };
type Held = Person & { el: HTMLElement };
type Box = { left: number; top: number; width: number; height: number };

const Ctx = React.createContext<{
  hold: (p: Held) => void;
  release: () => void;
  known: WeakMap<HTMLElement, Person>;
} | null>(null);
/* How long a switch takes to settle: the names below move to make room,
   and one can move out from under a still pointer. */
const SETTLE = 620;

/* How far an element is translated right now (mid-transition included), so
   a box can be read where it rests rather than where it is passing. */
const shifted = (el: Element) => {
  const t = getComputedStyle(el).translate;
  if (!t || t === "none") return 0;
  const [, y = "0"] = t.split(" ");
  return parseFloat(y) || 0;
};

/* The list's cells: each row's `dt` and `dd` (the row itself is
   `display: contents` beside the grid), then whatever follows the list in
   its panel. These are what move to make room. */
const cellsOf = (dl: Element) => {
  const cells = [...dl.querySelectorAll<HTMLElement>(":scope > * > dt, :scope > * > dd")];
  for (let n = dl.nextElementSibling; n; n = n.nextElementSibling) cells.push(n as HTMLElement);
  return cells;
};

export function CreditList({ children }: { children: React.ReactNode }) {
  const hovers = React.useSyncExternalStore(
    subscribeHover,
    () => window.matchMedia(HOVERS).matches,
    () => false,
  );
  const [held, setHeld] = React.useState<Held | null>(null);
  const [shown, setShown] = React.useState(false);
  const live = React.useRef(false);
  const timer = React.useRef(0);
  const settled = React.useRef(0);
  const at = React.useRef({ x: -1, y: -1 });
  const [known] = React.useState(() => new WeakMap<HTMLElement, Person>());

  const hold = React.useCallback((p: Held) => {
    window.clearTimeout(timer.current);
    /* Already open: straight across, as a chip in the filter bar. */
    if (live.current) {
      settled.current = performance.now() + SETTLE;
      return setHeld(p);
    }
    timer.current = window.setTimeout(() => {
      live.current = true;
      setHeld(p);
      setShown(true);
    }, OPEN_DELAY);
  }, []);
  /* Let go, unless the pointer is still on the card or on a name once
     things have settled: a switch moves the names, and the one just
     reached can leave the hand without the hand having moved (the list
     making room for its card), and a leave is all the browser reports. */
  const release = React.useCallback(() => {
    window.clearTimeout(timer.current);
    const wait = Math.max(CLOSE_DELAY, settled.current - performance.now() + 60);
    timer.current = window.setTimeout(() => {
      const t = document.elementFromPoint(at.current.x, at.current.y);
      if (t?.closest(".credit-pour [data-ring='']")) return;
      const name = t?.closest<HTMLElement>("[data-stick]");
      const who = name && known.get(name);
      if (name && who) {
        settled.current = performance.now() + SETTLE;
        return setHeld({ ...who, el: name });
      }
      live.current = false;
      setHeld(null);
    }, wait);
  }, [known]);
  // Where the pointer is, for that check.
  React.useEffect(() => {
    if (!shown) return;
    const track = (e: PointerEvent) => (at.current = { x: e.clientX, y: e.clientY });
    document.addEventListener("pointermove", track, { passive: true });
    return () => document.removeEventListener("pointermove", track);
  }, [shown]);
  const stay = React.useCallback(() => window.clearTimeout(timer.current), []);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  /* The credits sit inside a strip that can be dragged, and a card left
     hanging over a moving sequence has lost its anchor: any scroll, a
     resize or Escape shuts it at once. */
  React.useEffect(() => {
    if (!held) return;
    const shut = () => {
      window.clearTimeout(timer.current);
      live.current = false;
      setHeld(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && shut();
    window.addEventListener("scroll", shut, { capture: true, passive: true });
    window.addEventListener("resize", shut);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("scroll", shut, { capture: true });
      window.removeEventListener("resize", shut);
      window.removeEventListener("keydown", key);
    };
  }, [held]);

  const value = React.useMemo(
    () => (hovers ? { hold, release, known } : null),
    [hovers, hold, release, known],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {shown
        ? createPortal(
            <Pour held={held} onEnter={stay} onLeave={release} onGone={() => setShown(false)} />,
            document.body,
          )
        : null}
    </Ctx.Provider>
  );
}

export function CreditCard({
  handle,
  name,
  role,
  avatar,
  children,
}: Person & {
  /** The credit's own link, untouched but for the hover it now carries. */
  children: React.ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;
}) {
  const list = React.useContext(Ctx);
  const word = React.useRef<HTMLElement | null>(null);
  if (!list) return children;
  const hold = () => word.current && list.hold({ handle, name, role, avatar, el: word.current });
  return React.cloneElement(children, {
    ref: (el: HTMLElement | null) => {
      word.current = el;
      if (el) list.known.set(el, { handle, name, role, avatar });
    },
    // The dot holds to the name as to a filter chip, and runs into the ink.
    ...({ "data-stick": "" } as object),
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => e.pointerType === "mouse" && hold(),
    onPointerLeave: list.release,
    onFocus: (e: React.FocusEvent<HTMLElement>) => e.currentTarget.matches(":focus-visible") && hold(),
    onBlur: list.release,
  });
}

/* The liquid: a drop under the held name that slides from name to name
   (`move`), and the card, a box the liquid follows (`observe`) that the
   drop necks into while they are close. Everything moves on CSS
   transitions, so a new name mid-flight simply sets new places. */
function Pour({
  held,
  onEnter,
  onLeave,
  onGone,
}: {
  held: Held | null;
  onEnter: () => void;
  onLeave: () => void;
  onGone: () => void;
}) {
  const [reduce] = React.useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const ms = (n: number) => (reduce ? 0 : n);
  // The last name held, kept through the close so the ink drains into it.
  const [last, setLast] = React.useState<Held | null>(held);
  if (held && held !== last) setLast(held);
  const who = held ?? last;
  // The list the card belongs to, and the liquid's box, fixed for one opening.
  const dl = who?.el.closest("dl") ?? null;
  const [frame] = React.useState(() => {
    const r = (dl ?? who!.el).getBoundingClientRect();
    return {
      left: Math.min(r.left, window.innerWidth - W - 16) - SLACK,
      top: r.top - 160 - SLACK,
      width: Math.max(r.width, W + 300) + 2 * SLACK,
      height: r.height + 360 + 2 * SLACK,
    };
  });
  const inner = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(0);
  const [first, setFirst] = React.useState(true);

  // The card's height for the person now held, from their content.
  React.useLayoutEffect(() => {
    if (inner.current) setHeight(Math.ceil(inner.current.scrollHeight));
  }, [who?.handle]);
  // One frame at the drop before anything travels.
  React.useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => (b = requestAnimationFrame(() => setFirst(false))));
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);

  /* Where the held name rests: its box less any room it has been moved
     by, a little round its own line (inside the link's padded hit area,
     so the ink never reaches the credit under it). */
  const geo = React.useMemo(() => {
    if (!who) return null;
    const r = who.el.getBoundingClientRect();
    const cell = who.el.closest("dd");
    const dy = cell ? shifted(cell) : 0;
    const drop: Box = { left: r.left - 6, top: r.top - dy + 3, width: r.width + 12, height: r.height - 6 };
    const h = height || 1;
    const card: Box = { left: drop.left, top: drop.top + drop.height + GAP, width: W, height: h };
    card.left = Math.max(16, Math.min(card.left, window.innerWidth - W - 16));
    return { drop, card, cell };
    // Read when the name or the card's height changes.
  }, [who, height]);

  /* Making room: every cell after the held name's moves down to clear the
     card, the rest come home; on the way out, all of them. */
  React.useEffect(() => {
    if (!dl || !geo) return;
    const cells = cellsOf(dl);
    const at = geo.cell ? cells.indexOf(geo.cell as HTMLElement) : -1;
    const next = cells[at + 1];
    let room = 0;
    if (held && next) {
      const base = next.getBoundingClientRect().top - shifted(next);
      room = Math.max(0, geo.card.top + geo.card.height + GAP - base);
    }
    for (const [i, c] of cells.entries()) {
      c.style.transition = `translate ${ms(held ? 560 : 320)}ms ${held ? SPRING : FALL}`;
      c.style.translate = i > at && room ? `0 ${room}px` : "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, geo]);
  // Gone: the cells are left as they were found.
  React.useEffect(() => {
    const list = dl;
    return () => {
      if (!list) return;
      for (const c of cellsOf(list)) {
        c.style.removeProperty("translate");
        c.style.removeProperty("transition");
      }
    };
  }, [dl]);

  // Closed: the ink drains, then the liquid goes.
  React.useEffect(() => {
    if (held) return;
    const id = window.setTimeout(onGone, ms(700));
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  if (!who || !geo) return null;
  const local = (b: Box, s = 1) => ({
    width: b.width,
    height: b.height,
    transform: `translate(${b.left - frame.left}px, ${b.top - frame.top}px) scale(${s})`,
  });
  const open = !!held && !first;
  const cardBox = open ? geo.card : geo.drop;
  const named = who.name.replace(/^@/, "").toLowerCase() !== who.handle.toLowerCase();
  const font = getComputedStyle(who.el);
  const run = (ms_: number, ease: string, delay: number) =>
    ["transform", "width", "height"].map((p) => `${p} ${ms(ms_)}ms ${ease} ${ms(delay)}ms`).join(", ");

  return (
    <div
      aria-hidden
      className="credit-pour pointer-events-none fixed z-50"
      style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
    >
      <Liquid
        fill="var(--foreground)"
        filter={GOO}
        shadow="0 14px 34px rgb(0 0 0 / 0.28)"
        /* Its own style sets `position: relative`; the size is what its
           filter region is measured from, so it has to be the whole box. */
        className="h-full w-full"
      >
        {/* The drop: the filter bar's travelling liquid. */}
        <Liquid.Item effect="move" move={{ wobble: 0.25 }}>
          <div
            className="absolute left-0 top-0 origin-center rounded-[3px]"
            style={{
              ...local(geo.drop, open ? 1 : 0),
              transition: `transform ${ms(open ? 240 : 220)}ms ${open ? IN : FALL} ${ms(open ? 0 : 300)}ms`,
            }}
          />
        </Liquid.Item>
        <Liquid.Item observe radius={16}>
          <div
            data-ring=""
            onPointerEnter={onEnter}
            onPointerLeave={onLeave}
            className="pointer-events-auto absolute left-0 top-0 origin-top-left overflow-hidden rounded-2xl"
            style={{ ...local(cardBox), transition: open ? run(560, SPRING, 60) : run(320, FALL, 40) }}
          >
            <div
              ref={inner}
              key={who.handle}
              className="w-[272px] p-4 text-background"
              style={{
                opacity: open ? 1 : 0,
                transition: `opacity ${ms(open ? 240 : 100)}ms ease-out ${ms(open ? 300 : 0)}ms`,
              }}
            >
              <div className="flex items-start gap-3">
                {who.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={who.avatar}
                    alt=""
                    width={56}
                    height={56}
                    draggable={false}
                    className="size-14 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  {/* Who they are, a weight under bold, the role on a line of
                      its own ("Julian Gigola · Phot…" was cut), then the
                      handle, a weight lighter, right over the way out to it
                      (Julian, 2026-10-03). */}
                  {named ? (
                    <p className="label truncate font-semibold text-background">{who.name}</p>
                  ) : null}
                  {who.role ? (
                    <p className={`label text-left text-pretty leading-snug text-background/70 ${named ? "mt-1" : ""}`}>
                      {who.role}
                    </p>
                  ) : null}
                  <p
                    /* A long handle is set smaller until it fits, rather
                       than cut: Julian saw @LIGHTBENDER_... Never below
                       three quarters of the size. */
                    ref={(el) => {
                      if (!el) return;
                      el.style.fontSize = "";
                      const fit = el.clientWidth / (el.scrollWidth + 2);
                      if (el.scrollWidth >= el.clientWidth) {
                        el.style.fontSize = `${Math.max(0.75, 1.25 * fit)}rem`;
                      }
                    }}
                    className="font-display mt-3 truncate text-xl font-extrabold! uppercase leading-[1.2] tracking-[0]"
                  >
                    @{who.handle}
                  </p>
                  <a
                    href={`https://www.instagram.com/${who.handle}/`}
                    target="_blank"
                    rel="noreferrer"
                    tabIndex={-1}
                    data-ring="Instagram"
                    className="label mt-1.5 inline-block text-background/70 transition-colors duration-200 hoverable:hover:text-background"
                  >
                    Open on Instagram &#8599;
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Liquid.Item>
      </Liquid>
      {/* Over the ink, where the name is: the name again, in the ground,
          once the drop has arrived under it. */}
      <span
        key={`w-${who.handle}`}
        className="absolute left-0 top-0 whitespace-nowrap text-background"
        style={{
          fontFamily: font.fontFamily,
          fontSize: font.fontSize,
          fontWeight: font.fontWeight,
          letterSpacing: font.letterSpacing,
          textTransform: font.textTransform as React.CSSProperties["textTransform"],
          lineHeight: `${geo.drop.height + 6}px`,
          transform: `translate(${geo.drop.left + 6 - frame.left}px, ${geo.drop.top - 3 - frame.top}px)`,
          opacity: open ? 1 : 0,
          transition: `opacity ${ms(160)}ms ease-out ${ms(open ? 160 : 260)}ms`,
        }}
      >
        {who.el.innerText.split("\n")[0]}
      </span>
    </div>
  );
}
